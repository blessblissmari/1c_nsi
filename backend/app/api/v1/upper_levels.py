from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Any

from app.database import get_db
from app.models.models import HierarchyNode
from app.schemas.schemas import MessageResponse

router = APIRouter(prefix="/upper-levels", tags=["Окно 2 — Карточки верхних уровней"])


@router.get("/cards/{node_id}")
def get_card(node_id: int, db: Session = Depends(get_db)):
    node = db.query(HierarchyNode).get(node_id)
    if not node:
        raise HTTPException(404, "Node not found")

    return {
        "id": node.id,
        "name": node.name,
        "level_type": node.level_type,
        "description": node.description,
        "custom_fields": node.custom_fields or {},
        "parent_id": node.parent_id,
        "children_count": len(node.children) if node.children else 0,
    }


@router.put("/cards/{node_id}")
def update_card(node_id: int, data: dict[str, Any], db: Session = Depends(get_db)):
    node = db.query(HierarchyNode).get(node_id)
    if not node:
        raise HTTPException(404, "Node not found")

    if "description" in data:
        node.description = data["description"]
    if "custom_fields" in data:
        node.custom_fields = data["custom_fields"]

    db.commit()
    db.refresh(node)
    return {
        "id": node.id,
        "name": node.name,
        "level_type": node.level_type,
        "description": node.description,
        "custom_fields": node.custom_fields or {},
    }
