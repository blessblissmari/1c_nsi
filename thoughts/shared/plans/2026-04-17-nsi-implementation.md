---
date: 2026-04-17
topic: "NSI Tool — Implementation Plan (Updated)"
status: active
design_ref: thoughts/shared/designs/2026-04-17-nsi-functional-api-design.md
---

## Phase 0: Cleanup (Quick, Do First)

### Task 0.1: Delete Temp Debug Scripts
- **Files to delete**: `backend/check_db.py`, `backend/check_db2.py`, `backend/check_db3.py`, `backend/test_tree.py`, `backend/test_tree2.py`, `backend/test_config.py`, `backend/start_server.ps1`
- **Action**: Delete all 7 files

### Task 0.2: Remove Debug Print from main.py
- **File**: `backend/app/main.py`
- **Action**: Remove the debug print statement from the lifespan function

---

## Phase 1: ТК Backend Router

### Task 1.1: Create ТК API Router
- **File**: `backend/app/api/v1/tk.py` (NEW)
- **Pattern**: Follow `maintenance.py` structure — CRUD + AI fill/enrich + verify
- **DB Models** (already exist in models.py):
  - Operation: id, name, normalized_name, class_id, subclass_id
  - TORComponent: id, model_id, parent_id, name, component_type, source_type, confidence, verified
  - ComponentOperation: id, component_id, operation_id, custom_name, profession, qualification, labor_hours, source_type, confidence, verified
  - OperationTMC: id, operation_id, name, code, unit_symbol, quantity, consumption_rate, source_type, confidence, verified
- **Endpoints**:
  - `GET /tk/components/{model_id}` — list components for model (with children via parent_id)
  - `POST /tk/components` — create component (body: model_id, name, component_type, parent_id?)
  - `PUT /tk/components/{id}` — update component
  - `DELETE /tk/components/{id}` — delete component (cascade children)
  - `GET /tk/operations/{component_id}` — list ComponentOperations for component
  - `POST /tk/operations` — create component-operation (body: component_id, operation_id?, custom_name?, profession?, qualification?, labor_hours?)
  - `PUT /tk/operations/{id}` — update component-operation
  - `DELETE /tk/operations/{id}` — delete component-operation (cascade TMC)
  - `GET /tk/tmc/{component_operation_id}` — list OperationTMC for operation
  - `POST /tk/tmc` — create TMC (body: operation_id, name, code?, unit_symbol?, quantity?, consumption_rate?)
  - `PUT /tk/tmc/{id}` — update TMC
  - `DELETE /tk/tmc/{id}` — delete TMC
  - `POST /tk/fill-components-from-source/{model_id}` — AI fill components from vector store
  - `POST /tk/enrich-components-from-web/{model_id}` — AI enrich components from web
  - `POST /tk/fill-operations-from-source/{model_id}` — AI fill operations from vector store
  - `POST /tk/enrich-operations-from-web/{model_id}` — AI enrich operations from web
  - `POST /tk/fill-tmc-from-source/{component_operation_id}` — AI fill TMC from vector store
  - `POST /tk/enrich-tmc-from-web/{component_operation_id}` — AI enrich TMC from web
  - `POST /tk/verify` — bulk verify (body: {ids: [], verified: bool, type: "component"|"operation"|"tmc"})
  - `GET /tk/standard-operations` — list all Operation records (for dropdown)
- **Schemas needed** (add to schemas.py):
  - ComponentCreate, ComponentUpdate, ComponentResponse
  - ComponentOperationCreate, ComponentOperationUpdate, ComponentOperationResponse
  - OperationTMCCreate, OperationTMCUpdate, OperationTMCResponse
  - TkVerifyRequest (with type field)

### Task 1.2: Add ТК Schemas
- **File**: `backend/app/schemas/schemas.py` (APPEND)
- **Schemas**: ComponentCreate, ComponentUpdate, ComponentResponse, ComponentOperationCreate, ComponentOperationUpdate, ComponentOperationResponse, OperationTMCCreate, OperationTMCUpdate, OperationTMCResponse, TkVerifyRequest

### Task 1.3: Add ТК AI Service Methods
- **File**: `backend/app/services/ai_service.py` (APPEND)
- **Methods**:
  - `enrich_components_via_web(model_name: str)` — generate components tree for model
  - `enrich_components_via_vector_store(model_name: str)` — get components from docs
  - `enrich_operations_via_web(model_name: str, component_name: str)` — generate operations for component
  - `enrich_operations_via_vector_store(model_name: str, component_name: str)` — get operations from docs
  - `enrich_tmc_via_web(model_name: str, operation_name: str)` — generate TMC for operation
  - `enrich_tmc_via_vector_store(model_name: str, operation_name: str)` — get TMC from docs
