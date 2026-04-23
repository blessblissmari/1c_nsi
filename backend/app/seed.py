import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal, init_db
from app.models.models import (
    EquipmentClass, EquipmentSubclass, EquipmentModel, Characteristic, Unit,
    NormalizationRule, Operation, HierarchyNode, MaintenanceType,
    TORComponent, ComponentOperation,
)
from app.services.file_parser import parse_xlsx
from app.services.normalization import normalize_model_name, normalize_operation_name, normalize_class_name
from loguru import logger


SEED_DIR = Path(__file__).resolve().parent.parent.parent / "ДОКУМЕНТЫ ДЛЯ РАБОТЫ"


def seed_classes_and_subclasses(db):
    file_path = SEED_DIR / "Классификатор.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created_c = 0
    created_s = 0
    created_char = 0
    created_u = 0

    for row in rows:
        class_name = row.get("Класс") or row.get("Класс оборудования")
        subclass_name = row.get("Подкласс") or row.get("Подкласс оборудования")

        if not class_name:
            continue

        class_name = normalize_class_name(str(class_name))

        cls = db.query(EquipmentClass).filter(EquipmentClass.name == class_name).first()
        if not cls:
            cls = EquipmentClass(name=class_name)
            db.add(cls)
            db.flush()
            created_c += 1

        sub = None
        if subclass_name:
            subclass_name = normalize_class_name(str(subclass_name))
            sub = db.query(EquipmentSubclass).filter(
                EquipmentSubclass.name == subclass_name,
                EquipmentSubclass.class_id == cls.id,
            ).first()
            if not sub:
                sub = EquipmentSubclass(name=subclass_name, class_id=cls.id)
                db.add(sub)
                db.flush()
                created_s += 1

        for i in range(1, 6):
            char_name = row.get(f"Характеристика {i}")
            unit_name = row.get(f"Ед.измерения {i}")

            if not char_name or str(char_name).strip() == "":
                continue

            char_name = str(char_name).strip()
            unit_id = None

            if unit_name and str(unit_name).strip():
                unit_name_str = str(unit_name).strip()
                unit = db.query(Unit).filter(Unit.name == unit_name_str).first()
                if not unit:
                    unit = Unit(name=unit_name_str, symbol=unit_name_str)
                    db.add(unit)
                    db.flush()
                    created_u += 1
                unit_id = unit.id

            existing = db.query(Characteristic).filter(
                Characteristic.name == char_name,
                Characteristic.class_id == cls.id,
                Characteristic.subclass_id == sub.id if sub else None,
            ).first()
            if not existing:
                char = Characteristic(
                    name=char_name,
                    unit_id=unit_id,
                    class_id=cls.id,
                    subclass_id=sub.id if sub else None,
                )
                db.add(char)
                created_char += 1

    db.commit()
    logger.info(f"Seeded {created_c} classes, {created_s} subclasses, {created_char} characteristics, {created_u} units from Classifier")


def seed_models(db):
    file_path = SEED_DIR / "Иерархия с моделями.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created = 0

    for row in rows:
        model_name = row.get("Модель")
        if model_name is None:
            continue

        model_name = str(model_name).strip()
        if not model_name:
            continue

        existing = db.query(EquipmentModel).filter(
            EquipmentModel.original_name == model_name
        ).first()

        if not existing:
            norm_name = normalize_model_name(model_name)
            model = EquipmentModel(
                original_name=model_name,
                normalized_name=norm_name,
                model_code=norm_name,
            )
            db.add(model)
            created += 1

    db.commit()
    logger.info(f"Seeded {created} models")


