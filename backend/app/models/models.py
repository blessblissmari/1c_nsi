from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, ForeignKey, DateTime, JSON,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime, UTC

from app.database import Base


class HierarchyNode(Base):
    __tablename__ = "hierarchy_nodes"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("hierarchy_nodes.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(500))
    level_type: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    parent = relationship("HierarchyNode", remote_side=[id], backref="children")
    models = relationship("EquipmentModel", back_populates="hierarchy_node")


class EquipmentClass(Base):
    __tablename__ = "equipment_classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(300), unique=True)

    subclasses: Mapped[list["EquipmentSubclass"]] = relationship(back_populates="cls")


class EquipmentSubclass(Base):
    __tablename__ = "equipment_subclasses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(300))
    class_id: Mapped[int] = mapped_column(ForeignKey("equipment_classes.id"))

    cls: Mapped["EquipmentClass"] = relationship(back_populates="subclasses")


class ClassificationRule(Base):
    __tablename__ = "classification_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_pattern: Mapped[str] = mapped_column(String(500), unique=True)
    normalized_pattern: Mapped[str | None] = mapped_column(String(500), nullable=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("equipment_classes.id"))
    subclass_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_subclasses.id"), nullable=True)
    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    eq_class = relationship("EquipmentClass")
    eq_subclass = relationship("EquipmentSubclass")


class EquipmentModel(Base):
    __tablename__ = "equipment_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    hierarchy_id: Mapped[int | None] = mapped_column(ForeignKey("hierarchy_nodes.id"), nullable=True)
    original_name: Mapped[str] = mapped_column(String(500))
    normalized_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    model_code: Mapped[str | None] = mapped_column(String(200), nullable=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_classes.id"), nullable=True)
    subclass_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_subclasses.id"), nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    hierarchy_node = relationship("HierarchyNode", back_populates="models")
    eq_class = relationship("EquipmentClass")
    eq_subclass = relationship("EquipmentSubclass")
    documents = relationship("Document", back_populates="model")
    characteristics = relationship("TORCharacteristic", back_populates="model", cascade="all, delete-orphan")
    maintenance_types = relationship("MaintenanceType", back_populates="model", cascade="all, delete-orphan")
    bom_items = relationship("BOMItem", back_populates="model", cascade="all, delete-orphan")
    apl_items = relationship("APLItem", back_populates="model", cascade="all, delete-orphan")
    components = relationship("TORComponent", back_populates="model", cascade="all, delete-orphan")
    reliability_metrics = relationship("ReliabilityMetric", back_populates="model", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("equipment_models.id"))
    filename: Mapped[str] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(50))
    file_path: Mapped[str] = mapped_column(Text)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    priority: Mapped[int] = mapped_column(Integer, default=0)
    parsed_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    model = relationship("EquipmentModel", back_populates="documents")


class Characteristic(Base):
    __tablename__ = "characteristics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(300))
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("units.id"), nullable=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_classes.id"), nullable=True)
    subclass_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_subclasses.id"), nullable=True)

    unit = relationship("Unit")
    tor_values = relationship("TORCharacteristic", back_populates="characteristic")


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    symbol: Mapped[str] = mapped_column(String(50))
    conversion_rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class TORCharacteristic(Base):
    __tablename__ = "tor_characteristics"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("equipment_models.id"))
    characteristic_id: Mapped[int] = mapped_column(ForeignKey("characteristics.id"))
    value: Mapped[str | None] = mapped_column(String(500), nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    model = relationship("EquipmentModel", back_populates="characteristics")
    characteristic = relationship("Characteristic", back_populates="tor_values")


class ClassCharacteristic(Base):
    """
    Catalog of characteristics for a class/subclass (uploaded from xlsx like
    "Класс-подкласс характеристики.xlsx"). Used to know required characteristics
    and default units for a class/subclass.
    """

    __tablename__ = "class_characteristics"

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("equipment_classes.id"))
    subclass_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_subclasses.id"), nullable=True)

    name: Mapped[str] = mapped_column(String(300))
    unit_symbol: Mapped[str | None] = mapped_column(String(50), nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, default=True)

    cls = relationship("EquipmentClass")
    sub = relationship("EquipmentSubclass")


