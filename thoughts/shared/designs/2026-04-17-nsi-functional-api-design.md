---
date: 2026-04-17
topic: "NSI Tool — Verified Backend + Missing Workspaces + Quality Assessment"
status: validated
---

## Problem Statement

The NSI Tool has a **fully implemented and VERIFIED backend** and a **fully built frontend** with 7 workspace screens. After thorough debugging:

- ✅ **All frontend↔backend URL mappings are correct** — verified
- ✅ **All backend services are implemented** — normalization, classification, AI service (3 transport layers)
- ✅ **All 5 active routers work** — hierarchy (20+ endpoints), mass_processing, maintenance, specifications, upper_levels
- ✅ **All 7 key endpoints return real data** — 52 nodes, 30 models, 160 characteristics, 1097 units, etc.
- ✅ **DATABASE_URL bug fixed** — absolute path in config.py + .env
- ✅ **Logo moved to bottom** — justify-end pb-8 in LavaLampBackground.tsx
- ✅ **Quality assessment inline components exist** — SourceBadge, VerifiedBadge, ConfidenceBar in GlassCard.tsx

**What's still missing:**
1. **ТК workspace** — DB models exist (Operation, TORComponent, ComponentOperation, OperationTMC) but NO API router and frontend is placeholder
2. **Reliability workspace** — No DB model, no router, frontend is placeholder
3. **Quality assessment gaps** — source_url not shown as clickable link, no document preview, no consolidated quality dashboard
4. **Cleanup** — temp debug scripts, debug print in main.py

## Constraints

- **Backend**: FastAPI Python, SQLite via SQLAlchemy, Yandex AI Studio SDK
- **Frontend**: React 19 + TypeScript + Tailwind v4 + Three.js + Framer Motion
- **AI**: Yandex AI configured in `.env` — API key, folder ID, model URL, vector store ID
- **SQLAlchemy**: use `parent_id.is_(None)` not `parent_id == None`
- **Excel parsing**: `\xa0` non-breaking spaces require `_clean()` function
- **DB path**: `backend/nsi_data.db` with absolute path via config.py fix
- **Git**: Not available in this environment
- **Server**: Use `backend/run.py` to start (handles chdir + env)

## Approach

**"Build the missing pieces"** — the foundation is solid and verified. We need to:

1. **Build ТК workspace** (DB models exist → add router + frontend)
2. **Build Reliability workspace** (add model + router + frontend)
3. **Complete quality assessment UI** (source_url links, document preview, dashboard)
4. **Clean up** temp files

Rejected alternatives:
- Rebuilding anything — it all works
- Major refactoring — no need
- Skipping ТК/Reliability — ТЗ requires them

## Architecture

### What Already Works (No Changes Needed)

| Component | Status | Details |
|-----------|--------|---------|
| Normalization service | ✅ Complete | normalize_model_name, normalize_class_name, etc. |
| Classification service | ✅ Complete | keyword matching + SequenceMatcher |
| AI service | ✅ Complete | 3 transport layers, all enrichment/analog methods |
| Hierarchy router | ✅ Complete | 20+ endpoints with real DB logic |
| Mass processing router | ✅ Complete | characteristics, units, bind, fill, enrich, analogs |
| Maintenance router | ✅ Complete | types, upload, fill, enrich |
| Specifications router | ✅ Complete | BOM, APL, source/web, analogs |
| Upper levels router | ✅ Complete | getCard, updateCard |
| Frontend API client | ✅ Complete | All URLs match backend |
| 5 workspace UIs | ✅ Complete | Hierarchy, UpperLevels, MassProcessing, Maintenance, Specifications |
| Quality inline UI | ✅ Complete | SourceBadge, VerifiedBadge, ConfidenceBar |
| Logo position | ✅ Fixed | Bottom of page |
| DATABASE_URL | ✅ Fixed | Absolute path in config.py |

### What Needs Building

| Component | Status | What's Missing |
|-----------|--------|---------------|
| ТК backend router | ❌ Missing | DB models exist, need API router |
| ТК frontend | ❌ Placeholder | TkWorkspace.tsx is just hero animation |
| Reliability DB model | ❌ Missing | No model in models.py |
| Reliability backend | ❌ Missing | No router |
| Reliability frontend | ❌ Placeholder | ReliabilityWorkspace.tsx is just hero animation |
| Source URL links | ❌ Missing | source_url field exists but not shown as clickable link |
| Document preview | ❌ Missing | Document model has parsed_content but no preview UI |
| Quality dashboard | ❌ Missing | No consolidated view across all data types |
| Cleanup | ❌ Needed | Temp debug scripts, debug print |

## Components

### 1. ТК API Router (new)

DB models already exist:
- **Operation**: id, name, normalized_name, class_id, subclass_id
- **TORComponent**: id, model_id, parent_id, name, component_type, source_type, confidence, verified
- **ComponentOperation**: id, component_id, operation_id, custom_name, profession, qualification, labor_hours, source_type, confidence, verified
- **OperationTMC**: id, operation_id, name, code, unit_symbol, quantity, consumption_rate, source_type, confidence, verified