- **Pattern**: Follow existing `enrich_characteristics_via_web` pattern — JSON prompt → parse → return structured data

### Task 1.4: Register ТК Router in Main App
- **File**: `backend/app/main.py`
- **Action**: Add `from app.api.v1.tk import router as tk_router` and `app.include_router(tk_router, prefix="/api/v1/tk", tags=["tk"])`

### Task 1.5: Add ТК API Client Methods
- **File**: `frontend/src/api/index.ts` (APPEND)
- **Pattern**: Follow existing API client structure (ky-based)
- **Methods**: 
  - tkApi object with: getComponents, createComponent, updateComponent, deleteComponent, getOperations, createOperation, updateOperation, deleteOperation, getTmc, createTmc, updateTmc, deleteTmc, fillComponentsFromSource, enrichComponentsFromWeb, fillOperationsFromSource, enrichOperationsFromWeb, fillTmcFromSource, enrichTmcFromWeb, verifyTk, getStandardOperations

### Task 1.6: Build TkWorkspace Frontend
- **File**: `frontend/src/components/workspaces/TkWorkspace.tsx` (REPLACE placeholder)
- **Pattern**: Follow MaintenanceWorkspace.tsx structure
- **UI Elements**:
  - Model selector dropdown (reuse pattern from other workspaces)
  - Components tree (expandable parent/child rows)
  - Operations sub-table per component (expandable)
  - TMC sub-table per operation (expandable)
  - "Fill components from source" / "Enrich components from web" buttons
  - "Fill operations from source" / "Enrich operations from web" buttons (per component)
  - "Fill TMC from source" / "Enrich TMC from web" buttons (per operation)
  - Verify button per row
  - CRUD buttons for components, operations, TMC
  - SourceBadge, VerifiedBadge, ConfidenceBar per row
  - Loading states and error handling (toasts)

---

## Phase 2: Reliability Workspace

### Task 2.1: Add Reliability DB Model
- **File**: `backend/app/models/models.py` (APPEND)
- **Model**: ReliabilityData
  - id: Integer, primary key
  - model_id: Integer, ForeignKey→EquipmentModel.id, unique (one record per model)
  - mtbf: Float (mean time between failures, hours)
  - mttr: Float (mean time to repair, hours)
  - failure_rate: Float (failures per unit time)
  - source_type: String(50), nullable
  - confidence: Float, nullable
  - source_url: Text, nullable
  - verified: Boolean, default=False
  - created_at: DateTime
  - updated_at: DateTime
- **Also**: Add relationship to EquipmentModel: `reliability = relationship("ReliabilityData", back_populates="model", uselist=False)`

### Task 2.2: Add Reliability Schemas
- **File**: `backend/app/schemas/schemas.py` (APPEND)
- **Schemas**: ReliabilityDataCreate, ReliabilityDataUpdate, ReliabilityDataResponse

### Task 2.3: Create Reliability API Router
- **File**: `backend/app/api/v1/reliability.py` (NEW)
- **Pattern**: Follow `upper_levels.py` structure (simple CRUD)
- **Endpoints**:
  - `GET /reliability/{model_id}` — get reliability data for model
  - `POST /reliability/fill-from-source/{model_id}` — AI fill from vector store
  - `POST /reliability/enrich-from-web/{model_id}` — AI enrich from web
  - `PUT /reliability/{id}` — update reliability data
  - `POST /reliability/verify` — bulk verify (body: {ids: [], verified: bool})

### Task 2.4: Add Reliability AI Service Methods
- **File**: `backend/app/services/ai_service.py` (APPEND)
- **Methods**:
  - `enrich_reliability_via_web(model_name: str)` — estimate MTBF, MTTR, failure rate from web
  - `enrich_reliability_via_vector_store(model_name: str)` — get reliability from docs

### Task 2.5: Register Reliability Router
- **File**: `backend/app/main.py`
- **Action**: Add import + include router with prefix="/api/v1/reliability"

### Task 2.6: Add Reliability API Client Methods
- **File**: `frontend/src/api/index.ts` (APPEND)
- **Methods**: reliabilityApi object with: getReliability, fillFromSource, enrichFromWeb, updateReliability, verifyReliability

