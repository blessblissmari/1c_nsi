from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    APLItem,
    BOMItem,
    ComponentOperation,
    EquipmentClass,
    EquipmentModel,
    TORComponent,
)
from app.services.ai_service import YandexAIService
from app.services.classification import classify_model_by_classifier


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    message: str
    context_model_id: int | None = None


class ChatResponse(BaseModel):
    message: str
    sources: list[str] = []
    data: dict | None = None


class ChatActionRequest(BaseModel):
    action: str
    context_model_id: int


def _model_name(model: EquipmentModel) -> str:
    return model.normalized_name or model.original_name


def _msg(text: str, sources: list[str] | None = None, data: dict | None = None) -> ChatResponse:
    return ChatResponse(message=text, sources=sources or [], data=data)


def _friendly_error(exc: HTTPException) -> ChatResponse:
    detail = str(exc.detail or "")
    translations = {
        "Model not classified": "Сначала классифицируйте модель: кнопкой «По классификатору» или «ИИ + интернет».",
        "No required characteristics for class/subclass": "Для этого класса/подкласса не найдены обязательные характеристики. Загрузите файл «Класс-подкласс характеристики» или проверьте синюю заливку обязательных колонок.",
        "No parsed document text": "Нет распознанного текста документов по этой модели. Загрузите документ в блок «Документы карточки ТОР» и дождитесь завершения обработки.",
        "No failure events for this model": "По этой модели нет статистики отказов. Сначала загрузите файл отказов.",
        "Insufficient data to calculate MTBF (need runtime_hours or at least 2 dates)": "Для расчёта MTBF нужны часы наработки или минимум две даты отказов.",
    }
    return _msg(translations.get(detail, detail or "Действие не выполнено. Проверьте исходные данные."))


def _run_endpoint(fn, *args, **kwargs) -> ChatResponse:
    try:
        res = fn(*args, **kwargs)
        return _msg(res.message)
    except HTTPException as exc:
        if int(exc.status_code or 500) < 500:
            return _friendly_error(exc)
        raise


@router.post("/", response_model=ChatResponse)
def chat(message: ChatMessage, db: Session = Depends(get_db)):
    yandex_ai = YandexAIService()

    context_info = ""
    if message.context_model_id:
        model = db.query(EquipmentModel).get(message.context_model_id)
        if model:
            class_info = f", класс: {model.eq_class.name}" if model.eq_class else ""
            subclass_info = f", подкласс: {model.eq_subclass.name}" if model.eq_subclass else ""
            context_info = f"Контекст: модель оборудования {_model_name(model)}{class_info}{subclass_info}"

    prompt = (
        "Ты — ТОРя, помощник по НСИ ТОиР и промышленному оборудованию.\n"
        f"{context_info}\n"
        f"Вопрос пользователя: {message.message}\n"
        "Отвечай кратко, по делу, на русском языке. Если опираешься на загруженные документы, явно скажи это."
    )

    result = yandex_ai._call_http(prompt, temperature=0.3) or yandex_ai._call_lite(prompt, temperature=0.3)
    if not result:
        raise HTTPException(500, "AI service unavailable")

    return ChatResponse(message=result, sources=[])


@router.post("", response_model=ChatResponse, include_in_schema=False)
def chat_no_slash(message: ChatMessage, db: Session = Depends(get_db)):
    return chat(message=message, db=db)


