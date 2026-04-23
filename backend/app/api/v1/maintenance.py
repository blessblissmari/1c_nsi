from calendar import monthrange
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import EquipmentModel, MaintenanceType
from app.schemas.schemas import (
    BulkVerifyRequest,
    MaintenanceTypeCreate,
    MaintenanceTypeRead,
    MaintenanceTypeUpdate,
    MessageResponse,
)
from app.services.ai_service import yandex_ai
from app.services.normalization import normalize_operation_name, parse_periodicity_to_months

router = APIRouter(prefix="/maintenance", tags=["Окно 4 — ВВ и периодичности"])


@router.get("/types", response_model=list[MaintenanceTypeRead])
def get_maintenance_types(
    model_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(MaintenanceType)
    if model_id:
        q = q.filter(MaintenanceType.model_id == model_id)
    return q.offset(skip).limit(limit).all()


@router.post("/types", response_model=MaintenanceTypeRead)
def create_maintenance_type(data: MaintenanceTypeCreate, db: Session = Depends(get_db)):
    mt = MaintenanceType(**data.model_dump())
    if mt.name:
        mt.normalized_name = normalize_operation_name(mt.name)
    if mt.periodicity_months is None and mt.periodicity:
        mt.periodicity_months = parse_periodicity_to_months(mt.periodicity)
    db.add(mt)
    db.commit()
    db.refresh(mt)
    return mt


@router.put("/types/{type_id}", response_model=MaintenanceTypeRead)
def update_maintenance_type(type_id: int, data: MaintenanceTypeUpdate, db: Session = Depends(get_db)):
    mt = db.query(MaintenanceType).get(type_id)
    if not mt:
        raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(mt, k, v)
    if mt.name:
        mt.normalized_name = normalize_operation_name(mt.name)
    if mt.periodicity_months is None and mt.periodicity:
        mt.periodicity_months = parse_periodicity_to_months(mt.periodicity)
    db.commit()
    db.refresh(mt)
    return mt


@router.delete("/types/{type_id}", response_model=MessageResponse)
def delete_maintenance_type(type_id: int, db: Session = Depends(get_db)):
    mt = db.query(MaintenanceType).get(type_id)
    if not mt:
        raise HTTPException(404, "Not found")
    db.delete(mt)
    db.commit()
    return MessageResponse(message="Deleted")


@router.post("/upload-maintenance", response_model=MessageResponse)
async def upload_maintenance(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import os
    import tempfile

    from app.services.file_parser import parse_xlsx

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        rows = parse_xlsx(tmp_path)
        created = 0
        for row in rows:
            model_name = row.get("Модель") or row.get("model") or row.get("Код модели")
            vv_name = (
                row.get("Вид воздействия") or row.get("ВВ") or row.get("name") or row.get("Наименование")
            )
            periodicity = row.get("Периодичность") or row.get("periodicity")

            if not vv_name:
                continue

            model_id = None
            if model_name:
                model = (
                    db.query(EquipmentModel).filter(EquipmentModel.normalized_name == str(model_name)).first()
                )
                if not model:
                    model = (
                        db.query(EquipmentModel)
                        .filter(EquipmentModel.original_name == str(model_name))
                        .first()
                    )
                if model:
                    model_id = model.id

            mt = MaintenanceType(
                model_id=model_id,
                class_id=model.class_id if model_id and model else None,
                subclass_id=model.subclass_id if model_id and model else None,
                name=str(vv_name),
                normalized_name=normalize_operation_name(str(vv_name)),
                periodicity=str(periodicity) if periodicity else None,
                periodicity_months=parse_periodicity_to_months(periodicity),
                source_type="upload",
            )
            db.add(mt)
            created += 1

        db.commit()
        return MessageResponse(message=f"Loaded {created} maintenance types")
    finally:
        os.unlink(tmp_path)


@router.post("/fill-from-source/{model_id}", response_model=MessageResponse)
def fill_from_source(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    ai_results = yandex_ai.enrich_maintenance_via_vector_store(model.normalized_name or model.original_name)

    created = 0
    for result in ai_results:
        mt = MaintenanceType(
            model_id=model_id,
            class_id=model.class_id,
            subclass_id=model.subclass_id,
            name=result.get("name", ""),
            normalized_name=normalize_operation_name(result.get("name", "")),
            periodicity_months=result.get("periodicity_months"),
            periodicity=str(result.get("periodicity_months")) + " мес."
            if result.get("periodicity_months")
            else None,
            source_type=result.get("source", "vector_store"),
            confidence=result.get("confidence", 0.85),
        )
        db.add(mt)
        created += 1

    db.commit()
    return MessageResponse(message=f"Created {created} maintenance types from Vector Store")


@router.post("/enrich-from-web/{model_id}", response_model=MessageResponse)
def enrich_from_web(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    class_name = model.eq_class.name if model.eq_class else None
    ai_results = yandex_ai.enrich_maintenance_via_web(
        model.normalized_name or model.original_name, class_name
    )

    created = 0
    for result in ai_results:
        existing = (
            db.query(MaintenanceType)
            .filter(
                MaintenanceType.model_id == model_id,
                MaintenanceType.name == result.get("name"),
            )
            .first()
        )

        if not existing:
            mt = MaintenanceType(
                model_id=model_id,
                class_id=model.class_id,
                subclass_id=model.subclass_id,
                name=result.get("name", ""),
                normalized_name=normalize_operation_name(result.get("name", "")),
                periodicity_months=result.get("periodicity_months"),
                periodicity=str(result.get("periodicity_months")) + " мес."
                if result.get("periodicity_months")
                else None,
                source_type=result.get("source", "yandex_web"),
                confidence=result.get("confidence", 0.7),
            )
            db.add(mt)
            created += 1

    db.commit()
    return MessageResponse(message=f"Enriched {created} maintenance types from web")


@router.post("/verify", response_model=MessageResponse)
def bulk_verify(data: BulkVerifyRequest, db: Session = Depends(get_db)):
    db.query(MaintenanceType).filter(MaintenanceType.id.in_(data.ids)).update(
        {MaintenanceType.verified: data.verified}, synchronize_session=False
    )
    db.commit()
    return MessageResponse(message=f"Updated {len(data.ids)} items")


def _add_months(d: date, months: int) -> date:
    y = d.year + (d.month - 1 + months) // 12
    m = (d.month - 1 + months) % 12 + 1
    day = min(d.day, monthrange(y, m)[1])
    return date(y, m, day)


@router.get("/ppr-schedule", response_model=dict)
def get_ppr_schedule(
    months_ahead: int = 12,
    db: Session = Depends(get_db),
):
    """
    Build a simple PPR schedule for all TOR models.
    Minimal implementation per TЗ 6.4: show upcoming dates based on periodicity_months.
    """
    today = date.today()
    models = db.query(EquipmentModel).all()
    result: dict[str, Any] = {"generated_at": today.isoformat(), "months_ahead": months_ahead, "items": []}

    for model in models:
        mts = db.query(MaintenanceType).filter(MaintenanceType.model_id == model.id).all()
        if not mts:
            continue
        model_item = {
            "model_id": model.id,
            "model": model.normalized_name or model.original_name,
            "types": [],
        }
        for mt in mts:
            if not mt.periodicity_months or mt.periodicity_months <= 0:
                continue
            step_months = max(1, round(mt.periodicity_months))
            dates = []
            cur = today
            horizon = _add_months(today, months_ahead)
            while cur <= horizon and len(dates) < 24:
                cur = _add_months(cur, step_months)
                if cur <= horizon:
                    dates.append(cur.isoformat())
            model_item["types"].append(
                {
                    "id": mt.id,
                    "name": mt.name,
                    "periodicity_months": mt.periodicity_months,
                    "dates": dates,
                }
            )
        if model_item["types"]:
            result["items"].append(model_item)

    return result
