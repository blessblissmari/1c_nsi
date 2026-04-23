from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from difflib import SequenceMatcher

from app.database import get_db
from app.models.models import EquipmentModel, TORComponent, ComponentOperation, OperationTMC, Operation, Profession, Qualification, LaborNorm
from app.schemas.schemas import (
    TORComponentCreate, TORComponentRead, TORComponentUpdate,
    ComponentOperationCreate, ComponentOperationRead, ComponentOperationUpdate,
    OperationTMCCreate, OperationTMCRead, OperationTMCUpdate,
    TkVerifyRequest, MessageResponse,
    OperationCreate, OperationRead,
    ProfessionRead, QualificationRead,
)
from app.services.ai_service import yandex_ai
from app.services.normalization import normalize_operation_name
from app.services.file_parser import parse_xlsx

router = APIRouter(prefix="/tk", tags=["Окно 6 — ТК ТОиР"])


# ── Resources: Professions / Qualifications / Labor Norms ───────────

@router.get("/professions", response_model=list[ProfessionRead])
def get_professions(db: Session = Depends(get_db)):
    return db.query(Profession).order_by(Profession.name.asc()).all()


@router.post("/upload-professions", response_model=MessageResponse)
async def upload_professions(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created = 0
        for row in rows:
            name = row.get("Профессия") or row.get("Наименование") or row.get("name")
            if not name:
                continue
            name = str(name).strip()
            if not name:
                continue
            if db.query(Profession).filter(Profession.name == name).first():
                continue
            db.add(Profession(name=name))
            created += 1
        db.commit()
        return MessageResponse(message=f"Loaded {created} professions")
    finally:
        os.unlink(tmp_path)


@router.get("/qualifications", response_model=list[QualificationRead])
def get_qualifications(db: Session = Depends(get_db)):
    return db.query(Qualification).order_by(Qualification.name.asc()).all()


@router.post("/upload-qualifications", response_model=MessageResponse)
async def upload_qualifications(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created = 0
        for row in rows:
            name = row.get("Квалификация") or row.get("Наименование") or row.get("name")
            if not name:
                continue
            name = str(name).strip()
            if not name:
                continue
            if db.query(Qualification).filter(Qualification.name == name).first():
                continue
            db.add(Qualification(name=name))
            created += 1
        db.commit()
        return MessageResponse(message=f"Loaded {created} qualifications")
    finally:
        os.unlink(tmp_path)


@router.post("/upload-labor-norms", response_model=MessageResponse)
async def upload_labor_norms(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created = 0
        for row in rows:
            op = row.get("Операция") or row.get("Наименование") or row.get("operation") or row.get("name")
            hours = row.get("Трудоемкость") or row.get("Трудоёмкость") or row.get("Часы") or row.get("labor_hours")
            if not op or hours is None:
                continue
            op_norm = normalize_operation_name(str(op))
            try:
                labor_hours = float(str(hours).replace(",", ".").strip())
            except Exception:
                continue

            profession = row.get("Профессия") or row.get("profession")
            qualification = row.get("Квалификация") or row.get("qualification")

            ln = LaborNorm(
                operation_normalized=op_norm,
                profession=str(profession).strip() if profession else None,
                qualification=str(qualification).strip() if qualification else None,
                labor_hours=labor_hours,
                source_type="upload",
            )
            db.add(ln)
            created += 1
        db.commit()
        return MessageResponse(message=f"Loaded {created} labor norms")
    finally:
        os.unlink(tmp_path)


@router.post("/fill-labor-from-source/{model_id}", response_model=MessageResponse)
def fill_labor_from_source(model_id: int, db: Session = Depends(get_db)):
    comps = db.query(TORComponent).filter(TORComponent.model_id == model_id).all()
    if not comps:
        return MessageResponse(message="No components")

    comp_ids = [c.id for c in comps]
    ops = db.query(ComponentOperation).filter(
        ComponentOperation.component_id.in_(comp_ids),
        ComponentOperation.labor_hours.is_(None),
    ).all()
    if not ops:
        return MessageResponse(message="No empty labor hours")

    norms = db.query(LaborNorm).all()
    if not norms:
        return MessageResponse(message="No labor norms loaded")

    updated = 0
    for op in ops:
        name = op.custom_name or (op.operation.normalized_name if op.operation else None) or (op.operation.name if op.operation else "")
        op_norm = normalize_operation_name(str(name))

        # 1) Exact match by normalized name (+ optional profession/qualification)
        exact = [n for n in norms if n.operation_normalized == op_norm]
        if op.profession:
            exact = [n for n in exact if not n.profession or n.profession == op.profession]
        if op.qualification:
            exact = [n for n in exact if not n.qualification or n.qualification == op.qualification]
        if exact:
            best = exact[0]
            op.labor_hours = float(best.labor_hours)
            op.source_type = "labor_source"
            op.confidence = 0.9
            updated += 1
            continue

        # 2) Fuzzy match (deterministic)
        best = None
        best_score = 0.0
        for n in norms:
            score = SequenceMatcher(None, op_norm, n.operation_normalized).ratio()
            if score > best_score:
                best_score = score
                best = n
        if best and best_score >= 0.78:
            op.labor_hours = float(best.labor_hours)
            op.source_type = "labor_source_fuzzy"
            op.confidence = round(min(0.75, best_score), 3)
            updated += 1

    db.commit()
    return MessageResponse(message=f"Filled labor hours for {updated} operations")


@router.post("/enrich-labor-from-web/{model_id}", response_model=MessageResponse)
def enrich_labor_from_web(model_id: int, db: Session = Depends(get_db)):
    comps = db.query(TORComponent).filter(TORComponent.model_id == model_id).all()
    if not comps:
        return MessageResponse(message="No components")

    model = db.query(EquipmentModel).get(model_id)
    class_name = model.eq_class.name if model and model.eq_class else None

    comp_ids = [c.id for c in comps]
    ops = db.query(ComponentOperation).filter(
        ComponentOperation.component_id.in_(comp_ids),
        ComponentOperation.labor_hours.is_(None),
    ).all()
    if not ops:
        return MessageResponse(message="No empty labor hours")

    updated = 0
    for op in ops:
        op_name = op.custom_name or (op.operation.name if op.operation else "")
        op_name = normalize_operation_name(str(op_name))
        if not op_name:
            continue

        prompt = (
            "Ты эксперт по ТОиР. Нужно оценить трудоемкость операции (чел.-ч) и подобрать профессию/квалификацию.\n"
            f"Оборудование: {class_name or 'неизвестно'}\n"
            f"Операция: {op_name}\n"
            "Ответь строго JSON объектом:\n"
            '{"labor_hours": число, "profession": "строка или null", "qualification": "строка или null"}\n'
            "Если не уверен, labor_hours = null."
        )

        text = yandex_ai._call_with_web_search(prompt, temperature=0.2) or ""
        parsed = yandex_ai._parse_json(text)
        if not isinstance(parsed, dict):
            continue

        lh = parsed.get("labor_hours")
        try:
            labor_hours = float(lh) if lh is not None else None
        except Exception:
            labor_hours = None

        if labor_hours is None or labor_hours <= 0:
            continue

        op.labor_hours = labor_hours
        if not op.profession and parsed.get("profession"):
            op.profession = str(parsed.get("profession")).strip()
        if not op.qualification and parsed.get("qualification"):
            op.qualification = str(parsed.get("qualification")).strip()
        op.source_type = "labor_web"
        op.confidence = 0.6
        updated += 1

    db.commit()
    return MessageResponse(message=f"Enriched labor hours for {updated} operations from web")

# ── Operation Catalog (standard operations) ─────────────────────────

@router.get("/operation-catalog", response_model=list[OperationRead])
def get_operation_catalog(
    q: str | None = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    query = db.query(Operation)
    if q:
        term = f"%{q}%"
        query = query.filter((Operation.name.ilike(term)) | (Operation.normalized_name.ilike(term)))
    return query.offset(skip).limit(limit).all()


@router.post("/operation-catalog", response_model=OperationRead)
def create_operation_catalog_item(data: OperationCreate, db: Session = Depends(get_db)):
    op = Operation(**data.model_dump())
    if op.name:
        op.normalized_name = normalize_operation_name(op.name)
    db.add(op)
    db.commit()
    db.refresh(op)
    return op


@router.post("/upload-operation-catalog", response_model=MessageResponse)
async def upload_operation_catalog(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created = 0
        for row in rows:
            name = row.get("Операция") or row.get("Наименование") or row.get("name")
            if not name:
                continue
            name = str(name).strip()
            normalized = normalize_operation_name(name)
            exists = db.query(Operation).filter(Operation.normalized_name == normalized).first()
            if exists:
                continue
            op = Operation(name=name, normalized_name=normalized)
            db.add(op)
            created += 1
        db.commit()
        return MessageResponse(message=f"Loaded {created} operations")
    finally:
        os.unlink(tmp_path)


# ── Components ──────────────────────────────────────────────────────

@router.get("/components", response_model=list[TORComponentRead])
def get_components(model_id: int, db: Session = Depends(get_db)):
    return db.query(TORComponent).filter(TORComponent.model_id == model_id).all()


@router.post("/components", response_model=TORComponentRead)
def create_component(data: TORComponentCreate, db: Session = Depends(get_db)):
    comp = TORComponent(**data.model_dump())
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.put("/components/{comp_id}", response_model=TORComponentRead)
def update_component(comp_id: int, data: TORComponentUpdate, db: Session = Depends(get_db)):
    comp = db.query(TORComponent).get(comp_id)
    if not comp:
        raise HTTPException(404, "Component not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(comp, k, v)
    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/components/{comp_id}", response_model=MessageResponse)
def delete_component(comp_id: int, db: Session = Depends(get_db)):
    comp = db.query(TORComponent).get(comp_id)
    if not comp:
        raise HTTPException(404, "Component not found")
    db.delete(comp)
    db.commit()
    return MessageResponse(message="Deleted")


# ── Component Operations ────────────────────────────────────────────

@router.get("/operations", response_model=list[ComponentOperationRead])
def get_operations(component_id: int, db: Session = Depends(get_db)):
    return db.query(ComponentOperation).filter(ComponentOperation.component_id == component_id).all()


@router.post("/operations", response_model=ComponentOperationRead)
def create_operation(data: ComponentOperationCreate, db: Session = Depends(get_db)):
    op = ComponentOperation(**data.model_dump())
    if op.custom_name:
        op.custom_name = normalize_operation_name(op.custom_name)
    if op.operation_id:
        op.custom_name = None
    db.add(op)
    db.commit()
    db.refresh(op)
    return op


@router.put("/operations/{op_id}", response_model=ComponentOperationRead)
def update_operation(op_id: int, data: ComponentOperationUpdate, db: Session = Depends(get_db)):
    op = db.query(ComponentOperation).get(op_id)
    if not op:
        raise HTTPException(404, "Operation not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(op, k, v)
    if op.custom_name:
        op.custom_name = normalize_operation_name(op.custom_name)
    if op.operation_id:
        op.custom_name = None
    db.commit()
    db.refresh(op)
    return op


@router.delete("/operations/{op_id}", response_model=MessageResponse)
def delete_operation(op_id: int, db: Session = Depends(get_db)):
    op = db.query(ComponentOperation).get(op_id)
    if not op:
        raise HTTPException(404, "Operation not found")
    db.delete(op)
    db.commit()
    return MessageResponse(message="Deleted")


# ── Operation TMC ───────────────────────────────────────────────────

@router.get("/tmc", response_model=list[OperationTMCRead])
def get_tmc(operation_id: int, db: Session = Depends(get_db)):
    return db.query(OperationTMC).filter(OperationTMC.operation_id == operation_id).all()


@router.post("/tmc", response_model=OperationTMCRead)
def create_tmc(data: OperationTMCCreate, db: Session = Depends(get_db)):
    tmc = OperationTMC(**data.model_dump())
    db.add(tmc)
    db.commit()
    db.refresh(tmc)
    return tmc


@router.put("/tmc/{tmc_id}", response_model=OperationTMCRead)
def update_tmc(tmc_id: int, data: OperationTMCUpdate, db: Session = Depends(get_db)):
    tmc = db.query(OperationTMC).get(tmc_id)
    if not tmc:
        raise HTTPException(404, "TMC not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(tmc, k, v)
    db.commit()
    db.refresh(tmc)
    return tmc


@router.delete("/tmc/{tmc_id}", response_model=MessageResponse)
def delete_tmc(tmc_id: int, db: Session = Depends(get_db)):
    tmc = db.query(OperationTMC).get(tmc_id)
    if not tmc:
        raise HTTPException(404, "TMC not found")
    db.delete(tmc)
    db.commit()
    return MessageResponse(message="Deleted")


# ── AI Fill / Enrich ───────────────────────────────────────────────

@router.post("/fill-components/{model_id}", response_model=MessageResponse)
def fill_components(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    ai_results = yandex_ai.enrich_components_via_vector_store(
        model.normalized_name or model.original_name
    )

    created = 0
    for result in ai_results:
        comp = TORComponent(
            model_id=model_id,
            name=result.get("name", ""),
            component_type=result.get("component_type", "узел"),
            source_type=result.get("source", "vector_store"),
            confidence=result.get("confidence", 0.85),
        )
        db.add(comp)
        created += 1

    db.commit()
    return MessageResponse(message=f"Created {created} components from Vector Store")


@router.post("/enrich-components/{model_id}", response_model=MessageResponse)
def enrich_components(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    class_name = model.eq_class.name if model.eq_class else None
    ai_results = yandex_ai.enrich_components_via_web(
        model.normalized_name or model.original_name, class_name
    )

    created = 0
    for result in ai_results:
        existing = db.query(TORComponent).filter(
            TORComponent.model_id == model_id,
            TORComponent.name == result.get("name"),
        ).first()

        if not existing:
            comp = TORComponent(
                model_id=model_id,
                name=result.get("name", ""),
                component_type=result.get("component_type", "узел"),
                source_type=result.get("source", "yandex_web"),
                confidence=result.get("confidence", 0.7),
            )
            db.add(comp)
            created += 1

    db.commit()
    return MessageResponse(message=f"Enriched {created} components from web")


@router.post("/fill-operations/{component_id}", response_model=MessageResponse)
def fill_operations(component_id: int, db: Session = Depends(get_db)):
    comp = db.query(TORComponent).get(component_id)
    if not comp:
        raise HTTPException(404, "Component not found")

    model = comp.model
    ai_results = yandex_ai.enrich_operations_via_vector_store(comp.name)

    created = 0
    for result in ai_results:
        operation_id = None
        op_name = result.get("name", "")
        if op_name:
            op_norm = normalize_operation_name(op_name)
            op = db.query(Operation).filter(Operation.normalized_name == op_norm).first()
            if op:
                operation_id = op.id

        co = ComponentOperation(
            component_id=component_id,
            operation_id=operation_id,
            custom_name=normalize_operation_name(op_name) if op_name and not operation_id else None,
            profession=result.get("profession"),
            qualification=result.get("qualification"),
            labor_hours=result.get("labor_hours"),
            source_type=result.get("source", "vector_store"),
            confidence=result.get("confidence", 0.85),
        )
        db.add(co)
        created += 1

    db.commit()
    return MessageResponse(message=f"Created {created} operations from Vector Store")


@router.post("/enrich-operations/{component_id}", response_model=MessageResponse)
def enrich_operations(component_id: int, db: Session = Depends(get_db)):
    comp = db.query(TORComponent).get(component_id)
    if not comp:
        raise HTTPException(404, "Component not found")

    model = comp.model
    class_name = model.eq_class.name if model and model.eq_class else None
    ai_results = yandex_ai.enrich_operations_via_web(comp.name, class_name)

    created = 0
    for result in ai_results:
        existing = db.query(ComponentOperation).filter(
            ComponentOperation.component_id == component_id,
            ComponentOperation.custom_name == result.get("name"),
        ).first()

        if not existing:
            operation_id = None
            op_name = result.get("name", "")
            if op_name:
                op_norm = normalize_operation_name(op_name)
                op = db.query(Operation).filter(Operation.normalized_name == op_norm).first()
                if op:
                    operation_id = op.id

            co = ComponentOperation(
                component_id=component_id,
                operation_id=operation_id,
                custom_name=normalize_operation_name(op_name) if op_name and not operation_id else None,
                profession=result.get("profession"),
                qualification=result.get("qualification"),
                labor_hours=result.get("labor_hours"),
                source_type=result.get("source", "yandex_web"),
                confidence=result.get("confidence", 0.7),
            )
            db.add(co)
            created += 1

    db.commit()
    return MessageResponse(message=f"Enriched {created} operations from web")


@router.post("/fill-tmc/{operation_id}", response_model=MessageResponse)
def fill_tmc(operation_id: int, db: Session = Depends(get_db)):
    comp_op = db.query(ComponentOperation).get(operation_id)
    if not comp_op:
        raise HTTPException(404, "Operation not found")

    op_name = comp_op.custom_name or (comp_op.operation.name if comp_op.operation else "")
    ai_results = yandex_ai.enrich_tmc_via_vector_store(op_name)

    created = 0
    for result in ai_results:
        tmc = OperationTMC(
            operation_id=operation_id,
            name=result.get("name", ""),
            code=result.get("code"),
            unit_symbol=result.get("unit_symbol"),
            quantity=result.get("quantity"),
            consumption_rate=result.get("consumption_rate"),
            source_type=result.get("source", "vector_store"),
            confidence=result.get("confidence", 0.85),
        )
        db.add(tmc)
        created += 1

    db.commit()
    return MessageResponse(message=f"Created {created} TMC from Vector Store")


@router.post("/enrich-tmc/{operation_id}", response_model=MessageResponse)
def enrich_tmc(operation_id: int, db: Session = Depends(get_db)):
    comp_op = db.query(ComponentOperation).get(operation_id)
    if not comp_op:
        raise HTTPException(404, "Operation not found")

    op_name = comp_op.custom_name or (comp_op.operation.name if comp_op.operation else "")
    ai_results = yandex_ai.enrich_tmc_via_web(op_name)

    created = 0
    for result in ai_results:
        existing = db.query(OperationTMC).filter(
            OperationTMC.operation_id == operation_id,
            OperationTMC.name == result.get("name"),
        ).first()

        if not existing:
            tmc = OperationTMC(
                operation_id=operation_id,
                name=result.get("name", ""),
                code=result.get("code"),
                unit_symbol=result.get("unit_symbol"),
                quantity=result.get("quantity"),
                consumption_rate=result.get("consumption_rate"),
                source_type=result.get("source", "yandex_web"),
                confidence=result.get("confidence", 0.7),
            )
            db.add(tmc)
            created += 1

    db.commit()
    return MessageResponse(message=f"Enriched {created} TMC from web")


# ── Verify ──────────────────────────────────────────────────────────

@router.post("/verify", response_model=MessageResponse)
def bulk_verify(data: TkVerifyRequest, db: Session = Depends(get_db)):
    count = 0
    if data.component_ids:
        db.query(TORComponent).filter(TORComponent.id.in_(data.component_ids)).update(
            {TORComponent.verified: data.verified}, synchronize_session=False
        )
        count += len(data.component_ids)
    if data.operation_ids:
        db.query(ComponentOperation).filter(ComponentOperation.id.in_(data.operation_ids)).update(
            {ComponentOperation.verified: data.verified}, synchronize_session=False
        )
        count += len(data.operation_ids)
    if data.tmc_ids:
        db.query(OperationTMC).filter(OperationTMC.id.in_(data.tmc_ids)).update(
            {OperationTMC.verified: data.verified}, synchronize_session=False
        )
        count += len(data.tmc_ids)
    db.commit()
    return MessageResponse(message=f"Updated {count} items")


# ── Tools / Reports ────────────────────────────────────────────────

@router.post("/normalize-operations", response_model=MessageResponse)
def normalize_operations_for_model(
    model_id: int = Query(...),
    db: Session = Depends(get_db),
):
    comps = db.query(TORComponent).filter(TORComponent.model_id == model_id).all()
    if not comps:
        return MessageResponse(message="No components")
    comp_ids = [c.id for c in comps]
    ops = db.query(ComponentOperation).filter(ComponentOperation.component_id.in_(comp_ids)).all()
    updated = 0
    for op in ops:
        if op.custom_name:
            norm = normalize_operation_name(op.custom_name)
            if op.custom_name != norm:
                op.custom_name = norm
                updated += 1
    db.commit()
    return MessageResponse(message=f"Normalized {updated} operations")


@router.get("/tmc-summary", response_model=list[dict])
def get_tmc_summary(model_id: int, db: Session = Depends(get_db)):
    comps = db.query(TORComponent).filter(TORComponent.model_id == model_id).all()
    if not comps:
        return []
    comp_ids = [c.id for c in comps]
    ops = db.query(ComponentOperation).filter(ComponentOperation.component_id.in_(comp_ids)).all()
    if not ops:
        return []
    op_ids = [o.id for o in ops]
    items = db.query(OperationTMC).filter(OperationTMC.operation_id.in_(op_ids)).all()

    agg: dict[tuple[str, str | None, str | None], dict] = {}
    for it in items:
        key = (it.name, it.code, it.unit_symbol)
        entry = agg.get(key)
        if not entry:
            entry = {
                "name": it.name,
                "code": it.code,
                "unit_symbol": it.unit_symbol,
                "quantity_sum": 0.0,
                "items_count": 0,
            }
            agg[key] = entry
        if it.quantity is not None:
            entry["quantity_sum"] += float(it.quantity)
        entry["items_count"] += 1
    return sorted(agg.values(), key=lambda x: (-x["items_count"], x["name"]))[:500]


@router.post("/search-aopl-analogs/{tmc_id}", response_model=list[dict])
def search_aopl_analogs(tmc_id: int, limit: int = 5, db: Session = Depends(get_db)):
    base = db.query(OperationTMC).get(tmc_id)
    if not base:
        raise HTTPException(404, "TMC not found")

    base_name = (base.name or "").strip()
    if not base_name:
        return []

    all_items = db.query(OperationTMC).filter(OperationTMC.id != tmc_id).limit(5000).all()

    scored = []
    for it in all_items:
        name = (it.name or "").strip()
        if not name:
            continue
        score = SequenceMatcher(None, base_name, name).ratio()
        if score < 0.5:
            continue
        scored.append(
            {
                "tmc_id": it.id,
                "name": it.name,
                "code": it.code,
                "unit_symbol": it.unit_symbol,
                "match_score": round(score, 3),
                "source": "db",
            }
        )

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored[:limit]