def seed_hierarchy(db):
    file_path = SEED_DIR / "Иерархия с моделями.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    level_names = [f"Уровень {i}" for i in range(1, 8)]
    created = 0

    for row in rows:
        parent_id = None
        for lvl_name in level_names:
            lvl_val = row.get(lvl_name)
            if lvl_val is None:
                continue
            q = db.query(HierarchyNode).filter(
                HierarchyNode.name == str(lvl_val),
            )
            if parent_id is None:
                q = q.filter(HierarchyNode.parent_id.is_(None))
            else:
                q = q.filter(HierarchyNode.parent_id == parent_id)
            existing = q.first()
            if not existing:
                node = HierarchyNode(name=str(lvl_val), level_type=lvl_name, parent_id=parent_id)
                db.add(node)
                db.flush()
                existing = node
                created += 1
            parent_id = existing.id

    db.commit()
    logger.info(f"Seeded {created} hierarchy nodes")


def seed_classification(db):
    file_path = SEED_DIR / "Классификация моделей.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    updated = 0

    for row in rows:
        model_name = row.get("Модель до нормализации") or row.get("Модель") or row.get("Код модели")
        class_name = row.get("Класс") or row.get("Класс оборудования")
        subclass_name = row.get("Подкласс") or row.get("Подкласс оборудования")

        if not model_name or not class_name:
            continue

        norm_name = normalize_model_name(str(model_name))
        model = db.query(EquipmentModel).filter(
            (EquipmentModel.normalized_name == norm_name) |
            (EquipmentModel.original_name == str(model_name))
        ).first()

        if not model:
            continue

        cls = db.query(EquipmentClass).filter(EquipmentClass.name == normalize_class_name(str(class_name))).first()
        if cls:
            model.class_id = cls.id

            if subclass_name:
                sub = db.query(EquipmentSubclass).filter(
                    EquipmentSubclass.name == normalize_class_name(str(subclass_name)),
                    EquipmentSubclass.class_id == cls.id,
                ).first()
                if sub:
                    model.subclass_id = sub.id

            model.source_type = "seed_file"
            model.confidence = 0.95
            updated += 1

    db.commit()
    logger.info(f"Seeded classification for {updated} models")


def seed_normalization_rules(db):
    file_path = SEED_DIR / "Нормализация моделей.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created = 0

    for row in rows:
        before = row.get("Модель до нормализации") or row.get("Шаблон")
        after = row.get("Модель после нормализации") or row.get("Замена") or ""
        description = row.get("Описание")

        if not before:
            continue

        rule = NormalizationRule(
            rule_type="model",
            pattern=str(before),
            replacement=str(after),
            description=str(description) if description else None,
        )
        db.add(rule)
        created += 1

    db.commit()
    logger.info(f"Seeded {created} normalization rules")


def seed_characteristics(db):
    file_path = SEED_DIR / "Справочник характеристик и ед. измерения (основные).xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created_c = 0
    created_u = 0

    for row in rows:
        name = row.get("Физическая величина") or row.get("Характеристика") or row.get("Наименование")
        unit_name = row.get("Единица измерения") or row.get("Ед.изм.")
        unit_symbol = row.get("Российское обозначение") or row.get("Обозначение")

        if not name:
            continue

        unit_id = None
        if unit_name:
            unit = db.query(Unit).filter(Unit.name == str(unit_name)).first()
            if not unit:
                unit = Unit(
                    name=str(unit_name),
                    symbol=str(unit_symbol or unit_name),
                )
                db.add(unit)
                db.flush()
                created_u += 1
            unit_id = unit.id

        existing = db.query(Characteristic).filter(Characteristic.name == str(name)).first()
        if not existing:
            char = Characteristic(name=str(name), unit_id=unit_id)
            db.add(char)
            created_c += 1

    db.commit()
    logger.info(f"Seeded {created_c} characteristics, {created_u} units")


def seed_operations(db):
    file_path = SEED_DIR / "Справочник операций.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created = 0

    for row in rows:
        name = row.get("Наименование операции") or row.get("Операция") or row.get("Наименование")
        if not name:
            continue

        norm_name = normalize_operation_name(str(name))
        existing = db.query(Operation).filter(Operation.name == str(name)).first()
        if not existing:
            op = Operation(name=str(name), normalized_name=norm_name)
            db.add(op)
            created += 1

    db.commit()
    logger.info(f"Seeded {created} operations")


