from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session, joinedload
from typing import Any

from app.database import get_db
from app.models.models import (
    HierarchyNode, EquipmentModel, EquipmentClass, EquipmentSubclass,
    Document, NormalizationRule, ClassificationRule,
)
from app.schemas.schemas import (
    HierarchyNodeCreate, HierarchyNodeRead, HierarchyTreeRead,
    EquipmentModelCreate, EquipmentModelRead, EquipmentModelUpdate, EquipmentModelDetail,
    EquipmentClassCreate, EquipmentClassRead, EquipmentSubclassCreate, EquipmentSubclassRead,
    DocumentRead, NormalizationRuleCreate, NormalizationRuleRead,
    MessageResponse, BulkVerifyRequest,
)
from app.services.normalization import normalize_model_name
from app.services.classification import classify_model_by_classifier, classify_all_models
from app.services.ai_service import yandex_ai
from app.services.file_parser import parse_file, detect_file_type

router = APIRouter(prefix="/hierarchy", tags=["Окно 1 — Иерархия и модели"])


@router.get("/tree", response_model=list[HierarchyTreeRead])
def get_hierarchy_tree(db: Session = Depends(get_db)):
    roots = db.query(HierarchyNode).filter(HierarchyNode.parent_id.is_(None)).all()
    return _build_tree(roots)


def _build_tree(nodes: list[HierarchyNode]) -> list[HierarchyTreeRead]:
    result = []
    for node in nodes:
        children = _build_tree(node.children) if node.children else []
        result.append(HierarchyTreeRead(
            id=node.id,
            name=node.name,
            parent_id=node.parent_id,
            level_type=node.level_type,
            children=children,
        ))
    return result


