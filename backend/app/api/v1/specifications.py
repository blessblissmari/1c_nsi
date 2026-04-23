from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import (
    APLItem,
    BOMItem,
    EquipmentModel,
)
from app.schemas.schemas import (
    APLItemCreate,
    APLItemRead,
    BOMItemCreate,
    BOMItemRead,
    BulkVerifyRequest,
    MessageResponse,
)
from app.services.ai_service import yandex_ai

router = APIRouter(prefix="/specifications", tags=["Окно 6 — Спецификации"])


@router.get("/bom/{model_id}", response_model=list[BOMItemRead])
def get_bom(model_id: int, db: Session = Depends(get_db)):
    return db.query(BOMItem).filter(BOMItem.model_id == model_id).all()


@router.post("/bom", response_model=BOMItemRead)
def create_bom_item(data: BOMItemCreate, db: Session = Depends(get_db)):
    item = BOMItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/bom-from-source/{model_id}", response_model=MessageResponse)
def generate_bom_from_source(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    model_name = model.normalized_name or model.original_name
    class_name = model.eq_class.name if model.eq_class else None

    yandex_ai.enrich_characteristics_via_vector_store(model_name, ["BOM спецификация"])
    bom_data = yandex_ai.generate_bom_via_web(model_name, class_name)

    created = 0
    for item in bom_data:
        bom = BOMItem(
            model_id=model_id,
            name=item.get("name", ""),
            code=item.get("code"),
            quantity=item.get("quantity"),
            unit_symbol=item.get("unit_symbol"),
            source_type=item.get("source", "yandex_web"),
            confidence=item.get("confidence", 0.6),
        )
        db.add(bom)
        created += 1

    db.commit()
    return MessageResponse(message=f"Generated {created} BOM items")


@router.post("/bom-from-web/{model_id}", response_model=MessageResponse)
def generate_bom_from_web(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    model_name = model.normalized_name or model.original_name
    class_name = model.eq_class.name if model.eq_class else None

    bom_data = yandex_ai.generate_bom_via_web(model_name, class_name)

    created = 0
    for item in bom_data:
        existing = (
            db.query(BOMItem)
            .filter(
                BOMItem.model_id == model_id,
                BOMItem.name == item.get("name"),
            )
            .first()
        )
        if not existing:
            bom = BOMItem(
                model_id=model_id,
                name=item.get("name", ""),
                code=item.get("code"),
                quantity=item.get("quantity"),
                unit_symbol=item.get("unit_symbol"),
                source_type=item.get("source", "yandex_web"),
                confidence=item.get("confidence", 0.6),
            )
            db.add(bom)
            created += 1

    db.commit()
    return MessageResponse(message=f"Generated {created} BOM items from web")


@router.post("/search-bom-analogs/{item_id}")
def search_bom_analogs(item_id: int, db: Session = Depends(get_db)):
    item = db.query(BOMItem).get(item_id)
    if not item:
        raise HTTPException(404, "BOM item not found")

    results = yandex_ai.search_analogs(item.name)
    if results:
        best = results[0]
        item.analog_code = best.get("model")
        item.analog_name = best.get("model")
        db.commit()

    return results


@router.get("/apl/{model_id}", response_model=list[APLItemRead])
def get_apl(model_id: int, db: Session = Depends(get_db)):
    return db.query(APLItem).filter(APLItem.model_id == model_id).all()


@router.post("/apl", response_model=APLItemRead)
def create_apl_item(data: APLItemCreate, db: Session = Depends(get_db)):
    item = APLItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/apl-from-source/{model_id}", response_model=MessageResponse)
def generate_apl_from_source(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    model_name = model.normalized_name or model.original_name
    class_name = model.eq_class.name if model.eq_class else None

    apl_data = yandex_ai.generate_apl_via_web(model_name, class_name)

    created = 0
    for item in apl_data:
        apl = APLItem(
            model_id=model_id,
            name=item.get("name", ""),
            code=item.get("code"),
            quantity=item.get("quantity"),
            unit_symbol=item.get("unit_symbol"),
            source_type=item.get("source", "yandex_web"),
            confidence=item.get("confidence", 0.6),
        )
        db.add(apl)
        created += 1

    db.commit()
    return MessageResponse(message=f"Generated {created} APL items")


@router.post("/apl-from-web/{model_id}", response_model=MessageResponse)
def generate_apl_from_web(model_id: int, db: Session = Depends(get_db)):
    model = db.query(EquipmentModel).get(model_id)
    if not model:
        raise HTTPException(404, "Model not found")

    model_name = model.normalized_name or model.original_name
    class_name = model.eq_class.name if model.eq_class else None

    apl_data = yandex_ai.generate_apl_via_web(model_name, class_name)

    created = 0
    for item in apl_data:
        existing = (
            db.query(APLItem)
            .filter(
                APLItem.model_id == model_id,
                APLItem.name == item.get("name"),
            )
            .first()
        )
        if not existing:
            apl = APLItem(
                model_id=model_id,
                name=item.get("name", ""),
                code=item.get("code"),
                quantity=item.get("quantity"),
                unit_symbol=item.get("unit_symbol"),
                source_type=item.get("source", "yandex_web"),
                confidence=item.get("confidence", 0.6),
            )
            db.add(apl)
            created += 1

    db.commit()
    return MessageResponse(message=f"Generated {created} APL items from web")


@router.post("/search-apl-analogs/{item_id}")
def search_apl_analogs(item_id: int, db: Session = Depends(get_db)):
    item = db.query(APLItem).get(item_id)
    if not item:
        raise HTTPException(404, "APL item not found")

    results = yandex_ai.search_analogs(item.name)
    if results:
        best = results[0]
        item.analog_code = best.get("model")
        item.analog_name = best.get("model")
        db.commit()

    return results


@router.post("/verify-bom", response_model=MessageResponse)
def bulk_verify_bom(data: BulkVerifyRequest, db: Session = Depends(get_db)):
    db.query(BOMItem).filter(BOMItem.id.in_(data.ids)).update(
        {BOMItem.verified: data.verified}, synchronize_session=False
    )
    db.commit()
    return MessageResponse(message=f"Updated {len(data.ids)} items")


@router.post("/verify-apl", response_model=MessageResponse)
def bulk_verify_apl(data: BulkVerifyRequest, db: Session = Depends(get_db)):
    db.query(APLItem).filter(APLItem.id.in_(data.ids)).update(
        {APLItem.verified: data.verified}, synchronize_session=False
    )
    db.commit()
    return MessageResponse(message=f"Updated {len(data.ids)} items")