### Task 2.7: Build ReliabilityWorkspace Frontend
- **File**: `frontend/src/components/workspaces/ReliabilityWorkspace.tsx` (REPLACE placeholder)
- **Pattern**: Follow UpperLevelsWorkspace.tsx (card-based, simpler)
- **UI Elements**:
  - Model selector
  - Reliability metrics card (MTBF, MTTR, failure rate)
  - SourceBadge, VerifiedBadge, ConfidenceBar
  - Source URL link (clickable)
  - "Fill from source" / "Enrich from web" buttons
  - "Verify" button
  - Edit capability for manual updates

---

## Phase 3: Quality Assessment Enhancements

### Task 3.1: Add SourceUrlLink Component
- **File**: `frontend/src/components/ui/GlassCard.tsx` (APPEND)
- **Component**: SourceUrlLink — renders source_url as clickable external link icon
- **Props**: url: string | null
- **Behavior**: If url present, show external link icon that opens in new tab; if null, show nothing

### Task 3.2: Add SourceUrlLink to All Workspaces
- **Files**: HierarchyWorkspace.tsx, MassProcessingWorkspace.tsx, MaintenanceWorkspace.tsx, SpecificationsWorkspace.tsx
- **Action**: Add SourceUrlLink next to SourceBadge in each row where source_url is available

### Task 3.3: Add DocumentPreviewModal Component
- **File**: `frontend/src/components/shared/DocumentPreviewModal.tsx` (NEW)
- **Props**: modelId: number, isOpen: boolean, onClose: () => void
- **Behavior**: 
  - Fetches documents for model via API (need endpoint or use existing)
  - Shows parsed_content in scrollable modal
  - Glass panel styling consistent with app

### Task 3.4: Add Document Preview API Endpoint
- **File**: `backend/app/api/v1/hierarchy.py` (APPEND)
- **Endpoint**: `GET /hierarchy/documents/{model_id}` — list documents for model with parsed_content
- **Note**: Document model already has model_id FK and parsed_content field

### Task 3.5: Add Document Preview API Client Method
- **File**: `frontend/src/api/index.ts` (APPEND)
- **Method**: hierarchyApi.getDocuments(modelId)

### Task 3.6: Add Document Preview Button to Workspaces
- **Files**: HierarchyWorkspace.tsx, MassProcessingWorkspace.tsx
- **Action**: Add document icon button that opens DocumentPreviewModal

---

## Execution Order

1. **Phase 0** — Cleanup (5 min)
2. **Phase 1** — ТК workspace (backend → frontend, 2-3 hours)
   - 1.2 schemas → 1.1 router → 1.3 AI service → 1.4 register → 1.5 API client → 1.6 frontend
3. **Phase 2** — Reliability workspace (model → router → frontend, 1-2 hours)
   - 2.1 model → 2.2 schemas → 2.3 router → 2.4 AI service → 2.5 register → 2.6 API client → 2.7 frontend
4. **Phase 3** — Quality assessment enhancements (30-60 min)
   - 3.4 API endpoint → 3.5 API client → 3.1 SourceUrlLink → 3.2 add to workspaces → 3.3 DocumentPreviewModal → 3.6 add to workspaces

## Dependencies

- Phase 1.2 (schemas) → 1.1 (router) → 1.3 (AI) → 1.4 (register) → 1.5 (frontend API) → 1.6 (frontend UI)
- Phase 2.1 (model) → 2.2 (schemas) → 2.3 (router) → 2.4 (AI) → 2.5 (register) → 2.6 (frontend API) → 2.7 (frontend UI)
- Phase 3.4 (API) → 3.5 (client) → 3.3 (modal) → 3.6 (integrate)
- Phase 3.1 (SourceUrlLink) → 3.2 (add to workspaces) — independent from 3.3-3.6
- Phase 0 is independent, do first

## Risk Mitigation

- **AI service down**: Test with curl first; if Yandex API is down, implement graceful fallback returning error messages
- **Vector Store empty**: If no documents, "fill from source" returns empty — document this limitation
- **DB migration**: Adding ReliabilityData model — SQLAlchemy will create table on startup since we use `Base.metadata.create_all`
- **ТЗ scope**: Section 6.5 specifies many more ТК functions (labor, professions, etc.) — implement incrementally, core CRUD + AI first
