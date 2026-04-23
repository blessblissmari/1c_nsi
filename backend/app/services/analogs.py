from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

from sqlalchemy.orm import Session

from app.models.models import EquipmentModel, TORCharacteristic


@dataclass(frozen=True)
class AnalogCandidate:
    model_id: int
    model: str
    match_score: float
    differences: str | None
    compare: list[dict[str, Any]]
    source: str


def _ratio(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def search_analogs_in_db(
    db: Session,
    base_model: EquipmentModel,
    characteristics: dict[str, str] | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """
    Deterministic analog search:
    - never invents manufacturers/specs
    - returns only models that already exist in our DB
    """
    base_name = (base_model.normalized_name or base_model.original_name or "").strip()
    if not base_name:
        return []

    q = db.query(EquipmentModel).filter(EquipmentModel.id != base_model.id)
    if base_model.class_id:
        q = q.filter(EquipmentModel.class_id == base_model.class_id)

    candidates = q.limit(5000).all()

    # Preload characteristics only when asked (otherwise score by name only).
    selected_char_names = list(characteristics.keys()) if characteristics else []
    cand_char_map: dict[int, dict[str, str]] = {}
    if selected_char_names:
        cand_rows = (
            db.query(TORCharacteristic)
            .filter(TORCharacteristic.model_id.in_([c.id for c in candidates]))
            .all()
        )
        for row in cand_rows:
            if not row.characteristic or row.value is None:
                continue
            cand_char_map.setdefault(row.model_id, {})[row.characteristic.name] = str(row.value)

    # Base model non-selected characteristics for visual comparison (per TЗ).
    base_compare: dict[str, str] = {}
    base_rows = (
        db.query(TORCharacteristic)
        .filter(TORCharacteristic.model_id == base_model.id, TORCharacteristic.value.isnot(None))
        .all()
    )
    for row in base_rows:
        if not row.characteristic or row.value is None:
            continue
        name = row.characteristic.name
        if selected_char_names and name in selected_char_names:
            continue
        base_compare[name] = str(row.value)

    scored: list[AnalogCandidate] = []
    for candidate in candidates:
        cand_name = (candidate.normalized_name or candidate.original_name or "").strip()
        if not cand_name:
            continue

        name_score = _ratio(base_name, cand_name)
        score = name_score
        diffs: list[str] = []

        if selected_char_names:
            base_chars = characteristics or {}
            cand_chars = cand_char_map.get(candidate.id, {})
            matched = 0
            compared = 0
            for key, base_val in base_chars.items():
                base_val_s = str(base_val).strip()
                cand_val_s = str(cand_chars.get(key, "")).strip()
                if not base_val_s or not cand_val_s:
                    continue
                compared += 1
                if base_val_s == cand_val_s:
                    matched += 1
                else:
                    diffs.append(f"{key}: {base_val_s} != {cand_val_s}")
            char_score = (matched / compared) if compared else 0.0
            score = 0.7 * name_score + 0.3 * char_score

        # Build "comparison" only for non-selected characteristics (TЗ requirement).
        compare_items: list[dict[str, Any]] = []
        if base_compare:
            cand_non_selected = cand_char_map.get(candidate.id, {})
            for key, base_val in list(base_compare.items())[:12]:
                cand_val = cand_non_selected.get(key)
                if cand_val is None:
                    continue
                if str(base_val).strip() == str(cand_val).strip():
                    continue
                compare_items.append(
                    {"name": key, "base_value": base_val, "candidate_value": cand_val}
                )

        if score < 0.35:
            continue

        scored.append(
            AnalogCandidate(
                model_id=candidate.id,
                model=candidate.normalized_name or candidate.original_name,
                match_score=round(score, 3),
                differences="; ".join(diffs) if diffs else None,
                compare=compare_items,
                source="db",
            )
        )

    scored.sort(key=lambda x: x.match_score, reverse=True)
    return [
        {
            "model_id": item.model_id,
            "model": item.model,
            "match_score": item.match_score,
            "differences": item.differences,
            "compare": item.compare,
            "source": item.source,
        }
        for item in scored[:limit]
    ]
