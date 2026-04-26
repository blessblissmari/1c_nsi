import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Database,
  FileUp,
  Network,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  ActionButton,
  ConfidenceBar,
  GlassPanel,
  SourceBadge,
  VerifiedBadge,
} from "../ui/GlassCard";
import { FileUpload } from "../ui/FileUpload";
import { hierarchyApi, massProcessingApi, systemApi } from "../../api";
import { useAppStore } from "../../store";
import { ClassPicker, type ClassOption } from "../hierarchy/ClassPicker";
import { HierarchyTree, type TreeNode } from "../hierarchy/HierarchyTree";
import {
  ClassifierTree,
  type ClassifierClass,
  type ClassifierSelection,
} from "../hierarchy/ClassifierTree";
import { AnalogSearch } from "../hierarchy/AnalogSearch";
import { InfoDrawer } from "../hierarchy/InfoDrawer";

interface ModelDetail {
  id: number;
  original_name: string;
  normalized_name: string | null;
  model_code: string | null;
  class_id: number | null;
  subclass_id: number | null;
  class_name: string | null;
  subclass_name: string | null;
  source_type: string | null;
  confidence: number | null;
  source_url: string | null;
  verified: boolean;
  documents_count: number;
  characteristics_count: number;
}

interface ModelRow {
  id: number;
  original_name: string;
  normalized_name: string | null;
  class_id: number | null;
  subclass_id: number | null;
  verified: boolean;
}

type SidePanel = "hierarchy" | "classifier";
type DrawerKind = "node" | "class";

interface DrawerState {
  kind: DrawerKind;
  data: any;
}

