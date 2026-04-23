import re
from difflib import SequenceMatcher

from sqlalchemy.orm import Session

from app.models.models import ClassificationRule, EquipmentClass, EquipmentModel
from app.services.normalization import normalize_model_name


def _norm_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def _model_key(value: str | None) -> str:
    if not value:
        return ""
    return normalize_model_name(str(value))


def classify_model_by_classifier(model: EquipmentModel, db: Session) -> EquipmentModel | None:
    """Deterministic classification by uploaded classifier mappings."""
    if not model.normalized_name and not model.original_name:
        return None

    key = _model_key(model.normalized_name or model.original_name)
    if not key:
        return None

    rules = db.query(ClassificationRule).all()
    if rules:
        exact = next((r for r in rules if _model_key(r.normalized_pattern or r.model_pattern) == key), None)
        if exact:
            model.class_id = exact.class_id
            model.subclass_id = exact.subclass_id
            model.source_type = "classifier"
            model.confidence = 1.0
            return model

        best_rule = None
        best_score = 0.0
        for rule in rules:
            pattern = _model_key(rule.normalized_pattern or rule.model_pattern)
            if not pattern:
                continue
            score = SequenceMatcher(None, key, pattern).ratio()
            if score > best_score:
                best_score = score
                best_rule = rule

        if best_rule and best_score >= 0.92:
            model.class_id = best_rule.class_id
            model.subclass_id = best_rule.subclass_id
            model.source_type = "classifier_fuzzy"
            model.confidence = round(best_score, 3)
            return model

    return _classify_by_names_fallback(model, db, key)


def classify_all_models(db: Session) -> dict:
    models = db.query(EquipmentModel).all()

    classified = 0
    unclassified = 0
    for model in models:
        result = classify_model_by_classifier(model, db)
        if result:
            classified += 1
        else:
            unclassified += 1

    db.commit()
    return {"classified": classified, "unclassified": unclassified}


def _classify_by_names_fallback(model: EquipmentModel, db: Session, model_key: str) -> EquipmentModel | None:
    classes = db.query(EquipmentClass).all()
    best_class = None
    best_subclass = None
    best_score = 0.0

    for cls in classes:
        subclasses = cls.subclasses or []
        if not subclasses:
            score = _match_score(model_key, cls.name, "")
            if score > best_score:
                best_score = score
                best_class = cls
                best_subclass = None
            continue

        for subclass in subclasses:
            score = _match_score(model_key, cls.name, subclass.name)
            if score > best_score:
                best_score = score
                best_class = cls
                best_subclass = subclass

    if best_score >= 0.62 and best_class:
        model.class_id = best_class.id
        model.subclass_id = best_subclass.id if best_subclass else None
        model.source_type = "classifier_name_match"
        model.confidence = round(best_score, 3)
        return model

    return None


def _match_score(model_name: str, class_name: str, subclass_name: str) -> float:
    model_upper = model_name.upper()
    class_keywords = _extract_keywords(class_name.upper())
    subclass_keywords = _extract_keywords(subclass_name.upper())

    score = 0.0
    for kw in class_keywords:
        if kw in model_upper:
            score += 0.18
    for kw in subclass_keywords:
        if kw in model_upper:
            score += 0.24

    full_match = f"{class_name} {subclass_name}".strip().upper()
    if full_match:
        score += SequenceMatcher(None, model_upper, full_match).ratio() * 0.25
    return min(score, 1.0)


def _extract_keywords(text: str) -> list[str]:
    stop_words = {"И", "В", "НА", "С", "ПО", "ДЛЯ", "ОТ", "К", "У", "О", "А", "НО", "ИЛИ"}
    words = re.findall(r"[А-ЯA-Z0-9-]+", text)
    return [w for w in words if w not in stop_words and len(w) > 1]