def seed_maintenance_types(db):
    file_path = SEED_DIR / "Справочник ВВ и периодичностей.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created = 0

    for row in rows:
        name = row.get("Вид воздействия") or row.get("ВВ") or row.get("Наименование")
        periodicity = row.get("Периодичность")

        if not name:
            continue

        norm_name = normalize_operation_name(str(name))

        existing = db.query(MaintenanceType).filter(
            MaintenanceType.normalized_name == norm_name,
            MaintenanceType.model_id.is_(None),
            MaintenanceType.class_id.is_(None),
        ).first()

        if not existing:
            mt = MaintenanceType(
                model_id=None,
                class_id=None,
                name=str(name),
                normalized_name=norm_name,
                periodicity=str(periodicity) if periodicity else None,
                source_type="seed",
            )
            db.add(mt)
            created += 1

    db.commit()
    logger.info(f"Seeded {created} generic maintenance types")


def seed_model_maintenance(db):
    file_path = SEED_DIR / "Виды воздействия на ТОР ист.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created = 0

    for row in rows:
        model_name = row.get("Модель")
        if not model_name:
            continue

        norm = normalize_model_name(str(model_name))
        model = db.query(EquipmentModel).filter(
            (EquipmentModel.normalized_name == norm) |
            (EquipmentModel.original_name == str(model_name))
        ).first()
        if not model:
            continue

        for i in range(1, 10):
            vv_name = row.get(f"ВВ {i}")
            vv_period = row.get(f"Периодичность {i}")
            if not vv_name:
                continue

            norm_vv = normalize_operation_name(str(vv_name))
            existing = db.query(MaintenanceType).filter(
                MaintenanceType.model_id == model.id,
                MaintenanceType.normalized_name == norm_vv,
            ).first()

            if not existing:
                mt = MaintenanceType(
                    model_id=model.id,
                    class_id=model.class_id,
                    subclass_id=model.subclass_id,
                    name=str(vv_name),
                    normalized_name=norm_vv,
                    periodicity=str(vv_period) if vv_period else None,
                    source_type="seed_file",
                    confidence=0.9,
                )
                db.add(mt)
                created += 1

    db.commit()
    logger.info(f"Seeded {created} model-specific maintenance types")


def seed_tor_components(db):
    file_path = SEED_DIR / "Компоненты из источников на ТОР.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created = 0

    for row in rows:
        class_name = row.get("Класс")
        subclass_name = row.get("Подкласс")
        element = row.get("Элемент")
        subelement = row.get("Подэлемент")

        if not class_name:
            continue

        cls = db.query(EquipmentClass).filter(
            EquipmentClass.name == normalize_class_name(str(class_name))
        ).first()

        if not cls:
            continue

        sub = None
        if subclass_name:
            sub = db.query(EquipmentSubclass).filter(
                EquipmentSubclass.name == normalize_class_name(str(subclass_name)),
                EquipmentSubclass.class_id == cls.id,
            ).first()

        models_q = db.query(EquipmentModel).filter(EquipmentModel.class_id == cls.id)
        if sub:
            models_q = models_q.filter(EquipmentModel.subclass_id == sub.id)
        models = models_q.all()

        if not element:
            continue

        for model in models:
            existing_parent = db.query(TORComponent).filter(
                TORComponent.model_id == model.id,
                TORComponent.name == str(element),
                TORComponent.parent_id.is_(None),
            ).first()
            if not existing_parent:
                comp = TORComponent(
                    model_id=model.id,
                    name=str(element),
                    component_type="element",
                    source_type="seed_file",
                    confidence=0.9,
                )
                db.add(comp)
                db.flush()
                existing_parent = comp
                created += 1

            if subelement and str(subelement).strip():
                existing_child = db.query(TORComponent).filter(
                    TORComponent.model_id == model.id,
                    TORComponent.name == str(subelement),
                    TORComponent.parent_id == existing_parent.id,
                ).first()
                if not existing_child:
                    comp = TORComponent(
                        model_id=model.id,
                        parent_id=existing_parent.id,
                        name=str(subelement),
                        component_type="subelement",
                        source_type="seed_file",
                        confidence=0.9,
                    )
                    db.add(comp)
                    created += 1

    db.commit()
    logger.info(f"Seeded {created} TOR components")