Needed endpoints (per ТЗ section 6.5):
- GET /tk/components/{model_id} — list components for model (tree with children)
- POST /tk/components — create component
- PUT /tk/components/{id} — update component
- DELETE /tk/components/{id} — delete component
- GET /tk/operations/{component_id} — list operations for component
- POST /tk/operations — create component-operation link
- PUT /tk/operations/{id} — update component-operation
- DELETE /tk/operations/{id} — delete component-operation
- GET /tk/tmc/{operation_id} — list TMC for operation
- POST /tk/tmc — create TMC
- PUT /tk/tmc/{id} — update TMC
- DELETE /tk/tmc/{id} — delete TMC
- POST /tk/fill-components-from-source/{model_id} — AI fill from vector store
- POST /tk/enrich-components-from-web/{model_id} — AI enrich from web
- POST /tk/fill-operations-from-source/{model_id} — AI fill operations from vector store
- POST /tk/enrich-operations-from-web/{model_id} — AI enrich operations from web
- POST /tk/fill-tmc-from-source/{operation_id} — AI fill TMC from vector store
- POST /tk/enrich-tmc-from-web/{operation_id} — AI enrich TMC from web
- POST /tk/verify — bulk verify (ids + verified flag)
- POST /tk/upload-components — upload from file
- POST /tk/upload-operations — upload from file

### 2. ТК Frontend (new)

Replace TkWorkspace.tsx placeholder with:
- Model selector (reuse pattern from other workspaces)
- Components tree (parent/child expandable)
- Operations per component (expandable rows)
- TMC per operation (expandable rows)
- "Fill components from source" / "Enrich components from web" buttons
- "Fill operations from source" / "Enrich operations from web" buttons
- "Fill TMC from source" / "Enrich TMC from web" buttons
- Verify button per row
- CRUD for components, operations, TMC
- SourceBadge, VerifiedBadge, ConfidenceBar per row

### 3. Reliability DB Model (new)

Fields needed (per ТЗ goal 6: "расчет параметров надежности"):
- id, model_id (FK→EquipmentModel)
- mtbf (mean time between failures, hours)
- mttr (mean time to repair, hours)
- failure_rate (failures per unit time)
- source_type, confidence, verified
- created_at, updated_at

### 4. Reliability API Router (new)

Endpoints:
- GET /reliability/{model_id} — get reliability data for model
- POST /reliability/fill-from-source/{model_id} — AI fill from vector store
- POST /reliability/enrich-from-web/{model_id} — AI enrich from web
- PUT /reliability/{id} — update reliability data
- POST /reliability/verify — bulk verify

### 5. Reliability Frontend (new)

Replace ReliabilityWorkspace.tsx placeholder with:
- Model selector
- Reliability metrics card (MTBF, MTTR, failure rate)
- SourceBadge, VerifiedBadge, ConfidenceBar
- "Fill from source" / "Enrich from web" buttons
- "Verify" button
- Edit capability for manual updates

### 6. Quality Assessment Enhancements

**ТЗ Section 7 requirements vs current state:**
1. ✅ Статус валидности → verified field + VerifiedBadge
2. ✅ Процент достоверности → confidence field + ConfidenceBar
3. ✅ Источник информации → source_type field + SourceBadge
4. ❌ Переход гиперссылкой → source_url field exists, need clickable link
5. ❌ Окно с выводом части документа → Document.parsed_content exists, need preview modal
6. ✅ Галочка "Проверено экспертом" → verified field + VerifiedBadge

Needed additions:
- **SourceUrlLink** component — clickable link to source_url when present
- **DocumentPreviewModal** — modal showing parsed_content from Document model
- **QualityDashboard** component — consolidated view showing quality stats across all models

### 7. Cleanup

- Delete: backend/check_db.py, check_db2.py, check_db3.py, test_tree.py, test_tree2.py, test_config.py
- Delete: backend/start_server.ps1 (replaced by run.py)
- Remove debug print from backend/app/main.py lifespan

## Data Flow

### ТК Flow (new)
```
User selects model → sees components tree
  → Click "Fill components from source"
    → POST /api/v1/tk/fill-components-from-source/{model_id}
      → AI service queries vector store for component docs
      → Parse response → create TORComponent rows (with parent/child)
    → Return components tree

  → Expand component → see operations
    → Click "Fill operations from source"
      → POST /api/v1/tk/fill-operations-from-source/{model_id}
        → AI service generates operations for components
        → Parse response → create ComponentOperation rows
      → Return operations list

  → Expand operation → see TMC
    → Click "Fill TMC from source"
      → POST /api/v1/tk/fill-tmc-from-source/{operation_id}
        → AI service generates TMC for operation
        → Parse response → create OperationTMC rows
      → Return TMC list
```

### Quality Assessment Flow (enhancement)
```
User clicks source_url link → opens in new tab
User clicks document icon → DocumentPreviewModal opens
  → Shows parsed_content from Document model
  → Highlights relevant section if source_url has anchor
```

## Error Handling

- **AI service down**: Return `{ success: false, message: "AI сервис недоступен" }` — don't 500
- **No documents uploaded**: Return `{ success: false, message: "Нет загруженных документов" }`
- **Partial AI results**: Return what succeeded + list of failures
- **Rate limiting**: Yandex AI has rate limits — batch with delays between models
- **Vector Store unavailable**: Graceful fallback to web-only enrichment

## Testing Strategy

1. **ТК workspace test**: Create/read/update operations, components, TMC
2. **Reliability test**: Fill/enrich reliability data for a model
3. **Quality assessment test**: Click source_url links, open document preview
4. **Frontend integration**: Open each workspace, click buttons, verify no errors
5. **AI connectivity**: Test fill-from-source and enrich-from-web for ТК and Reliability

## Open Questions

- Vector Store ID `fvt00m9qean8pviis0ni` — is it populated with documents?
- AI model `qwen3.5-35b-a3b-fp8` — is this model available in the folder?
- ТК data structure — ТЗ section 6.5 specifies many more functions (labor, professions, etc.) than current DB models support — should we extend models or implement incrementally?
