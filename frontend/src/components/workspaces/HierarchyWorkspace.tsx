import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Network, Upload, RefreshCw, Tag, FileUp, ChevronRight, ChevronDown, Edit2, Check, X, Database, Sparkles, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel, ActionButton, SourceBadge, ConfidenceBar, VerifiedBadge } from '../ui/GlassCard'
import { FileUpload } from '../ui/FileUpload'
import { hierarchyApi, massProcessingApi, systemApi } from '../../api'
import { useAppStore } from '../../store'

interface TreeNode {
  id: number
  name: string
  parent_id: number | null
  level_type: string
  children: TreeNode[]
}

interface ModelDetail {
  id: number
  original_name: string
  normalized_name: string | null
  model_code: string | null
  class_id: number | null
  subclass_id: number | null
  class_name: string | null
  subclass_name: string | null
  source_type: string | null
  confidence: number | null
  source_url: string | null
  verified: boolean
  documents_count: number
  characteristics_count: number
}

function TreeItem({ node, selectedId, onSelect, depth = 0 }: {
  node: TreeNode, selectedId: number | null, onSelect: (id: number) => void, depth?: number
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = node.children && node.children.length > 0
  const isSelected = selectedId === node.id

  return (
    <div>
      <motion.div
        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-sm ${
          isSelected ? 'bg-neon/10 text-neon' : 'text-text-secondary hover:bg-glass-hover hover:text-text-primary'
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => { if (hasChildren) setExpanded(!expanded); onSelect(node.id) }}
        whileHover={{ x: 3 }}
        transition={{ duration: 0.15 }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={14} className="text-purple" /> : <ChevronRight size={14} className="text-text-muted" />
        ) : (
          <span className="w-3.5" />
        )}
        <Network size={14} className={isSelected ? 'text-neon' : 'text-neon-dim'} />
        <span className="truncate">{node.name}</span>
      </motion.div>
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            {node.children.map((child) => (
              <TreeItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as any } },
}

export function HierarchyWorkspace() {
  const { selectedModelId, setSelectedModelId, setSelectedNodeId, loading, setLoading } = useAppStore()
  const [tree, setTree] = useState<TreeNode[]>([])
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelDetail | null>(null)
  const [showUpload, setShowUpload] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [dataLoaded, setDataLoaded] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadData = async () => {
    if (loadingData) return
    setLoadingData(true)
    try {
      const [treeData, modelsData] = await Promise.all([
        hierarchyApi.getTree(),
        hierarchyApi.getModels({ limit: 200 }),
      ])
      setTree(treeData as TreeNode[])
      setModels(modelsData as any[])
      const hasData = (treeData as TreeNode[]).length > 0 || (modelsData as any[]).length > 0
      setDataLoaded(hasData)
    } catch (e) {
      toast.error('Ошибка загрузки данных')
    } finally {
      setLoadingData(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Очистить базу данных? Все данные будут удалены.')) return
    setLoadingData(true)
    try {
      await systemApi.reset()
      setTree([])
      setModels([])
      setDataLoaded(false)
      toast.success('База данных очищена')
    } catch (e) {
      toast.error('Ошибка очистки')
    } finally {
      setLoadingData(false)
    }
  }

  const searchModels = async (query: string) => {
    setLoadingData(true)
    try {
      const modelsData = await hierarchyApi.getModels({ q: query, limit: 200 })
      setModels(modelsData as any[])
    } catch (e) {
      toast.error('Ошибка поиска')
    } finally {
      setLoadingData(false)
    }
  }

  // Не загружаем автоматически - только по кнопке

  const loadModelDetail = async (id: number) => {
    try {
      const detail = await hierarchyApi.getModelDetail(id)
      setSelectedModel(detail as ModelDetail)
      setSelectedModelId(id)
    } catch (e) {
      toast.error('Ошибка загрузки модели')
    }
  }

  const handleNodeSelect = (nodeId: number) => { setSelectedNodeId(nodeId) }

  const handleNormalize = async () => {
    setLoading('normalize', true)
    try {
      const result = await hierarchyApi.normalizeModels() as any
      toast.success(result.message)
      loadData()
    } catch (e) { toast.error('Ошибка нормализации') }
    finally { setLoading('normalize', false) }
  }

  const handleClassify = async () => {
    setLoading('classify', true)
    try {
      const result = await hierarchyApi.classifyModels() as any
      toast.success(result.message)
      loadData()
    } catch (e) { toast.error('Ошибка классификации') }
    finally { setLoading('classify', false) }
  }

  const handleClassifyWeb = async () => {
    setLoading('classify-web', true)
    try {
      const result = await hierarchyApi.classifyModelsViaWeb() as any
      toast.success(result.message)
      loadData()
    } catch (e) { toast.error('Ошибка AI-классификации') }
    finally { setLoading('classify-web', false) }
  }

  const handleUpload = async (type: string, file: File) => {
    setLoading(`upload-${type}`, true)
    try {
      let result: any
      switch (type) {
        case 'hierarchy': result = await hierarchyApi.uploadHierarchy(file); break
        case 'models': result = await hierarchyApi.uploadModels(file); break
        case 'classifier': result = await hierarchyApi.uploadClassifier(file); break
        case 'class-characteristics': result = await massProcessingApi.uploadClassCharacteristics(file); break
        default: return
      }
      toast.success(result.message)
      loadData()
      setShowUpload(null)
    } catch (e) { toast.error('Ошибка загрузки файла') }
    finally { setLoading(`upload-${type}`, false) }
  }

  const handleUploadDocument = async (file: File) => {
    if (!selectedModelId) return toast.error('Выберите модель')
    setLoading('upload-doc', true)
    try {
      await hierarchyApi.uploadDocument(selectedModelId, file)
      toast.success('Документ загружен')
      loadModelDetail(selectedModelId)
      setShowUpload(null)
    } catch (e) { toast.error('Ошибка загрузки документа') }
    finally { setLoading('upload-doc', false) }
  }

  const handleVerify = async (modelId: number) => {
    try {
      await hierarchyApi.verifyModels([modelId], true)
      toast.success('Проверено экспертом')
      if (selectedModelId === modelId) loadModelDetail(modelId)
    } catch (e) { toast.error('Ошибка') }
  }

  const startEdit = (field: string, value: string) => { setEditingField(field); setEditValue(value || '') }

  const saveEdit = async () => {
    if (!selectedModel || !editingField) return
    try {
      await hierarchyApi.updateModel(selectedModel.id, { [editingField]: editValue })
      toast.success('Обновлено')
      loadModelDetail(selectedModel.id)
    } catch (e) { toast.error('Ошибка обновления') }
    setEditingField(null)
  }

  const unclassifiedCount = models.filter(m => !m.class_id).length

  if (!dataLoaded && !showUpload) {
    return (
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div variants={itemVariants} className="animate-float mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon/20 via-purple/20 to-pink/20 flex items-center justify-center animate-glow-pulse">
            <Database size={48} className="text-neon" />
          </div>
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-4xl font-bold gradient-text mb-4">
          ИИ НСИ ТОиР
        </motion.h1>
        <motion.p variants={itemVariants} className="text-gray-500 text-lg mb-8 text-center max-w-xl">
          Загрузите иерархию оборудования, модели и классификатор для начала работы
        </motion.p>
        <motion.div variants={itemVariants} className="flex flex-wrap gap-3 justify-center">
          <ActionButton label="Загрузить из БД" onClick={loadData} icon={<Database size={18} />} />
          {loadingData && <span className="text-gray-400 text-sm self-center">Загрузка...</span>}
          <ActionButton label="Очистить БД" onClick={handleReset} icon={<Trash2 size={18} />} variant="danger" />
          <ActionButton label="Загрузить иерархию" onClick={() => setShowUpload('hierarchy')} icon={<Upload size={18} />} variant="secondary" />
          <ActionButton label="Загрузить модели" onClick={() => setShowUpload('models')} variant="secondary" icon={<Network size={18} />} />
          <ActionButton label="Загрузить классификатор" onClick={() => setShowUpload('classifier')} variant="secondary" icon={<Tag size={18} />} />
          <ActionButton label="Характеристики (класс/подкласс)" onClick={() => setShowUpload('class-characteristics')} variant="secondary" icon={<Tag size={18} />} />
        </motion.div>
        <AnimatePresence>
          {showUpload && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="mt-8 w-full max-w-md">
              <GlassPanel title={`Загрузка: ${
                showUpload === 'hierarchy' ? 'Иерархия'
                : showUpload === 'models' ? 'Модели'
                : showUpload === 'classifier' ? 'Классификатор'
                : showUpload === 'class-characteristics' ? 'Характеристики (класс/подкласс)'
                : showUpload
              }`} action={
                <button onClick={() => setShowUpload(null)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
              }>
                <FileUpload onUpload={(f) => handleUpload(showUpload!, f)} loading={loading[`upload-${showUpload}`]} />
              </GlassPanel>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold neon-text flex items-center gap-3">
          <Network size={28} /> Иерархия и модели
        </h1>
        <div className="flex gap-2 flex-wrap">
          <ActionButton label="Иерархия" onClick={() => setShowUpload('hierarchy')} variant="secondary" icon={<Upload size={14} />} size="sm" />
          <ActionButton label="Модели" onClick={() => setShowUpload('models')} variant="secondary" icon={<Upload size={14} />} size="sm" />
          <ActionButton label="Классификатор" onClick={() => setShowUpload('classifier')} variant="secondary" icon={<Upload size={14} />} size="sm" />
        </div>
      </motion.div>

      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <GlassPanel title={`Загрузка: ${
              showUpload === 'hierarchy' ? 'Иерархия'
              : showUpload === 'models' ? 'Модели'
              : showUpload === 'classifier' ? 'Классификатор'
              : showUpload === 'class-characteristics' ? 'Характеристики (класс/подкласс)'
              : showUpload
            }`} action={
              <button onClick={() => setShowUpload(null)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            }>
              <FileUpload onUpload={(f) => handleUpload(showUpload!, f)} loading={loading[`upload-${showUpload}`]} />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassPanel title="Иерархия" className="max-h-[65vh] overflow-y-auto card-hover-effect">
          {tree.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-8">Загрузите иерархию оборудования</p>
          ) : (
            tree.map((node) => (
              <TreeItem key={node.id} node={node} selectedId={selectedModelId} onSelect={handleNodeSelect} />
            ))
          )}
        </GlassPanel>

        <GlassPanel title={`Модели (${models.length})`} className="max-h-[65vh] overflow-y-auto card-hover-effect" action={
          <div className="flex gap-1.5 flex-wrap">
            <ActionButton label="Нормализовать" onClick={handleNormalize} loading={loading.normalize} size="sm" icon={<RefreshCw size={12} />} />
            <ActionButton label="Классификация" onClick={handleClassify} loading={loading.classify} size="sm" icon={<Tag size={12} />} />
            <ActionButton label="AI" onClick={handleClassifyWeb} loading={loading['classify-web']} variant="secondary" size="sm" icon={<Sparkles size={12} />} />
          </div>
        }>
          <div className="mb-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по БД..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchModels(searchQuery)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); loadData(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          {unclassifiedCount > 0 && (
            <div className="mb-3 text-xs text-orange bg-orange/10 border border-orange/20 rounded-lg px-3 py-2">
              Не классифицировано: {unclassifiedCount} моделей
            </div>
          )}
          <div className="space-y-0.5">
            {models.map((model, idx) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                  selectedModelId === model.id ? 'bg-neon/10 text-neon shadow-[0_0_8px_rgba(0,212,255,0.15)]' : 'text-text-secondary hover:bg-glass-hover'
                }`}
                onClick={() => loadModelDetail(model.id)}
              >
                <span className="truncate flex-1">{model.normalized_name || model.original_name}</span>
                {model.class_id ? <Tag size={12} className="text-emerald" /> : <Tag size={12} className="text-orange" />}
                {model.verified && <Check size={12} className="text-success" />}
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title="Карточка ТОР" className="max-h-[65vh] overflow-y-auto card-hover-effect">
          {selectedModel ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-neon text-lg">{selectedModel.model_code || selectedModel.normalized_name}</h4>
                <div className="flex items-center gap-2">
                  <SourceBadge source={selectedModel.source_type} />
                  <VerifiedBadge verified={selectedModel.verified} />
                </div>
              </div>

              <div className="space-y-3">
                <EditableField label="Оригинальное название" value={selectedModel.original_name} field="original_name" editingField={editingField} editValue={editValue} setEditValue={setEditValue} onStartEdit={startEdit} onSave={saveEdit} onCancel={() => setEditingField(null)} />
                <EditableField label="Нормализованное" value={selectedModel.normalized_name} field="normalized_name" editingField={editingField} editValue={editValue} setEditValue={setEditValue} onStartEdit={startEdit} onSave={saveEdit} onCancel={() => setEditingField(null)} />
                <EditableField label="Код модели" value={selectedModel.model_code} field="model_code" editingField={editingField} editValue={editValue} setEditValue={setEditValue} onStartEdit={startEdit} onSave={saveEdit} onCancel={() => setEditingField(null)} />

                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-panel p-3 rounded-lg">
                    <label className="text-[10px] uppercase tracking-wider text-text-muted">Класс</label>
                    <div className="text-sm mt-1 font-medium">{selectedModel.class_name || <span className="text-text-muted italic text-xs">Не определён</span>}</div>
                  </div>
                  <div className="glass-panel p-3 rounded-lg">
                    <label className="text-[10px] uppercase tracking-wider text-text-muted">Подкласс</label>
                    <div className="text-sm mt-1 font-medium">{selectedModel.subclass_name || <span className="text-text-muted italic text-xs">Не определён</span>}</div>
                  </div>
                </div>

                <ConfidenceBar value={selectedModel.confidence} />

                <div className="flex items-center gap-4 text-xs text-text-muted glass-panel p-2 rounded-lg">
                  <span className="flex items-center gap-1"><FileUp size={12} /> {selectedModel.documents_count} док.</span>
                  <span className="flex items-center gap-1"><Database size={12} /> {selectedModel.characteristics_count} характ.</span>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <ActionButton label="Документ" onClick={() => setShowUpload('document')} variant="secondary" size="sm" icon={<FileUp size={14} />} />
                <ActionButton label="Проверено" onClick={() => handleVerify(selectedModel.id)} size="sm" icon={<Check size={14} />} />
              </div>

              <AnimatePresence>
                {showUpload === 'document' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <FileUpload onUpload={handleUploadDocument} loading={loading['upload-doc']} label="Загрузить документ на ТОР" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <Network size={36} className="mx-auto text-text-muted mb-3 opacity-50" />
              <p className="text-text-muted text-sm">Выберите модель для просмотра карточки</p>
            </div>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}

function EditableField({ label, value, field, editingField, editValue, setEditValue, onStartEdit, onSave, onCancel }: {
  label: string, value: string | null, field: string, editingField: string | null, editValue: string, setEditValue: (v: string) => void, onStartEdit: (f: string, v: string) => void, onSave: () => void, onCancel: () => void
}) {
  const isEditing = editingField === field
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-text-muted">{label}</label>
      {isEditing ? (
        <div className="flex items-center gap-1 mt-1">
          <input
            className="flex-1 bg-graphite-lighter border border-neon/30 rounded-lg px-2 py-1 text-sm text-text-primary focus:border-neon focus:outline-none focus:shadow-[0_0_10px_rgba(0,212,255,0.2)]"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
            autoFocus
          />
          <button onClick={onSave} className="text-success hover:text-success/80 transition-colors"><Check size={16} /></button>
          <button onClick={onCancel} className="text-error hover:text-error/80 transition-colors"><X size={16} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-1 group">
          <span className="text-sm">{value || <span className="text-text-muted italic text-xs">пусто</span>}</span>
          <button onClick={() => onStartEdit(field, value || '')} className="text-text-muted hover:text-neon opacity-0 group-hover:opacity-100 transition-all"><Edit2 size={12} /></button>
        </div>
      )}
    </div>
  )
}
