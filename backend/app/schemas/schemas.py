from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class HierarchyNodeBase(BaseModel):
    name: str
    parent_id: int | None = None
    level_type: str
    description: str | None = None
    custom_fields: dict[str, Any] | None = None


class HierarchyNodeCreate(HierarchyNodeBase):
    pass


class HierarchyNodeRead(HierarchyNodeBase):
    id: int
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class HierarchyTreeRead(BaseModel):
    id: int
    name: str
    parent_id: int | None
    level_type: str
    children: list["HierarchyTreeRead"] = []

    model_config = ConfigDict(from_attributes=True)


class EquipmentClassBase(BaseModel):
    name: str


class EquipmentClassCreate(EquipmentClassBase):
    pass


class EquipmentSubclassRead(BaseModel):
    id: int
    name: str
    class_id: int

    model_config = ConfigDict(from_attributes=True)


class EquipmentClassRead(EquipmentClassBase):
    id: int
    subclasses: list[EquipmentSubclassRead] = []

    model_config = ConfigDict(from_attributes=True)


class EquipmentSubclassBase(BaseModel):
    name: str
    class_id: int


class EquipmentSubclassCreate(EquipmentSubclassBase):
    pass


class EquipmentModelBase(BaseModel):
    original_name: str
    hierarchy_id: int | None = None


class EquipmentModelCreate(EquipmentModelBase):
    pass


class EquipmentModelUpdate(BaseModel):
    original_name: str | None = None
    normalized_name: str | None = None
    model_code: str | None = None
    class_id: int | None = None
    subclass_id: int | None = None
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool | None = None


class EquipmentModelRead(EquipmentModelBase):
    id: int
    normalized_name: str | None = None
    model_code: str | None = None
    class_id: int | None = None
    subclass_id: int | None = None
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class EquipmentModelDetail(EquipmentModelRead):
    class_name: str | None = None
    subclass_name: str | None = None
    documents_count: int = 0
    characteristics_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class DocumentBase(BaseModel):
    filename: str
    file_type: str


class DocumentRead(DocumentBase):
    id: int
    model_id: int
    file_path: str
    uploaded_at: datetime | None = None
    priority: int = 0
    parsed_content: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CharacteristicBase(BaseModel):
    name: str
    unit_id: int | None = None
    class_id: int | None = None
    subclass_id: int | None = None


class CharacteristicCreate(CharacteristicBase):
    pass


class CharacteristicRead(CharacteristicBase):
    id: int
    unit_symbol: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UnitBase(BaseModel):
    name: str
    symbol: str
    conversion_rules: dict[str, Any] | None = None


class UnitCreate(UnitBase):
    pass