export function HierarchyWorkspace() {
  const {
    selectedModelId,
    setSelectedModelId,
    setSelectedNodeId,
    loading,
    setLoading,
  } = useAppStore();

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [classes, setClasses] = useState<ClassifierClass[]>([]);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelDetail | null>(null);

  const [showUpload, setShowUpload] = useState<string | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>("hierarchy");
  const [classifierSelection, setClassifierSelection] =
    useState<ClassifierSelection | null>(null);
  const [hierarchySelection, setHierarchySelection] = useState<number | null>(
    null,
  );
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const loadData = async () => {
    if (loadingData) return;
    setLoadingData(true);
    try {
      const [treeData, modelsData, classData] = await Promise.all([
        hierarchyApi.getTree(),
        hierarchyApi.getModels({ limit: 500 }),
        hierarchyApi.getClasses(),
      ]);
      setTree(treeData as TreeNode[]);
      setModels(modelsData as ModelRow[]);
      setClasses(classData as ClassifierClass[]);
      setDataLoaded(
        (treeData as TreeNode[]).length > 0 ||
          (modelsData as ModelRow[]).length > 0 ||
          (classData as ClassifierClass[]).length > 0,
      );
    } catch {
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoadingData(false);
    }
  };

  const reloadModels = async (params?: Record<string, any>) => {
    try {
      const data = await hierarchyApi.getModels({
        limit: 500,
        ...(params ?? {}),
      });
      setModels(data as ModelRow[]);
    } catch {
      toast.error("Ошибка загрузки моделей");
    }
  };

  const reloadClasses = async () => {
    try {
      const data = await hierarchyApi.getClasses();
      setClasses(data as ClassifierClass[]);
    } catch {
      // молча — это вспомогательное обновление счётчиков
    }
  };

  useEffect(() => {
    // одноразовая инициализация — без неё у нас бы был пустой экран до клика
    // на «Загрузить из БД»
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleModels = useMemo(() => {
    let out = models;
    if (classifierSelection) {
      out = out.filter((m) => m.class_id === classifierSelection.classId);
      if (classifierSelection.subclassId) {
        out = out.filter(
          (m) => m.subclass_id === classifierSelection.subclassId,
        );
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      out = out.filter(
        (m) =>
          (m.normalized_name ?? "").toLowerCase().includes(q) ||
          m.original_name.toLowerCase().includes(q),
      );
    }
    return out;
  }, [models, classifierSelection, searchQuery]);

  const unclassifiedCount = models.filter((m) => !m.class_id).length;

  const loadModelDetail = async (id: number) => {
    try {
      const detail = (await hierarchyApi.getModelDetail(id)) as ModelDetail;
      setSelectedModel(detail);
      setSelectedModelId(id);
    } catch {
      toast.error("Ошибка загрузки модели");
    }
  };

  const openNodeCard = async (nodeId: number) => {
    setHierarchySelection(nodeId);
    setSelectedNodeId(nodeId);
    try {
      const card = await hierarchyApi.getNodeCard(nodeId);
      setDrawer({ kind: "node", data: card });
    } catch {
      toast.error("Не удалось открыть карточку узла");
    }
  };

  const openClassCard = async (sel: ClassifierSelection | null) => {
    setClassifierSelection(sel);
    if (!sel) {
      setDrawer(null);
      return;
    }
    try {
      const card = await hierarchyApi.getClassCard(sel.classId, sel.subclassId);
      setDrawer({ kind: "class", data: card });
    } catch {
      toast.error("Не удалось открыть карточку класса");
    }
  };

  const handleNormalize = async () => {
    setLoading("normalize", true);
    try {
      const result = (await hierarchyApi.normalizeModels()) as any;
      toast.success(result.message);
      await reloadModels();
    } catch {
      toast.error("Ошибка нормализации");
    } finally {
      setLoading("normalize", false);
    }
  };

  const handleClassify = async () => {
    setLoading("classify", true);
    try {
      const result = (await hierarchyApi.classifyModels()) as any;
      toast.success(result.message);
      await Promise.all([reloadModels(), reloadClasses()]);
    } catch {
      toast.error("Ошибка классификации");
    } finally {
      setLoading("classify", false);
    }
  };

  const handleClassifyWeb = async () => {
    setLoading("classify-web", true);
    try {
      const result = (await hierarchyApi.classifyModelsViaWeb()) as any;
      toast.success(result.message);
      await Promise.all([reloadModels(), reloadClasses()]);
    } catch {
      toast.error("Ошибка AI-классификации");
    } finally {
      setLoading("classify-web", false);
    }
  };

  const handleUpload = async (type: string, file: File) => {
    setLoading(`upload-${type}`, true);
    try {
      let result: any;
      switch (type) {
        case "hierarchy":
          result = await hierarchyApi.uploadHierarchy(file);
          break;
        case "models":
          result = await hierarchyApi.uploadModels(file);
          break;
        case "classifier":
          result = await hierarchyApi.uploadClassifier(file);
          break;
        case "class-characteristics":
          result = await massProcessingApi.uploadClassCharacteristics(file);
          break;
        default:
          return;
      }
      toast.success(result.message);
      setShowUpload(null);
      await loadData();
    } catch {
      toast.error("Ошибка загрузки файла");
    } finally {
      setLoading(`upload-${type}`, false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (!selectedModelId) {
      toast.error("Выберите модель");
      return;
    }
    setLoading("upload-doc", true);
    try {
      await hierarchyApi.uploadDocument(selectedModelId, file);
      toast.success("Документ загружен");
      await loadModelDetail(selectedModelId);
      setShowUpload(null);
    } catch {
      toast.error("Ошибка загрузки документа");
    } finally {
      setLoading("upload-doc", false);
    }
  };

  const handleVerify = async (modelId: number) => {
    try {
      await hierarchyApi.verifyModels([modelId], true);
      toast.success("Проверено экспертом");
      if (selectedModelId === modelId) await loadModelDetail(modelId);
    } catch {
      toast.error("Ошибка");
    }
  };

  const handleClassifyByName = async (data: {
    class_name: string;
    subclass_name: string | null;
    create_if_missing: boolean;
  }) => {
    if (!selectedModel) return;
    try {
      const updated = (await hierarchyApi.classifyModelByName(
        selectedModel.id,
        data,
      )) as ModelDetail;
      setSelectedModel(updated);
      toast.success("Класс / подкласс обновлён");
      await Promise.all([reloadModels(), reloadClasses()]);
    } catch {
      toast.error("Не удалось привязать класс");
    }
  };

  const handleReset = async () => {
    if (!confirm("Очистить базу данных? Все данные будут удалены.")) return;
    setLoadingData(true);
    try {
      await systemApi.reset();
      setTree([]);
      setModels([]);
      setClasses([]);
      setSelectedModel(null);
      setDataLoaded(false);
      toast.success("База данных очищена");
    } catch {
      toast.error("Ошибка очистки");
    } finally {
      setLoadingData(false);
    }
  };

  if (!dataLoaded && !showUpload) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Database size={32} className="text-blue-600" />
        </div>
        <div className="text-center max-w-xl">
          <h1 className="text-2xl font-semibold text-slate-800 mb-2">
            НСИ ТОиР
          </h1>
          <p className="text-sm text-slate-500">
            Загрузите иерархию оборудования, модели и классификатор для начала
            работы.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <ActionButton
            label="Загрузить из БД"
            onClick={loadData}
            icon={<Database size={16} />}
          />
          {loadingData && (
            <span className="self-center text-xs text-slate-400">
              Загрузка…
            </span>
          )}
          <ActionButton
            label="Иерархия"
            onClick={() => setShowUpload("hierarchy")}
            variant="secondary"
            icon={<Upload size={16} />}
          />
          <ActionButton
            label="Модели"
            onClick={() => setShowUpload("models")}
            variant="secondary"
            icon={<Network size={16} />}
          />
          <ActionButton
            label="Классификатор"
            onClick={() => setShowUpload("classifier")}
            variant="secondary"
            icon={<Tag size={16} />}
          />
          <ActionButton
            label="Характеристики класса"
            onClick={() => setShowUpload("class-characteristics")}
            variant="secondary"
            icon={<Tag size={16} />}
          />
          <ActionButton
            label="Очистить"
            onClick={handleReset}
            variant="danger"
            icon={<Trash2 size={16} />}
          />
        </div>
        {showUpload && (
          <div className="w-full max-w-md">
            <GlassPanel
              title={`Загрузка: ${uploadLabel(showUpload)}`}
              action={
                <button
                  onClick={() => setShowUpload(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              }
            >
              <FileUpload
                onUpload={(f) => handleUpload(showUpload!, f)}
                loading={loading[`upload-${showUpload}`]}
              />
            </GlassPanel>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
          <Network size={20} className="text-blue-600" /> Иерархия и ТОР
        </h1>
        <div className="flex flex-wrap gap-1.5">
          <ActionButton
            label="Иерархия"
            onClick={() => setShowUpload("hierarchy")}
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
          />
          <ActionButton
            label="Модели"
            onClick={() => setShowUpload("models")}
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
          />
          <ActionButton
            label="Классификатор"
            onClick={() => setShowUpload("classifier")}
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
          />
          <ActionButton
            label="Характеристики класса"
            onClick={() => setShowUpload("class-characteristics")}
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
          />
        </div>
      </div>

      {showUpload && (
        <GlassPanel
          title={`Загрузка: ${uploadLabel(showUpload)}`}
          action={
            <button
              onClick={() => setShowUpload(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          }
        >
          <FileUpload
            onUpload={(f) => handleUpload(showUpload!, f)}
            loading={loading[`upload-${showUpload}`]}
          />
        </GlassPanel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassPanel
          className="max-h-[72vh] overflow-y-auto"
          title={
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setSidePanel("hierarchy")}
                className={`px-2 py-1 rounded-md ${
                  sidePanel === "hierarchy"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Иерархия
              </button>
              <button
                type="button"
                onClick={() => setSidePanel("classifier")}
                className={`px-2 py-1 rounded-md ${
                  sidePanel === "classifier"
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Классификатор
              </button>
            </div>
          }
        >
          {sidePanel === "hierarchy" ? (
            <HierarchyTree
              tree={tree}
              selectedId={hierarchySelection}
              onSelect={openNodeCard}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Классов: {classes.length}
                </span>
                {classifierSelection && (
                  <button
                    type="button"
                    onClick={() => openClassCard(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Сбросить фильтр
                  </button>
                )}
              </div>
              <ClassifierTree
                classes={classes}
                selection={classifierSelection}
                onSelect={openClassCard}
              />
            </div>
          )}
        </GlassPanel>

        <GlassPanel
          className="max-h-[72vh] overflow-y-auto"
          title={`ТОР · ${visibleModels.length}`}
          action={
            <div className="flex flex-wrap gap-1.5">
              <ActionButton
                label="Нормализовать"
                onClick={handleNormalize}
                loading={loading.normalize}
                size="sm"
                icon={<RefreshCw size={12} />}
                variant="secondary"
              />
              <ActionButton
                label="Классифицировать"
                onClick={handleClassify}
                loading={loading.classify}
                size="sm"
                icon={<Tag size={12} />}
                variant="secondary"
              />
              <ActionButton
                label="AI"
                onClick={handleClassifyWeb}
                loading={loading["classify-web"]}
                variant="secondary"
                size="sm"
                icon={<Sparkles size={12} />}
              />
            </div>
          }
        >
          <div className="mb-3 relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Поиск по имени или коду…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:border-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {unclassifiedCount > 0 && (
            <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-1.5">
              Не классифицировано: {unclassifiedCount} ТОР
            </div>
          )}

          <div className="space-y-0.5">
            {visibleModels.map((model) => (
              <div
                key={model.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors ${
                  selectedModelId === model.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => loadModelDetail(model.id)}
              >
                <span className="truncate flex-1">
                  {model.normalized_name || model.original_name}
                </span>
                <Tag
                  size={12}
                  className={
                    model.class_id ? "text-emerald-500" : "text-amber-500"
                  }
                />
                {model.verified && (
                  <Check size={12} className="text-emerald-600" />
                )}
              </div>
            ))}
            {!visibleModels.length && (
              <div className="text-xs text-slate-400 italic text-center py-6">
                ТОР не найдены — попробуйте сбросить фильтры.
              </div>
            )}
          </div>
        </GlassPanel>

        <GlassPanel
          title="Карточка ТОР"
          className="max-h-[72vh] overflow-y-auto"
          action={
            selectedModel ? (
              <div className="flex items-center gap-2">
                <SourceBadge source={selectedModel.source_type} />
                <VerifiedBadge verified={selectedModel.verified} />
              </div>
            ) : null
          }
        >
          {selectedModel ? (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Код модели
                </div>
                <div className="text-base font-semibold text-slate-800 break-words">
                  {selectedModel.model_code ||
                    selectedModel.normalized_name ||
                    selectedModel.original_name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  ориг.: {selectedModel.original_name}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Классификация
                </div>
                <ClassPicker
                  classes={classes as ClassOption[]}
                  classId={selectedModel.class_id}
                  subclassId={selectedModel.subclass_id}
                  onChange={handleClassifyByName}
                />
              </div>

              <ConfidenceBar value={selectedModel.confidence} />

              <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2">
                <span className="flex items-center gap-1">
                  <FileUp size={12} /> {selectedModel.documents_count} док.
                </span>
                <span className="flex items-center gap-1">
                  <Database size={12} /> {selectedModel.characteristics_count}{" "}
                  харак.
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                <ActionButton
                  label="Документ"
                  onClick={() => setShowUpload("document")}
                  variant="secondary"
                  size="sm"
                  icon={<FileUp size={14} />}
                />
                <ActionButton
                  label="Проверено"
                  onClick={() => handleVerify(selectedModel.id)}
                  size="sm"
                  icon={<Check size={14} />}
                />
              </div>

              {showUpload === "document" && (
                <FileUpload
                  onUpload={handleUploadDocument}
                  loading={loading["upload-doc"]}
                  label="Загрузить документ на ТОР"
                />
              )}

              <div className="border-t border-slate-200 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                  Поиск аналогов
                </div>
                <AnalogSearch modelId={selectedModel.id} />
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              <Network size={28} className="mx-auto mb-2 opacity-40" />
              Выберите ТОР для просмотра карточки.
            </div>
          )}
        </GlassPanel>
      </div>

      <InfoDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={
          drawer?.kind === "node" ? drawer.data.name : (drawer?.data.name ?? "")
        }
        subtitle={
          drawer?.kind === "node"
            ? drawer.data.level_type
            : drawer?.kind === "class" && drawer.data.subclass_name
              ? `Подкласс: ${drawer.data.subclass_name}`
              : "Класс"
        }
      >
        {drawer?.kind === "node" && <NodeCardBody card={drawer.data} />}
        {drawer?.kind === "class" && <ClassCardBody card={drawer.data} />}
      </InfoDrawer>
    </div>
  );
}

function uploadLabel(type: string) {
  switch (type) {
    case "hierarchy":
      return "Иерархия";
    case "models":
      return "Модели";
    case "classifier":
      return "Классификатор";
    case "class-characteristics":
      return "Характеристики класса/подкласса";
    case "document":
      return "Документ ТОР";
    default:
      return type;
  }
}

function NodeCardBody({ card }: { card: any }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Дочерних узлов" value={card.children_count} />
        <Stat label="Всех потомков" value={card.descendants_count} />
        <Stat label="ТОР под узлом" value={card.descendant_models_count} />
        <Stat label="ТОР напрямую" value={card.direct_models_count} />
      </div>
      {card.description && (
        <p className="text-xs text-slate-600">{card.description}</p>
      )}
      {card.sample_models?.length ? (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            ТОР под узлом
          </div>
          <ul className="space-y-1 text-xs">
            {card.sample_models.map((m: any) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {m.normalized_name || m.original_name}
                </span>
                {m.class_id ? (
                  <Tag size={10} className="text-emerald-500" />
                ) : (
                  <Tag size={10} className="text-amber-500" />
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ClassCardBody({ card }: { card: any }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Подклассов" value={card.subclasses?.length ?? 0} />
        <Stat label="ТОР в выборке" value={card.model_count} />
      </div>
      {card.characteristics?.length ? (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Характеристики
          </div>
          <ul className="space-y-1 text-xs">
            {card.characteristics.map((c: any) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{c.name}</span>
                <span className="text-slate-500">{c.unit_symbol ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">
          Характеристики класса не загружены.
        </p>
      )}
      {card.sample_models?.length ? (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Примеры ТОР
          </div>
          <ul className="space-y-1 text-xs">
            {card.sample_models.slice(0, 12).map((m: any) => (
              <li key={m.id} className="truncate">
                {m.normalized_name || m.original_name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-sm font-medium text-slate-800 tabular-nums">
        {value}
      </div>
    </div>
  );
}