class MaintenanceType(Base):
    __tablename__ = "maintenance_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_models.id"), nullable=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_classes.id"), nullable=True)
    subclass_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_subclasses.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(500))
    normalized_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    periodicity: Mapped[str | None] = mapped_column(String(200), nullable=True)
    periodicity_months: Mapped[float | None] = mapped_column(Float, nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    model = relationship("EquipmentModel", back_populates="maintenance_types")
    eq_class = relationship("EquipmentClass")
    eq_subclass = relationship("EquipmentSubclass")


class NormalizationRule(Base):
    __tablename__ = "normalization_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_type: Mapped[str] = mapped_column(String(100))
    pattern: Mapped[str] = mapped_column(Text)
    replacement: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    order: Mapped[int] = mapped_column(Integer, default=0)


class Operation(Base):
    __tablename__ = "operations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(500))
    normalized_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_classes.id"), nullable=True)
    subclass_id: Mapped[int | None] = mapped_column(ForeignKey("equipment_subclasses.id"), nullable=True)


class Profession(Base):
    __tablename__ = "professions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(300), unique=True)


class Qualification(Base):
    __tablename__ = "qualifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(300), unique=True)


class LaborNorm(Base):
    __tablename__ = "labor_norms"

    id: Mapped[int] = mapped_column(primary_key=True)
    operation_normalized: Mapped[str] = mapped_column(String(500), index=True)
    profession: Mapped[str | None] = mapped_column(String(300), nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(300), nullable=True)
    labor_hours: Mapped[float] = mapped_column(Float)
    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)


class TORComponent(Base):
    __tablename__ = "tor_components"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("equipment_models.id"))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("tor_components.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(500))
    component_type: Mapped[str] = mapped_column(String(50))

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    model = relationship("EquipmentModel", back_populates="components")
    parent = relationship("TORComponent", remote_side=[id], backref="children")
    operations = relationship("ComponentOperation", back_populates="component", cascade="all, delete-orphan")


class ComponentOperation(Base):
    __tablename__ = "component_operations"

    id: Mapped[int] = mapped_column(primary_key=True)
    component_id: Mapped[int] = mapped_column(ForeignKey("tor_components.id"))
    operation_id: Mapped[int | None] = mapped_column(ForeignKey("operations.id"), nullable=True)
    custom_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    profession: Mapped[str | None] = mapped_column(String(300), nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(300), nullable=True)
    labor_hours: Mapped[float | None] = mapped_column(Float, nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    component = relationship("TORComponent", back_populates="operations")
    operation = relationship("Operation")
    tmc_items = relationship("OperationTMC", back_populates="operation", cascade="all, delete-orphan")


class OperationTMC(Base):
    __tablename__ = "operation_tmc"

    id: Mapped[int] = mapped_column(primary_key=True)
    operation_id: Mapped[int] = mapped_column(ForeignKey("component_operations.id"))
    name: Mapped[str] = mapped_column(String(500))
    code: Mapped[str | None] = mapped_column(String(200), nullable=True)
    unit_symbol: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    consumption_rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    operation = relationship("ComponentOperation", back_populates="tmc_items")


class BOMItem(Base):
    __tablename__ = "bom_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("equipment_models.id"))
    name: Mapped[str] = mapped_column(String(500))
    code: Mapped[str | None] = mapped_column(String(200), nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit_symbol: Mapped[str | None] = mapped_column(String(50), nullable=True)
    analog_code: Mapped[str | None] = mapped_column(String(200), nullable=True)
    analog_name: Mapped[str | None] = mapped_column(String(500), nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    model = relationship("EquipmentModel", back_populates="bom_items")


class APLItem(Base):
    __tablename__ = "apl_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("equipment_models.id"))
    name: Mapped[str] = mapped_column(String(500))
    code: Mapped[str | None] = mapped_column(String(200), nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit_symbol: Mapped[str | None] = mapped_column(String(50), nullable=True)
    analog_code: Mapped[str | None] = mapped_column(String(200), nullable=True)
    analog_name: Mapped[str | None] = mapped_column(String(500), nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    model = relationship("EquipmentModel", back_populates="apl_items")


class ReliabilityMetric(Base):
    __tablename__ = "reliability_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("equipment_models.id"))
    metric_type: Mapped[str] = mapped_column(String(50))  # mtbf, mttr, availability, failure_rate
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)

    model = relationship("EquipmentModel", back_populates="reliability_metrics")


class FailureEvent(Base):
    __tablename__ = "failure_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("equipment_models.id"))
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    runtime_hours: Mapped[float | None] = mapped_column(Float, nullable=True)

    source_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    model = relationship("EquipmentModel")
