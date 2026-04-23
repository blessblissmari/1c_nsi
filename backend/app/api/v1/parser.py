"""Document parsing router - AI model card generation from uploaded files"""

import logging
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.models import EquipmentClass, EquipmentModel, HierarchyNode
from app.services.ai_service import yandex_ai
from app.services.parse_jobs import create_parse_job, get_job

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/parse", tags=["parser"])


class ModelCardRequest(BaseModel):
    """Request to generate model card from parsed data"""

    parsed_data: dict = Field(default_factory=dict)
    class_id: int | None = None


class ModelCardPayload(BaseModel):
    """Model card payload coming from AI / frontend edits"""

    original_name: str
    normalized_name: str | None = None
    model_code: str | None = None
    class_id: int | None = None
    class_name: str | None = None
    characteristics: list[dict] = Field(default_factory=list)
    maintenance: list[dict] = Field(default_factory=list)
    reliability: list[dict] = Field(default_factory=list)


class AddToHierarchyRequest(BaseModel):
    card: ModelCardPayload
    parent_node_id: int | None = None


class ModelCardResponse(BaseModel):
    """Generated model card from AI"""

    original_name: str
    normalized_name: str | None
    model_code: str | None
    class_id: int | None
    class_name: str | None
    characteristics: list[dict]
    maintenance: list[dict]
    reliability: list[dict]


@router.post("/document", response_model=dict)
async def parse_document(file: UploadFile = File(...)):
    """Extract text from uploaded document.

    Runs MinerU pipeline in a background thread and returns a job id immediately,
    to avoid frontend timeouts on large scanned PDFs.
    """
    uploads_dir = Path(__file__).resolve().parents[2] / "uploads" / "parse_jobs"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    suffix = os.path.splitext(file.filename)[1] or ".pdf"
    safe_name = (file.filename or f"document{suffix}").replace("\\", "_").replace("/", "_")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=str(uploads_dir)) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    job = create_parse_job(filename=safe_name, file_path=tmp_path)
    return {"status": "accepted", "job_id": job.id, "message": "Document parsing started"}


@router.get("/job/{job_id}", response_model=dict)
async def get_parse_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status == "done":
        extracted_text = job.extracted_text or ""
        if len(extracted_text.strip()) < 10:
            extracted_text = f"[Файл: {job.filename}]"
        return {"status": "success", "data": {"filename": job.filename, "extracted_text": extracted_text}}

    if job.status == "error":
        raise HTTPException(status_code=500, detail=job.error or "Parse failed")

    return {"status": job.status, "job_id": job.id, "filename": job.filename}


@router.post("/generate-card", response_model=ModelCardResponse)
async def generate_model_card(request: ModelCardRequest, db=Depends(get_db)):
    """Generate model card from parsed document data using AI"""
    parsed: dict[str, Any] = request.parsed_data or {}

    # Accept both our own schema (extracted_text) and legacy Mineru-like payloads.
    extracted_text = str(parsed.get("extracted_text") or "")
    if not extracted_text.strip():
        text_content = ""
        if isinstance(parsed.get("texts"), list):
            for page in parsed.get("texts", []):
                if isinstance(page, dict):
                    text_content += str(page.get("text", "")) + "\n"

        tables_content = ""
        if isinstance(parsed.get("tables"), list):
            for table in parsed.get("tables", []):
                if not isinstance(table, dict):
                    continue
                for row in table.get("rows", []) or []:
                    if isinstance(row, list):
                        tables_content += " | ".join([str(c or "") for c in row]) + "\n"

        extracted_text = f"{text_content}\n{tables_content}".strip()

    if len(extracted_text.strip()) < 10:
        raise HTTPException(
            status_code=400, detail="Недостаточно текста для распознавания. Попробуйте другой файл."
        )

    # Ask AI to extract model info
    prompt = f"""Извлеки из технического паспорта информацию о модели оборудования.
Текст документа:
{extracted_text[:8000]}

Ответь СТРОГО в формате JSON:
{{
    "original_name": "наименование из документа",
    "normalized_name": "нормализованное наименование",
    "model_code": "код модели (если есть)",
    "class_name": "класс оборудования (электродвигатель, насос, и т.д.)",
    "characteristics": [{{"name": "характеристика", "value": "значение", "unit": "ед.изм."}}],
    "maintenance": [{{"name": "вид ТО", "periodicity_months": число}}],
    "reliability": [{{"name": "показатель", "value": число}}]
}}

Если не можешь определить - используй null."""

    ai_result = yandex_ai._call_with_web_search(prompt, temperature=0.3)
    if not ai_result:
        raise HTTPException(500, "Failed to generate model card")

    # Parse AI response
    import json

    try:
        card_data = json.loads(ai_result)
    except (json.JSONDecodeError, TypeError):
        card_data = {"original_name": "Не удалось распознать", "error": ai_result[:200]}

    # Find or create class
    class_id = request.class_id
    if class_id is None and card_data.get("class_name"):
        eq_class = (
            db.query(EquipmentClass).filter(EquipmentClass.name.ilike(f"%{card_data['class_name']}%")).first()
        )
        if eq_class:
            class_id = eq_class.id

    return ModelCardResponse(
        original_name=card_data.get("original_name", ""),
        normalized_name=card_data.get("normalized_name"),
        model_code=card_data.get("model_code"),
        class_id=class_id,
        class_name=card_data.get("class_name"),
        characteristics=card_data.get("characteristics", []),
        maintenance=card_data.get("maintenance", []),
        reliability=card_data.get("reliability", []),
    )


@router.post("/add-to-hierarchy", response_model=dict)
async def add_model_to_hierarchy(
    request: AddToHierarchyRequest,
    db=Depends(get_db),
):
    """Add generated model to hierarchy"""
    card_data = request.card

    # Create model
    model = EquipmentModel(
        original_name=card_data.original_name,
        normalized_name=card_data.normalized_name,
        model_code=card_data.model_code,
        class_id=card_data.class_id,
        source_type="parsed",
    )
    db.add(model)
    db.commit()
    db.refresh(model)

    # Create hierarchy node if parent specified
    if request.parent_node_id:
        node = HierarchyNode(
            name=card_data.normalized_name or card_data.original_name,
            level_type="model",
            parent_id=request.parent_node_id,
            model_id=model.id,
        )
        db.add(node)
        db.commit()

    return {
        "status": "success",
        "model_id": model.id,
        "message": f"Модель '{model.original_name}' добавлена в иерархию",
    }