class UnitRead(UnitBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class TORCharacteristicBase(BaseModel):
    model_id: int
    characteristic_id: int
    value: str | None = None


class TORCharacteristicCreate(TORCharacteristicBase):
    pass


class TORCharacteristicUpdate(BaseModel):
    value: str | None = None
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool | None = None


class TORCharacteristicRead(TORCharacteristicBase):
    id: int
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool = False
    characteristic_name: str | None = None
    unit_symbol: str | None = None

    model_config = ConfigDict(from_attributes=True)


class MaintenanceTypeBase(BaseModel):
    model_id: int | None = None
    class_id: int | None = None
    subclass_id: int | None = None
    name: str
    normalized_name: str | None = None
    periodicity: str | None = None
    periodicity_months: float | None = None


class MaintenanceTypeCreate(MaintenanceTypeBase):
    pass


class MaintenanceTypeUpdate(BaseModel):
    name: str | None = None
    normalized_name: str | None = None
    periodicity: str | None = None
    periodicity_months: float | None = None
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool | None = None


class MaintenanceTypeRead(MaintenanceTypeBase):
    id: int
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class NormalizationRuleBase(BaseModel):
    rule_type: str
    pattern: str
    replacement: str = ""
    description: str | None = None
    is_active: bool = True
    order: int = 0


class NormalizationRuleCreate(NormalizationRuleBase):
    pass


class NormalizationRuleRead(NormalizationRuleBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class OperationBase(BaseModel):
    name: str
    normalized_name: str | None = None
    class_id: int | None = None
    subclass_id: int | None = None


class OperationCreate(OperationBase):
    pass


class OperationRead(OperationBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ProfessionBase(BaseModel):
    name: str


class ProfessionCreate(ProfessionBase):
    pass


class ProfessionRead(ProfessionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class QualificationBase(BaseModel):
    name: str


class QualificationCreate(QualificationBase):
    pass


class QualificationRead(QualificationBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class LaborNormBase(BaseModel):
    operation_normalized: str
    profession: str | None = None
    qualification: str | None = None
    labor_hours: float
    source_type: str | None = None


class LaborNormRead(LaborNormBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class BOMItemBase(BaseModel):
    model_id: int
    name: str
    code: str | None = None
    quantity: float | None = None
    unit_symbol: str | None = None


class BOMItemCreate(BOMItemBase):
    pass


class BOMItemRead(BOMItemBase):
    id: int
    analog_code: str | None = None
    analog_name: str | None = None
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class APLItemBase(BaseModel):
    model_id: int
    name: str
    code: str | None = None
    quantity: float | None = None
    unit_symbol: str | None = None


class APLItemCreate(APLItemBase):
    pass


class APLItemRead(APLItemBase):
    id: int
    analog_code: str | None = None
    analog_name: str | None = None
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class TORComponentBase(BaseModel):
    model_id: int
    parent_id: int | None = None
    name: str
    component_type: str


class TORComponentCreate(TORComponentBase):
    source_type: str = "manual"
    confidence: float = 1.0
    verified: bool = False


class TORComponentUpdate(BaseModel):
    name: str | None = None
    component_type: str | None = None
    parent_id: int | None = None
    source_type: str | None = None
    confidence: float | None = None
    verified: bool | None = None


class TORComponentRead(TORComponentBase):
    id: int
    source_type: str | None = None
    confidence: float | None = None
    verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class ComponentOperationBase(BaseModel):
    component_id: int
    operation_id: int | None = None
    custom_name: str | None = None
    profession: str | None = None
    qualification: str | None = None
    labor_hours: float | None = None


class ComponentOperationCreate(ComponentOperationBase):
    source_type: str = "manual"
    confidence: float = 1.0
    verified: bool = False


class ComponentOperationUpdate(BaseModel):
    custom_name: str | None = None
    profession: str | None = None
    qualification: str | None = None
    labor_hours: float | None = None
    operation_id: int | None = None
    source_type: str | None = None
    confidence: float | None = None
    verified: bool | None = None


class ComponentOperationRead(ComponentOperationBase):
    id: int
    source_type: str | None = None
    confidence: float | None = None
    verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class OperationTMCBase(BaseModel):
    operation_id: int
    name: str
    code: str | None = None
    unit_symbol: str | None = None
    quantity: float | None = None
    consumption_rate: float | None = None


class OperationTMCCreate(OperationTMCBase):
    source_type: str = "manual"
    confidence: float = 1.0
    verified: bool = False


class OperationTMCUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    unit_symbol: str | None = None
    quantity: float | None = None
    consumption_rate: float | None = None
    source_type: str | None = None
    confidence: float | None = None
    verified: bool | None = None


class OperationTMCRead(OperationTMCBase):
    id: int
    source_type: str | None = None
    confidence: float | None = None
    verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class TkVerifyRequest(BaseModel):
    component_ids: list[int] = []
    operation_ids: list[int] = []
    tmc_ids: list[int] = []
    verified: bool = True


class ReliabilityMetricBase(BaseModel):
    model_id: int
    metric_type: str  # mtbf, mttr, availability, failure_rate
    value: float | None = None
    unit: str | None = None
    description: str | None = None


class ReliabilityMetricCreate(ReliabilityMetricBase):
    source_type: str = "manual"
    confidence: float = 1.0
    verified: bool = False


class ReliabilityMetricUpdate(BaseModel):
    metric_type: str | None = None
    value: float | None = None
    unit: str | None = None
    description: str | None = None
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool | None = None


class ReliabilityMetricRead(ReliabilityMetricBase):
    id: int
    source_type: str | None = None
    confidence: float | None = None
    source_url: str | None = None
    verified: bool = False

    model_config = ConfigDict(from_attributes=True)


class FailureEventRead(BaseModel):
    id: int
    model_id: int
    occurred_at: datetime | None = None
    description: str | None = None
    runtime_hours: float | None = None
    source_type: str | None = None
    source_url: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class BulkVerifyRequest(BaseModel):
    ids: list[int]
    verified: bool = True


class AIEnrichRequest(BaseModel):
    model_ids: list[int] | None = None
    field_type: str = "characteristics"


class AIEnrichResult(BaseModel):
    model_id: int
    field: str
    value: str
    source: str
    confidence: float


class MessageResponse(BaseModel):
    message: str
    details: str | None = None


class ClassCharacteristicRead(BaseModel):
    id: int
    class_id: int
    subclass_id: int | None = None
    name: str
    unit_symbol: str | None = None
    required: bool = True

    model_config = ConfigDict(from_attributes=True)