@router.post("/nodes", response_model=HierarchyNodeRead)
def create_hierarchy_node(data: HierarchyNodeCreate, db: Session = Depends(get_db)):
    node = HierarchyNode(**data.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.put("/nodes/{node_id}", response_model=HierarchyNodeRead)
def update_hierarchy_node(node_id: int, data: HierarchyNodeCreate, db: Session = Depends(get_db)):
    node = db.query(HierarchyNode).get(node_id)
    if not node:
        raise HTTPException(404, "Node not found")
    for k, v in data.model_dump().items():
        setattr(node, k, v)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/nodes/{node_id}", response_model=MessageResponse)
def delete_hierarchy_node(node_id: int, db: Session = Depends(get_db)):
    node = db.query(HierarchyNode).get(node_id)
    if not node:
        raise HTTPException(404, "Node not found")
    db.delete(node)
    db.commit()
    return MessageResponse(message="Deleted")


@router.post("/upload-hierarchy", response_model=MessageResponse)
async def upload_hierarchy(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from app.services.file_parser import parse_xlsx
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created = 0
        models_created = 0
        level_names = [f"Уровень {i}" for i in range(1, 8)]

        for row in rows:
            parent_id = None
            for lvl_idx, lvl_key in enumerate(level_names):
                lvl_val = row.get(lvl_key)
                if not lvl_val or str(lvl_val).strip() == "None":
                    continue
                name = str(lvl_val).strip()
                existing = db.query(HierarchyNode).filter(
                    HierarchyNode.name == name,
                    HierarchyNode.parent_id == parent_id,
                ).first()
                if not existing:
                    node = HierarchyNode(name=name, level_type=f"Уровень {lvl_idx+1}", parent_id=parent_id)
                    db.add(node)
                    db.flush()
                    existing = node
                    created += 1
                parent_id = existing.id

            model_name = row.get("Модель")
            if model_name and str(model_name).strip() != "None":
                model_name = str(model_name).strip()
                existing_model = db.query(EquipmentModel).filter(
                    EquipmentModel.original_name == model_name,
                ).first()
                if not existing_model:
                    norm = normalize_model_name(model_name)
                    m = EquipmentModel(
                        original_name=model_name,
                        normalized_name=norm,
                        model_code=norm,
                        hierarchy_id=parent_id,
                    )
                    db.add(m)
                    models_created += 1

        db.commit()
        return MessageResponse(message=f"Loaded {created} hierarchy nodes, {models_created} models")
    finally:
        os.unlink(tmp_path)


@router.get("/models", response_model=list[EquipmentModelRead])
def get_models(
    skip: int = 0, limit: int = 100,
    class_id: int | None = None, has_class: bool | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    q_filter = db.query(EquipmentModel)
    if class_id is not None:
        q_filter = q_filter.filter(EquipmentModel.class_id == class_id)
    if has_class is False:
        q_filter = q_filter.filter(EquipmentModel.class_id.is_(None))
    if has_class is True:
        q_filter = q_filter.filter(EquipmentModel.class_id.isnot(None))
    if q:
        search_term = f"%{q}%"
        q_filter = q_filter.filter(
            (EquipmentModel.original_name.ilike(search_term)) | 
            (EquipmentModel.normalized_name.ilike(search_term)) |
            (EquipmentModel.model_code.ilike(search_term))
        )
    return q_filter.offset(skip).limit(limit).all()


@router.get("/models/{model_id}", response_model=EquipmentModelDetail)
def get_model_detail(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).options(
        joinedload(EquipmentModel.eq_class),
        joinedload(EquipmentModel.eq_subclass),
    ).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    class_name = model.eq_class.name if model.eq_class else None
    subclass_name = model.eq_subclass.name if model.eq_subclass else None

    return EquipmentModelDetail(
        id=model.id,
        original_name=model.original_name,
        hierarchy_id=model.hierarchy_id,
        normalized_name=model.normalized_name,
        model_code=model.model_code,
        class_id=model.class_id,
        subclass_id=model.subclass_id,
        source_type=model.source_type,
        confidence=model.confidence,
        source_url=model.source_url,
        verified=model.verified,
        created_at=model.created_at,
        updated_at=model.updated_at,
        class_name=class_name,
        subclass_name=subclass_name,
        documents_count=len(model.documents),
        characteristics_count=len(model.characteristics),
    )


@router.post("/models", response_model=EquipmentModelRead)
def create_model(data: EquipmentModelCreate, db: Session = Depends(get_db)):
    model = EquipmentModel(**data.model_dump())
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@router.put("/models/{model_id}", response_model=EquipmentModelRead)
def update_model(model_id: int, data: EquipmentModelUpdate, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(model, k, v)
    db.commit()
    db.refresh(model)
    return model


@router.post("/upload-models", response_model=MessageResponse)
async def upload_models(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from app.services.file_parser import parse_xlsx
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created = 0
        for row in rows:
            name = row.get("Модель") or row.get("Наименование") or row.get("model") or row.get("name")
            if not name:
                continue
            hierarchy_name = row.get("Иерархия") or row.get("hierarchy")

            hierarchy_id = None
            if hierarchy_name:
                h_node = db.query(HierarchyNode).filter(HierarchyNode.name == str(hierarchy_name)).first()
                if h_node:
                    hierarchy_id = h_node.id

            model = EquipmentModel(original_name=str(name), hierarchy_id=hierarchy_id)
            db.add(model)
            created += 1

        db.commit()
        return MessageResponse(message=f"Loaded {created} models")
    finally:
        os.unlink(tmp_path)


@router.post("/normalize-models", response_model=MessageResponse)
def normalize_models(force: bool = Query(True), db: Session = Depends(get_db)):
    models_q = db.query(EquipmentModel)
    if not force:
        models_q = models_q.filter(EquipmentModel.normalized_name.is_(None))

    models = models_q.all()
    updated = 0
    for model in models:
        normalized = normalize_model_name(model.original_name)
        if model.normalized_name != normalized or model.model_code != normalized:
            model.normalized_name = normalized
            model.model_code = normalized
            updated += 1

    db.commit()
    return MessageResponse(message=f"Normalized {updated} models")


@router.get("/classes", response_model=list[EquipmentClassRead])
def get_classes(db: Session = Depends(get_db)):
    return db.query(EquipmentClass).all()


@router.post("/classes", response_model=EquipmentClassRead)
def create_class(data: EquipmentClassCreate, db: Session = Depends(get_db)):
    cls = EquipmentClass(**data.model_dump())
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return cls


@router.post("/subclasses", response_model=EquipmentSubclassRead)
def create_subclass(data: EquipmentSubclassCreate, db: Session = Depends(get_db)):
    sub = EquipmentSubclass(**data.model_dump())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/upload-classifier", response_model=MessageResponse)
async def upload_classifier(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from app.services.file_parser import parse_xlsx
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created_classes = 0
        created_subclasses = 0
        created_rules = 0
        updated_rules = 0

        def pick(row: dict, *names: str):
            folded = {str(k).strip().casefold(): v for k, v in row.items()}
            for name in names:
                value = folded.get(name.casefold())
                if value is not None and str(value).strip():
                    return value
            return None

        for row in rows:
            class_name = pick(row, "\u041a\u043b\u0430\u0441\u0441", "class", "\u041a\u043b\u0430\u0441\u0441 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f")
            subclass_name = pick(row, "\u041f\u043e\u0434\u043a\u043b\u0430\u0441\u0441", "subclass", "\u041f\u043e\u0434\u043a\u043b\u0430\u0441\u0441 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f")
            model_name = pick(row, "\u041c\u043e\u0434\u0435\u043b\u044c", "model", "\u041c\u043e\u0434\u0435\u043b\u044c \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f", "\u041a\u043e\u0434 \u043c\u043e\u0434\u0435\u043b\u0438")

            if not class_name:
                continue
            class_name = str(class_name).strip()
            subclass_name = str(subclass_name).strip() if subclass_name else None

            cls = db.query(EquipmentClass).filter(EquipmentClass.name == class_name).first()
            if not cls:
                cls = EquipmentClass(name=class_name)
                db.add(cls)
                db.flush()
                created_classes += 1

            subclass_id = None
            if subclass_name:
                existing_sub = db.query(EquipmentSubclass).filter(
                    EquipmentSubclass.name == subclass_name,
                    EquipmentSubclass.class_id == cls.id,
                ).first()
                if not existing_sub:
                    sub = EquipmentSubclass(name=subclass_name, class_id=cls.id)
                    db.add(sub)
                    db.flush()
                    subclass_id = sub.id
                    created_subclasses += 1
                else:
                    subclass_id = existing_sub.id

            if model_name:
                model_pattern = str(model_name).strip()
                normalized_pattern = normalize_model_name(model_pattern)
                existing_rule = db.query(ClassificationRule).filter(
                    ClassificationRule.normalized_pattern == normalized_pattern
                ).first()
                if existing_rule:
                    existing_rule.model_pattern = model_pattern
                    existing_rule.class_id = cls.id
                    existing_rule.subclass_id = subclass_id
                    existing_rule.source_type = "classifier_upload"
                    updated_rules += 1
                else:
                    db.add(ClassificationRule(
                        model_pattern=model_pattern,
                        normalized_pattern=normalized_pattern,
                        class_id=cls.id,
                        subclass_id=subclass_id,
                        source_type="classifier_upload",
                    ))
                    created_rules += 1

        db.commit()
        return MessageResponse(
            message=f"Loaded {created_classes} classes, {created_subclasses} subclasses, {created_rules} model rules (updated {updated_rules})"
        )
    finally:
        os.unlink(tmp_path)


@router.post("/classify-models", response_model=MessageResponse)
def classify_models(db: Session = Depends(get_db)):
    result = classify_all_models(db)
    return MessageResponse(message=f"Classified: {result['classified']}, Unclassified: {result['unclassified']}")


@router.post("/classify-models-via-web", response_model=MessageResponse)
def classify_models_via_web(
    limit: int = Query(200, ge=1, le=2000),
    force: bool = Query(False),
    db: Session = Depends(get_db),
):
    """
    AI web classification with mapping into the uploaded classifier.
    - Uses web search to get a candidate class/subclass (can be noisy).
    - Then maps it to the closest existing EquipmentClass/EquipmentSubclass by fuzzy match.
    """
    from difflib import SequenceMatcher

    def _norm(s: str | None) -> str:
        return str(s or "").strip().casefold()

    def _best_match(target: str, options: list[str]) -> tuple[str | None, float]:
        t = _norm(target)
        if not t:
            return None, 0.0
        best = None
        best_score = 0.0
        for opt in options:
            score = SequenceMatcher(None, t, _norm(opt)).ratio()
            if score > best_score:
                best_score = score
                best = opt
        return best, best_score

    classes = db.query(EquipmentClass).all()
    if not classes:
        return MessageResponse(message="Classifier is empty: upload classes/subclasses first")

    models_q = db.query(EquipmentModel)
    if not force:
        models_q = models_q.filter(EquipmentModel.class_id.is_(None))
    models = models_q.limit(limit).all()

    tried = 0
    classified = 0
    no_ai = 0
    no_class_match = 0
    for model in models:
        tried += 1
        class_names = [c.name for c in classes]
        ai_result = yandex_ai.classify_model_via_web_search_guess(model.normalized_name or model.original_name, class_names=class_names)
        cls_name = (ai_result or {}).get("class_name")
        sub_name = (ai_result or {}).get("subclass_name")

        if not ai_result or not cls_name or _norm(cls_name) in {"null", "none"}:
            no_ai += 1
            continue

        cls = next((c for c in classes if _norm(c.name) == _norm(cls_name)), None)
        if not cls:
            # Try fuzzy match in case AI picked a near-synonym despite constraint.
            class_names = [c.name for c in classes]
            best_cls, cls_score = _best_match(str(cls_name), class_names)
            if best_cls and cls_score >= 0.78:
                cls = next((c for c in classes if c.name == best_cls), None)
        if not cls:
            no_class_match += 1
            continue

        model.class_id = cls.id
        model.source_type = (ai_result or {}).get("source", "yandex_web_search_guess")
        model.confidence = float((ai_result or {}).get("confidence", 0.55) or 0.55)
        # Store evidence links when we have them.
        sources = (ai_result or {}).get("sources") or []
        if sources:
            model.source_url = str(sources[0])

        if sub_name and _norm(sub_name) not in {"null", "none"} and cls.subclasses:
            sub_exact = next((s for s in cls.subclasses if _norm(s.name) == _norm(sub_name)), None)
            if sub_exact:
                model.subclass_id = sub_exact.id
            else:
                sub_names = [s.name for s in cls.subclasses]
                best_sub, sub_score = _best_match(str(sub_name), sub_names)
                if best_sub and sub_score >= 0.78:
                    sub = next((s for s in cls.subclasses if s.name == best_sub), None)
                    if sub:
                        model.subclass_id = sub.id

        classified += 1

    db.commit()
    return MessageResponse(message=f"AI tried {tried} models, classified {classified} (no_ai={no_ai}, no_class_match={no_class_match})")


@router.post("/upload-documents/{model_id}", response_model=DocumentRead)
async def upload_document(model_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    import aiofiles, os
    from app.config import settings

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_name = f"{model_id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_name)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    doc = Document(
        model_id=model_id,
        filename=file.filename,
        file_type=detect_file_type(file.filename),
        file_path=file_path,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        parsed = parse_file(file_path)
        if isinstance(parsed, str):
            doc.parsed_content = parsed
        db.commit()
    except Exception:
        pass

    return doc


@router.get("/documents/{model_id}", response_model=list[DocumentRead])
def get_documents(model_id: int, db: Session = Depends(get_db)):
    return db.query(Document).filter(Document.model_id == model_id).all()


@router.get("/normalization-rules", response_model=list[NormalizationRuleRead])
def get_normalization_rules(db: Session = Depends(get_db)):
    return db.query(NormalizationRule).order_by(NormalizationRule.order).all()


@router.post("/normalization-rules", response_model=NormalizationRuleRead)
def create_normalization_rule(data: NormalizationRuleCreate, db: Session = Depends(get_db)):
    rule = NormalizationRule(**data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/upload-normalization-rules", response_model=MessageResponse)
async def upload_normalization_rules(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from app.services.file_parser import parse_xlsx
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created = 0
        for row in rows:
            rule_type = row.get("Тип правила") or row.get("rule_type") or "model"
            pattern = row.get("Шаблон") or row.get("pattern") or row.get("Что")
            replacement = row.get("Замена") or row.get("replacement") or row.get("На что") or ""
            description = row.get("Описание") or row.get("description")

            if not pattern:
                continue

            rule = NormalizationRule(
                rule_type=str(rule_type),
                pattern=str(pattern),
                replacement=str(replacement),
                description=str(description) if description else None,
            )
            db.add(rule)
            created += 1

        db.commit()
        return MessageResponse(message=f"Loaded {created} normalization rules")
    finally:
        os.unlink(tmp_path)


@router.post("/verify", response_model=MessageResponse)
def bulk_verify(data: BulkVerifyRequest, db: Session = Depends(get_db)):
    db.query(EquipmentModel).filter(EquipmentModel.id.in_(data.ids)).update(
        {EquipmentModel.verified: data.verified}, synchronize_session=False
    )
    db.commit()
    return MessageResponse(message=f"Updated {len(data.ids)} models")
