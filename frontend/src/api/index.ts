import ky, { HTTPError } from "ky";
import { useAuthStore } from "../auth/store";

// Базовый URL API. В dev используем vite proxy ('/api/v1').
// В прод-сборке (GitHub Pages и т.п.) указываем абсолютный URL на бэкенд через VITE_API_URL.
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, "")}/api/v1`
  : "/api/v1";

const api = ky.create({
  prefixUrl: API_BASE_URL,
  timeout: 60000,
  hooks: {
    beforeRequest: [
      (req) => {
        const token = useAuthStore.getState().token;
        if (token) req.headers.set("Authorization", `Bearer ${token}`);
      },
    ],
    afterResponse: [
      (_req, _opts, res) => {
        if (res.status === 401) {
          useAuthStore.getState().logout();
          if (
            typeof window !== "undefined" &&
            !window.location.pathname.startsWith("/login")
          ) {
            const next = encodeURIComponent(
              window.location.pathname + window.location.search,
            );
            window.location.href = `/login?next=${next}`;
          }
        }
        return res;
      },
    ],
  },
});

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface UserRead {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post("auth/login", { json: { email, password } }).json<LoginResponse>(),
  register: (email: string, password: string, full_name?: string) =>
    api
      .post("auth/register", { json: { email, password, full_name } })
      .json<UserRead>(),
  me: () => api.get("auth/me").json<UserRead>(),
};

export function extractErrorMessage(err: unknown): string {
  if (err instanceof HTTPError) {
    return err.response.statusText || "Ошибка сервера";
  }
  if (err instanceof Error) return err.message;
  return "Неизвестная ошибка";
}

export const hierarchyApi = {
  getTree: () => api.get("hierarchy/tree").json<any[]>(),
  createNode: (data: any) => api.post("hierarchy/nodes", { json: data }).json(),
  updateNode: (id: number, data: any) =>
    api.put(`hierarchy/nodes/${id}`, { json: data }).json(),
  deleteNode: (id: number) => api.delete(`hierarchy/nodes/${id}`).json(),
  uploadHierarchy: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("hierarchy/upload-hierarchy", { body: fd }).json();
  },
  getModels: (params?: Record<string, any>) =>
    api.get("hierarchy/models", { searchParams: params }).json<any[]>(),
  getModelDetail: (id: number) => api.get(`hierarchy/models/${id}`).json(),
  createModel: (data: any) =>
    api.post("hierarchy/models", { json: data }).json(),
  updateModel: (id: number, data: any) =>
    api.put(`hierarchy/models/${id}`, { json: data }).json(),
  uploadModels: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("hierarchy/upload-models", { body: fd }).json();
  },
  normalizeModels: () => api.post("hierarchy/normalize-models").json(),
  getClasses: () => api.get("hierarchy/classes").json<any[]>(),
  createClass: (data: any) =>
    api.post("hierarchy/classes", { json: data }).json(),
  createSubclass: (data: any) =>
    api.post("hierarchy/subclasses", { json: data }).json(),
  uploadClassifier: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("hierarchy/upload-classifier", { body: fd }).json();
  },
  classifyModels: () => api.post("hierarchy/classify-models").json(),
  classifyModelsViaWeb: () =>
    api.post("hierarchy/classify-models-via-web").json(),
  getClassCard: (classId: number, subclassId?: number | null) =>
    api
      .get(`hierarchy/classes/${classId}/card`, {
        searchParams: subclassId ? { subclass_id: subclassId } : {},
      })
      .json<any>(),
  getNodeCard: (nodeId: number) =>
    api.get(`hierarchy/nodes/${nodeId}/card`).json<any>(),
  classifyModelByName: (
    modelId: number,
    data: {
      class_name: string;
      subclass_name?: string | null;
      create_if_missing?: boolean;
    },
  ) =>
    api
      .post(`hierarchy/models/${modelId}/classify`, { json: data })
      .json<any>(),
  findAnalogs: (
    modelId: number,
    data?: { selected_characteristic_ids?: number[]; limit?: number },
  ) =>
    api
      .post(`hierarchy/models/${modelId}/analogs`, { json: data ?? {} })
      .json<any[]>(),
  uploadDocument: (modelId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post(`hierarchy/upload-documents/${modelId}`, { body: fd })
      .json();
  },
  getDocuments: (modelId: number) =>
    api.get(`hierarchy/documents/${modelId}`).json<any[]>(),
  getNormalizationRules: () =>
    api.get("hierarchy/normalization-rules").json<any[]>(),
  createNormalizationRule: (data: any) =>
    api.post("hierarchy/normalization-rules", { json: data }).json(),
  uploadNormalizationRules: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post("hierarchy/upload-normalization-rules", { body: fd })
      .json();
  },
  verifyModels: (ids: number[], verified: boolean) =>
    api.post("hierarchy/verify", { json: { ids, verified } }).json(),
};

export const massProcessingApi = {
  getCharacteristics: (params?: Record<string, any>) =>
    api
      .get("mass-processing/characteristics", { searchParams: params })
      .json<any[]>(),
  createCharacteristic: (data: any) =>
    api.post("mass-processing/characteristics", { json: data }).json(),
  uploadCharacteristics: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post("mass-processing/upload-characteristics", { body: fd })
      .json();
  },
  getUnits: () => api.get("mass-processing/units").json<any[]>(),
  createUnit: (data: any) =>
    api.post("mass-processing/units", { json: data }).json(),
  uploadUnits: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("mass-processing/upload-units", { body: fd }).json();
  },
  uploadClassCharacteristics: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api
      .post("mass-processing/upload-class-characteristics", { body: fd })
      .json();
  },
  getClassCharacteristics: (params?: Record<string, any>) =>
    api
      .get("mass-processing/class-characteristics", { searchParams: params })
      .json<any[]>(),
  bindCharacteristics: (modelId: number) =>
    api.post(`mass-processing/bind-characteristics/${modelId}`).json(),
  getTorCharacteristics: (modelId: number) =>
    api.get(`mass-processing/tor-characteristics/${modelId}`).json<any[]>(),
  updateTorCharacteristic: (id: number, data: any) =>
    api.put(`mass-processing/tor-characteristics/${id}`, { json: data }).json(),
  fillFromSource: (modelId: number) =>
    api
      .post(`mass-processing/fill-characteristics-from-source/${modelId}`)
      .json(),
  enrichFromWeb: (modelId: number) =>
    api
      .post(`mass-processing/enrich-characteristics-from-web/${modelId}`)
      .json(),
  requiredFromDocs: (modelId: number) =>
    api.post(`mass-processing/required-from-docs/${modelId}`).json(),
  requiredFromWeb: (modelId: number) =>
    api.post(`mass-processing/required-from-web/${modelId}`).json(),
  otherFromDocs: (modelId: number) =>
    api.post(`mass-processing/other-from-docs/${modelId}`).json(),
  searchAnalogs: (modelId: number, selectedChars?: number[]) =>
    api
      .post(`mass-processing/search-analogs/${modelId}`, {
        json: selectedChars,
      })
      .json(),
  verify: (ids: number[], verified: boolean) =>
    api.post("mass-processing/verify", { json: { ids, verified } }).json(),
};

export const maintenanceApi = {
  getTypes: (params?: Record<string, any>) =>
    api.get("maintenance/types", { searchParams: params }).json<any[]>(),
  createType: (data: any) =>
    api.post("maintenance/types", { json: data }).json(),
  updateType: (id: number, data: any) =>
    api.put(`maintenance/types/${id}`, { json: data }).json(),
  deleteType: (id: number) => api.delete(`maintenance/types/${id}`).json(),
  uploadMaintenance: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("maintenance/upload-maintenance", { body: fd }).json();
  },
  fillFromSource: (modelId: number) =>
    api.post(`maintenance/fill-from-source/${modelId}`).json(),
  enrichFromWeb: (modelId: number) =>
    api.post(`maintenance/enrich-from-web/${modelId}`).json(),
  getPprSchedule: (monthsAhead: number = 12) =>
    api
      .get("maintenance/ppr-schedule", {
        searchParams: { months_ahead: monthsAhead },
      })
      .json<any>(),
  verify: (ids: number[], verified: boolean) =>
    api.post("maintenance/verify", { json: { ids, verified } }).json(),
};

export const specificationsApi = {
  getBom: (modelId: number) =>
    api.get(`specifications/bom/${modelId}`).json<any[]>(),
  createBomItem: (data: any) =>
    api.post("specifications/bom", { json: data }).json(),
  generateBomFromSource: (modelId: number) =>
    api.post(`specifications/bom-from-source/${modelId}`).json(),
  generateBomFromWeb: (modelId: number) =>
    api.post(`specifications/bom-from-web/${modelId}`).json(),
  searchBomAnalogs: (itemId: number) =>
    api.post(`specifications/search-bom-analogs/${itemId}`).json(),
  getApl: (modelId: number) =>
    api.get(`specifications/apl/${modelId}`).json<any[]>(),
  createAplItem: (data: any) =>
    api.post("specifications/apl", { json: data }).json(),
  generateAplFromSource: (modelId: number) =>
    api.post(`specifications/apl-from-source/${modelId}`).json(),
  generateAplFromWeb: (modelId: number) =>
    api.post(`specifications/apl-from-web/${modelId}`).json(),
  searchAplAnalogs: (itemId: number) =>
    api.post(`specifications/search-apl-analogs/${itemId}`).json(),
  verifyBom: (ids: number[], verified: boolean) =>
    api.post("specifications/verify-bom", { json: { ids, verified } }).json(),
  verifyApl: (ids: number[], verified: boolean) =>
    api.post("specifications/verify-apl", { json: { ids, verified } }).json(),
};

export const upperLevelsApi = {
  getCard: (nodeId: number) => api.get(`upper-levels/cards/${nodeId}`).json(),
  updateCard: (nodeId: number, data: any) =>
    api.put(`upper-levels/cards/${nodeId}`, { json: data }).json(),
};

export const tkApi = {
  getProfessions: () => api.get("tk/professions").json<any[]>(),
  getQualifications: () => api.get("tk/qualifications").json<any[]>(),
  getComponents: (modelId: number) =>
    api
      .get("tk/components", { searchParams: { model_id: modelId } })
      .json<any[]>(),
  createComponent: (data: any) =>
    api.post("tk/components", { json: data }).json(),
  updateComponent: (id: number, data: any) =>
    api.put(`tk/components/${id}`, { json: data }).json(),
  deleteComponent: (id: number) => api.delete(`tk/components/${id}`).json(),
  getOperations: (componentId: number) =>
    api
      .get("tk/operations", { searchParams: { component_id: componentId } })
      .json<any[]>(),
  createOperation: (data: any) =>
    api.post("tk/operations", { json: data }).json(),
  updateOperation: (id: number, data: any) =>
    api.put(`tk/operations/${id}`, { json: data }).json(),
  deleteOperation: (id: number) => api.delete(`tk/operations/${id}`).json(),
  getTmc: (operationId: number) =>
    api
      .get("tk/tmc", { searchParams: { operation_id: operationId } })
      .json<any[]>(),
  createTmc: (data: any) => api.post("tk/tmc", { json: data }).json(),
  updateTmc: (id: number, data: any) =>
    api.put(`tk/tmc/${id}`, { json: data }).json(),
  deleteTmc: (id: number) => api.delete(`tk/tmc/${id}`).json(),
  fillComponents: (modelId: number) =>
    api.post(`tk/fill-components/${modelId}`).json(),
  enrichComponents: (modelId: number) =>
    api.post(`tk/enrich-components/${modelId}`).json(),
  fillOperations: (componentId: number) =>
    api.post(`tk/fill-operations/${componentId}`).json(),
  enrichOperations: (componentId: number) =>
    api.post(`tk/enrich-operations/${componentId}`).json(),
  fillTmc: (operationId: number) =>
    api.post(`tk/fill-tmc/${operationId}`).json(),
  enrichTmc: (operationId: number) =>
    api.post(`tk/enrich-tmc/${operationId}`).json(),
  getOperationCatalog: (q?: string) =>
    api
      .get("tk/operation-catalog", { searchParams: q ? { q } : undefined })
      .json<any[]>(),
  uploadOperationCatalog: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("tk/upload-operation-catalog", { body: fd }).json();
  },
  uploadProfessions: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("tk/upload-professions", { body: fd }).json();
  },
  uploadQualifications: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("tk/upload-qualifications", { body: fd }).json();
  },
  uploadLaborNorms: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("tk/upload-labor-norms", { body: fd }).json();
  },
  fillLaborFromSource: (modelId: number) =>
    api.post(`tk/fill-labor-from-source/${modelId}`).json(),
  enrichLaborFromWeb: (modelId: number) =>
    api.post(`tk/enrich-labor-from-web/${modelId}`).json(),
  normalizeOperations: (modelId: number) =>
    api
      .post("tk/normalize-operations", { searchParams: { model_id: modelId } })
      .json(),
  getTmcSummary: (modelId: number) =>
    api
      .get("tk/tmc-summary", { searchParams: { model_id: modelId } })
      .json<any[]>(),
  searchAoplAnalogs: (tmcId: number) =>
    api.post(`tk/search-aopl-analogs/${tmcId}`).json<any[]>(),
  verify: (data: {
    component_ids?: number[];
    operation_ids?: number[];
    tmc_ids?: number[];
    verified: boolean;
  }) => api.post("tk/verify", { json: data }).json(),
};

export const reliabilityApi = {
  getMetrics: (modelId: number) =>
    api
      .get("reliability/metrics", { searchParams: { model_id: modelId } })
      .json<any[]>(),
  createMetric: (data: any) =>
    api.post("reliability/metrics", { json: data }).json(),
  updateMetric: (id: number, data: any) =>
    api.put(`reliability/metrics/${id}`, { json: data }).json(),
  deleteMetric: (id: number) => api.delete(`reliability/metrics/${id}`).json(),
  fillFromSource: (modelId: number) =>
    api.post(`reliability/fill-from-source/${modelId}`).json(),
  enrichFromWeb: (modelId: number) =>
    api.post(`reliability/enrich-from-web/${modelId}`).json(),
  verify: (ids: number[], verified: boolean) =>
    api.post("reliability/verify", { json: { ids, verified } }).json(),
  getFailures: (modelId: number) =>
    api
      .get("reliability/failures", { searchParams: { model_id: modelId } })
      .json<any[]>(),
  uploadFailures: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .extend({ timeout: 300000 })
      .post("reliability/upload-failures", { body: form })
      .json<any>();
  },
  recalcMtbf: (modelId: number) =>
    api.post(`reliability/recalc-mtbf/${modelId}`).json<any>(),
};

export const chatApi = {
  sendMessage: (message: string, contextModelId?: number) =>
    api
      .post("chat", { json: { message, context_model_id: contextModelId } })
      .json<{ message: string; sources: string[] }>(),
  action: (action: string, contextModelId: number) =>
    api
      .post("chat/action", {
        json: { action, context_model_id: contextModelId },
      })
      .json<{ message: string; sources: string[]; data?: any }>(),
};

export const parserApi = {
  parseDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .extend({ timeout: 120000 })
      .post("parse/document", { body: form })
      .json<any>();
  },
  getParseJob: (jobId: string) => api.get(`parse/job/${jobId}`).json<any>(),
  generateCard: (parsedData: any, classId?: number) =>
    api
      .post("parse/generate-card", {
        json: { parsed_data: parsedData, class_id: classId },
      })
      .json<any>(),
  addToHierarchy: (cardData: any, parentNodeId?: number) =>
    api
      .post("parse/add-to-hierarchy", {
        json: { card: cardData, parent_node_id: parentNodeId },
      })
      .json<any>(),
};

export const systemApi = {
  reset: () => api.post("reset/").json<{ status: string }>(),
};

export default api;