def seed_component_operations(db):
    file_path = SEED_DIR / "Операции на компоненты ТОР из источников.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created = 0

    for row in rows:
        class_name = row.get("Класс")
        subclass_name = row.get("Подкласс")
        element = row.get("Элемент")
        subelement = row.get("Подэлемент")
        operation_name = row.get("Операция")

        if not operation_name or not class_name:
            continue

        op = db.query(Operation).filter(
            Operation.name == str(operation_name)
        ).first()

        cls = db.query(EquipmentClass).filter(
            EquipmentClass.name == normalize_class_name(str(class_name))
        ).first()
        if not cls:
            continue

        sub = None
        if subclass_name:
            sub = db.query(EquipmentSubclass).filter(
                EquipmentSubclass.name == normalize_class_name(str(subclass_name)),
                EquipmentSubclass.class_id == cls.id,
            ).first()

        models_q = db.query(EquipmentModel).filter(EquipmentModel.class_id == cls.id)
        if sub:
            models_q = models_q.filter(EquipmentModel.subclass_id == sub.id)
        models = models_q.all()

        for model in models:
            comp_q = db.query(TORComponent).filter(TORComponent.model_id == model.id)
            if element:
                comp_q = comp_q.filter(TORComponent.name == str(element))
            if subelement and str(subelement).strip():
                comp_q = comp_q.filter(TORComponent.name == str(subelement))
            comp = comp_q.first()

            if not comp:
                continue

            existing = db.query(ComponentOperation).filter(
                ComponentOperation.component_id == comp.id,
                ComponentOperation.operation_id == op.id if op else None,
            ).first()

            if not existing:
                co = ComponentOperation(
                    component_id=comp.id,
                    operation_id=op.id if op else None,
                    custom_name=str(operation_name) if not op else None,
                    source_type="seed_file",
                    confidence=0.85,
                )
                db.add(co)
                created += 1

    db.commit()
    logger.info(f"Seeded {created} component operations")


def seed_units(db):
    file_path = SEED_DIR / "Характеристики и ед. измерения.xlsx"
    if not file_path.exists():
        logger.warning(f"File not found: {file_path}")
        return

    rows = parse_xlsx(file_path)
    created = 0

    for row in rows:
        unit_name = row.get("Единица измерения") or row.get("Ед.изм.")
        unit_symbol = row.get("Российское обозначение") or row.get("Обозначение") or unit_name

        if not unit_name:
            continue

        existing = db.query(Unit).filter(Unit.name == str(unit_name)).first()
        if not existing:
            unit = Unit(name=str(unit_name), symbol=str(unit_symbol or unit_name))
            db.add(unit)
            created += 1

    db.commit()
    logger.info(f"Seeded {created} units from characteristics file")


def seed_all():
    logger.info("Initializing database...")
    init_db()

    db = SessionLocal()
    try:
        logger.info("Seeding hierarchy...")
        seed_hierarchy(db)

        logger.info("Seeding classes and subclasses...")
        seed_classes_and_subclasses(db)

        logger.info("Seeding normalization rules...")
        seed_normalization_rules(db)

        logger.info("Seeding models...")
        seed_models(db)

        logger.info("Seeding classification...")
        seed_classification(db)

        logger.info("Seeding units...")
        seed_units(db)

        logger.info("Seeding characteristics...")
        seed_characteristics(db)

        logger.info("Seeding operations...")
        seed_operations(db)

        logger.info("Seeding generic maintenance types...")
        seed_maintenance_types(db)

        logger.info("Seeding model-specific maintenance types...")
        seed_model_maintenance(db)

        logger.info("Seeding TOR components...")
        seed_tor_components(db)

        logger.info("Seeding component operations...")
        seed_component_operations(db)

        logger.info("Seeding complete!")
    except Exception as e:
        logger.error(f"Seed error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