@router.post("/action", response_model=ChatResponse)
def chat_action(req: ChatActionRequest, db: Session = Depends(get_db)):
    yandex_ai = YandexAIService()
    model = db.query(EquipmentModel).get(req.context_model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    action = (req.action or "").strip().lower()

    if action == "classify_classifier":
        result = classify_model_by_classifier(model, db)
        if not result:
            return _msg("По загруженному классификатору совпадение не найдено. Проверьте, что в классификаторе есть колонка «Модель».")
        db.commit()
        db.refresh(model)
        cls = model.eq_class.name if model.eq_class else "класс не определён"
        sub = model.eq_subclass.name if model.eq_subclass else "подкласс не определён"
        return _msg(f"Классифицировано по классификатору: {_model_name(model)} → {cls} / {sub}", data={"class": cls, "subclass": sub})

    if action == "classify_model":
        classes = db.query(EquipmentClass).all()
        if not classes:
            return _msg("Классификатор пустой. Сначала загрузите файл классификатора.")

        class_names = [c.name for c in classes]
        ai = yandex_ai.classify_model_via_web_search_guess(_model_name(model), class_names=class_names)
        cls_name = (ai or {}).get("class_name")
        if not cls_name or str(cls_name).casefold() in {"null", "none"}:
            return _msg("Не удалось классифицировать модель по интернету.", sources=(ai or {}).get("sources") or [])

        from difflib import SequenceMatcher

        def norm(s: str | None) -> str:
            return str(s or "").strip().casefold()

        cls = next((c for c in classes if norm(c.name) == norm(cls_name)), None)
        if not cls:
            best = max(classes, key=lambda c: SequenceMatcher(None, norm(c.name), norm(cls_name)).ratio())
            if SequenceMatcher(None, norm(best.name), norm(cls_name)).ratio() >= 0.78:
                cls = best
        if not cls:
            return _msg(f"Класс «{cls_name}» не найден в загруженном классификаторе.", sources=(ai or {}).get("sources") or [])

        model.class_id = cls.id
        model.subclass_id = None
        sub_name = (ai or {}).get("subclass_name")
        if sub_name and norm(sub_name) not in {"null", "none"} and cls.subclasses:
            best_sub = max(cls.subclasses, key=lambda s: SequenceMatcher(None, norm(s.name), norm(sub_name)).ratio())
            if SequenceMatcher(None, norm(best_sub.name), norm(sub_name)).ratio() >= 0.78:
                model.subclass_id = best_sub.id

        model.source_type = (ai or {}).get("source") or "yandex_web_search_guess"
        model.confidence = float((ai or {}).get("confidence") or 0.55)
        sources = (ai or {}).get("sources") or []
        if sources:
            model.source_url = str(sources[0])
        db.commit()
        db.refresh(model)
        sub = model.eq_subclass.name if model.eq_subclass else "подкласс не определён"
        return _msg(f"Классифицировано через интернет/ИИ: {_model_name(model)} → {cls.name} / {sub}", sources=sources, data={"class": cls.name, "subclass": sub})

    if action == "required_from_docs":
        from app.api.v1.mass_processing import required_from_docs

        return _run_endpoint(required_from_docs, model.id, db)

    if action == "required_from_web":
        from app.api.v1.mass_processing import required_from_web

        return _run_endpoint(required_from_web, model.id, db)

    if action == "other_from_docs":
        from app.api.v1.mass_processing import other_from_docs

        return _run_endpoint(other_from_docs, model.id, db)

    if action == "maintenance_from_docs":
        from app.api.v1.maintenance import fill_from_source

        return _run_endpoint(fill_from_source, model.id, db)

    if action == "maintenance_from_web":
        from app.api.v1.maintenance import enrich_from_web

        return _run_endpoint(enrich_from_web, model.id, db)

    if action == "tk_components_docs":
        from app.api.v1.tk import fill_components

        return _run_endpoint(fill_components, model.id, db)

    if action == "tk_components_web":
        from app.api.v1.tk import enrich_components

        return _run_endpoint(enrich_components, model.id, db)

    if action in {"tk_operations_docs", "tk_operations_web"}:
        from app.api.v1.tk import enrich_operations, fill_operations

        components = db.query(TORComponent).filter(TORComponent.model_id == model.id).all()
        if not components:
            return _msg("Сначала сформируйте узлы/компоненты ТК.")
        total = 0
        for comp in components:
            res = fill_operations(comp.id, db) if action == "tk_operations_docs" else enrich_operations(comp.id, db)
            total += _extract_count(res.message)
        return _msg(f"Операции ТК обработаны по компонентам: {total}")

    if action in {"tk_tmc_docs", "tk_tmc_web"}:
        from app.api.v1.tk import enrich_tmc, fill_tmc

        components = db.query(TORComponent).filter(TORComponent.model_id == model.id).all()
        comp_ids = [c.id for c in components]
        operations = db.query(ComponentOperation).filter(ComponentOperation.component_id.in_(comp_ids)).all() if comp_ids else []
        if not operations:
            return _msg("Сначала сформируйте операции ТК.")
        total = 0
        for op in operations:
            res = fill_tmc(op.id, db) if action == "tk_tmc_docs" else enrich_tmc(op.id, db)
            total += _extract_count(res.message)
        return _msg(f"ТМЦ по операциям обработаны: {total}")

    if action == "tmc_docs":
        from app.api.v1.specifications import generate_apl_from_source, generate_bom_from_source

        try:
            bom = generate_bom_from_source(model.id, db)
            apl = generate_apl_from_source(model.id, db)
        except HTTPException as exc:
            return _friendly_error(exc)
        return _msg(f"ТМЦ из документов/карточки: {bom.message}; {apl.message}")

    if action == "tmc_web":
        from app.api.v1.specifications import generate_apl_from_web, generate_bom_from_web

        try:
            bom = generate_bom_from_web(model.id, db)
            apl = generate_apl_from_web(model.id, db)
        except HTTPException as exc:
            return _friendly_error(exc)
        return _msg(f"ТМЦ из интернета: {bom.message}; {apl.message}")

    if action == "tmc_analogs":
        updated = 0
        for item in db.query(BOMItem).filter(BOMItem.model_id == model.id).all():
            updated += _fill_analog(yandex_ai, item)
        for item in db.query(APLItem).filter(APLItem.model_id == model.id).all():
            updated += _fill_analog(yandex_ai, item)
        db.commit()
        return _msg(f"Аналоги для ТМЦ подобраны: {updated}")

    if action == "reliability_from_docs":
        from app.api.v1.reliability import fill_from_source

        return _run_endpoint(fill_from_source, model.id, db)

    if action == "reliability_from_web":
        from app.api.v1.reliability import enrich_from_web

        return _run_endpoint(enrich_from_web, model.id, db)

    if action == "recalc_mtbf":
        from app.api.v1.reliability import recalc_mtbf

        return _run_endpoint(recalc_mtbf, model.id, db)

    raise HTTPException(400, "Unknown action")


def _extract_count(message: str) -> int:
    import re

    nums = re.findall(r"\d+", message or "")
    return int(nums[0]) if nums else 0


def _fill_analog(yandex_ai: YandexAIService, item) -> int:
    if getattr(item, "analog_name", None) or getattr(item, "analog_code", None):
        return 0
    results = yandex_ai.search_analogs(item.name)
    if not results:
        return 0
    best = results[0]
    item.analog_code = best.get("model")
    item.analog_name = best.get("name") or best.get("model")
    item.source_type = item.source_type or "yandex_web"
    return 1
