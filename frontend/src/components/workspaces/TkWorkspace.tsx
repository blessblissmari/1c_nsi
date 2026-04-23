import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Globe, Check, Plus, Trash2, X, ChevronRight, Package, Wrench, Upload, Layers, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel, ActionButton, SourceBadge, ConfidenceBar, VerifiedBadge } from '../ui/GlassCard'
import { tkApi, hierarchyApi } from '../../api'
import { useAppStore } from '../../store'
import { FileUpload } from '../ui/FileUpload'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as any } },
}

export function TkWorkspace() {
  const { loading, setLoading } = useAppStore()
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<number | null>(null)
  const [components, setComponents] = useState<any[]>([])
  const [selectedComponent, setSelectedComponent] = useState<number | null>(null)
  const [operations, setOperations] = useState<any[]>([])
  const [selectedOperation, setSelectedOperation] = useState<number | null>(null)
  const [tmcItems, setTmcItems] = useState<any[]>([])
  const [professions, setProfessions] = useState<any[]>([])
  const [qualifications, setQualifications] = useState<any[]>([])
  const [editOpProfession, setEditOpProfession] = useState('')
  const [editOpQualification, setEditOpQualification] = useState('')
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [showAddOperation, setShowAddOperation] = useState(false)
  const [showAddTmc, setShowAddTmc] = useState(false)
  const [showUploadOps, setShowUploadOps] = useState(false)
  const [showUploadProf, setShowUploadProf] = useState(false)
  const [showUploadQual, setShowUploadQual] = useState(false)
  const [showUploadLabor, setShowUploadLabor] = useState(false)
  const [showTmcSummary, setShowTmcSummary] = useState(false)
  const [tmcSummary, setTmcSummary] = useState<any[]>([])
  const [showAoplAnalogs, setShowAoplAnalogs] = useState(false)
  const [aoplAnalogs, setAoplAnalogs] = useState<any[]>([])
  const [newComponent, setNewComponent] = useState({ name: '', component_type: 'узел' })
  const [newOperation, setNewOperation] = useState({ custom_name: '', profession: '', qualification: '', labor_hours: '' })
  const [newTmc, setNewTmc] = useState({ name: '', code: '', unit_symbol: '', quantity: '', consumption_rate: '' })
  const [dataLoaded, setDataLoaded] = useState(false)

  const selectedCompObj = components.find((c) => c.id === selectedComponent)
  const selectedOpObj = operations.find((o) => o.id === selectedOperation)

  useEffect(() => {
    loadModels()
    loadResources()
  }, [])

  useEffect(() => {
    if (!selectedOpObj) {
      setEditOpProfession('')
      setEditOpQualification('')
      return
    }
    setEditOpProfession(selectedOpObj.profession || '')
    setEditOpQualification(selectedOpObj.qualification || '')
  }, [selectedOpObj?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadModels = async () => {
    try {
      const data = await hierarchyApi.getModels({ limit: 200, has_class: true })
      setModels(data as any[])
      setDataLoaded((data as any[]).length > 0)
    } catch (e) {
      toast.error('Ошибка загрузки моделей')
    }
  }

  const loadResources = async () => {
    try {
      const [p, q] = await Promise.all([tkApi.getProfessions(), tkApi.getQualifications()])
      setProfessions(p as any[])
      setQualifications(q as any[])
    } catch {
      // silent
    }
  }

  const loadComponents = async (modelId: number) => {
    setSelectedModel(modelId)
    setSelectedComponent(null)
    setSelectedOperation(null)
    setOperations([])
    setTmcItems([])
    try {
      const data = await tkApi.getComponents(modelId)
      setComponents(data as any[])
    } catch (e) {
      toast.error('Ошибка загрузки компонентов')
    }
  }

  const loadOperations = async (componentId: number) => {
    setSelectedComponent(componentId)
    setSelectedOperation(null)
    setTmcItems([])
    try {
      const data = await tkApi.getOperations(componentId)
      setOperations(data as any[])
    } catch (e) {
      toast.error('Ошибка загрузки операций')
    }
  }

  const loadTmc = async (operationId: number) => {
    setSelectedOperation(operationId)
    try {
      const data = await tkApi.getTmc(operationId)
      setTmcItems(data as any[])
    } catch (e) {
      toast.error('Ошибка загрузки ТМЦ')
    }
  }

  const handleUploadOperations = async (file: File) => {
    setLoading('upload-ops', true)
    try {
      const result = await tkApi.uploadOperationCatalog(file) as any
      toast.success(result.message || 'Загружено')
      setShowUploadOps(false)
    } catch (e) {
      toast.error('Ошибка загрузки операций')
    } finally {
      setLoading('upload-ops', false)
    }
  }

  const handleUploadProfessions = async (file: File) => {
    setLoading('upload-prof', true)
    try {
      const result = await tkApi.uploadProfessions(file) as any
      toast.success(result.message || 'Загружено')
      setShowUploadProf(false)
    } catch (e) {
      toast.error('Ошибка загрузки профессий')
    } finally {
      setLoading('upload-prof', false)
    }
  }

  const handleUploadQualifications = async (file: File) => {
    setLoading('upload-qual', true)
    try {
      const result = await tkApi.uploadQualifications(file) as any
      toast.success(result.message || 'Загружено')
      setShowUploadQual(false)
    } catch (e) {
      toast.error('Ошибка загрузки квалификаций')
    } finally {
      setLoading('upload-qual', false)
    }
  }

  const handleUploadLaborNorms = async (file: File) => {
    setLoading('upload-labor', true)
    try {
      const result = await tkApi.uploadLaborNorms(file) as any
      toast.success(result.message || 'Загружено')
      setShowUploadLabor(false)
    } catch (e) {
      toast.error('Ошибка загрузки трудоемкости')
    } finally {
      setLoading('upload-labor', false)
    }
  }

  const handleNormalizeOperations = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('normalize-ops', true)
    try {
      const result = await tkApi.normalizeOperations(selectedModel) as any
      toast.success(result.message || 'Нормализовано')
      if (selectedComponent) loadOperations(selectedComponent)
    } catch (e) {
      toast.error('Ошибка нормализации')
    } finally {
      setLoading('normalize-ops', false)
    }
  }

  const handleTmcSummary = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('tmc-summary', true)
    try {
      const data = await tkApi.getTmcSummary(selectedModel)
      setTmcSummary(data as any[])
      setShowTmcSummary(true)
    } catch (e) {
      toast.error('Ошибка свода ТМЦ')
    } finally {
      setLoading('tmc-summary', false)
    }
  }

  const handleFillLaborFromSource = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('fill-labor', true)
    try {
      const result = await tkApi.fillLaborFromSource(selectedModel) as any
      toast.success(result.message || 'Готово')
      if (selectedComponent) loadOperations(selectedComponent)
    } catch (e) {
      toast.error('Ошибка заполнения трудоемкости')
    } finally {
      setLoading('fill-labor', false)
    }
  }

  const handleSearchAoplAnalogs = async (tmcId: number) => {
    setLoading('aopl-analogs', true)
    try {
      const data = await tkApi.searchAoplAnalogs(tmcId)
      setAoplAnalogs(data as any[])
      setShowAoplAnalogs(true)
    } catch (e) {
      toast.error('Ошибка поиска аналогов')
    } finally {
      setLoading('aopl-analogs', false)
    }
  }

  // ── Component actions ───────────────────────────────────────────

  const handleFillComponents = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('fill-components', true)
    try {
      const result = await tkApi.fillComponents(selectedModel) as any
      toast.success(result.message)
      loadComponents(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    } finally {
      setLoading('fill-components', false)
    }
  }

  const handleEnrichComponents = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('enrich-components', true)
    try {
      const result = await tkApi.enrichComponents(selectedModel) as any
      toast.success(result.message)
      loadComponents(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    } finally {
      setLoading('enrich-components', false)
    }
  }

  const handleAddComponent = async () => {
    if (!selectedModel || !newComponent.name) return
    try {
      await tkApi.createComponent({
        model_id: selectedModel,
        name: newComponent.name,
        component_type: newComponent.component_type,
      })
      toast.success('Компонент добавлен')
      setNewComponent({ name: '', component_type: 'узел' })
      setShowAddComponent(false)
      loadComponents(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  const handleDeleteComponent = async (id: number) => {
    try {
      await tkApi.deleteComponent(id)
      toast.success('Удалено')
      if (selectedModel) loadComponents(selectedModel)
      if (selectedComponent === id) {
        setSelectedComponent(null)
        setOperations([])
        setTmcItems([])
      }
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  // ── Operation actions ───────────────────────────────────────────

  const handleFillOperations = async () => {
    if (!selectedComponent) return toast.error('Выберите компонент')
    setLoading('fill-operations', true)
    try {
      const result = await tkApi.fillOperations(selectedComponent) as any
      toast.success(result.message)
      loadOperations(selectedComponent)
    } catch (e) {
      toast.error('Ошибка')
    } finally {
      setLoading('fill-operations', false)
    }
  }

  const handleEnrichOperations = async () => {
    if (!selectedComponent) return toast.error('Выберите компонент')
    setLoading('enrich-operations', true)
    try {
      const result = await tkApi.enrichOperations(selectedComponent) as any
      toast.success(result.message)
      loadOperations(selectedComponent)
    } catch (e) {
      toast.error('Ошибка')
    } finally {
      setLoading('enrich-operations', false)
    }
  }

  const handleAddOperation = async () => {
    if (!selectedComponent || !newOperation.custom_name) return
    try {
      await tkApi.createOperation({
        component_id: selectedComponent,
        custom_name: newOperation.custom_name,
        profession: newOperation.profession || null,
        qualification: newOperation.qualification || null,
        labor_hours: newOperation.labor_hours ? parseFloat(newOperation.labor_hours) : null,
      })
      toast.success('Операция добавлена')
      setNewOperation({ custom_name: '', profession: '', qualification: '', labor_hours: '' })
      setShowAddOperation(false)
      loadOperations(selectedComponent)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  const handleDeleteOperation = async (id: number) => {
    try {
      await tkApi.deleteOperation(id)
      toast.success('Удалено')
      if (selectedComponent) loadOperations(selectedComponent)
      if (selectedOperation === id) {
        setSelectedOperation(null)
        setTmcItems([])
      }
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  // ── TMC actions ─────────────────────────────────────────────────

  const handleFillTmc = async () => {
    if (!selectedOperation) return toast.error('Выберите операцию')
    setLoading('fill-tmc', true)
    try {
      const result = await tkApi.fillTmc(selectedOperation) as any
      toast.success(result.message)
      loadTmc(selectedOperation)
    } catch (e) {
      toast.error('Ошибка')
    } finally {
      setLoading('fill-tmc', false)
    }
  }

  const handleEnrichTmc = async () => {
    if (!selectedOperation) return toast.error('Выберите операцию')
    setLoading('enrich-tmc', true)
    try {
      const result = await tkApi.enrichTmc(selectedOperation) as any
      toast.success(result.message)
      loadTmc(selectedOperation)
    } catch (e) {
      toast.error('Ошибка')
    } finally {
      setLoading('enrich-tmc', false)
    }
  }

  const handleAddTmc = async () => {
    if (!selectedOperation || !newTmc.name) return
    try {
      await tkApi.createTmc({
        operation_id: selectedOperation,
        name: newTmc.name,
        code: newTmc.code || null,
        unit_symbol: newTmc.unit_symbol || null,
        quantity: newTmc.quantity ? parseFloat(newTmc.quantity) : null,
        consumption_rate: newTmc.consumption_rate ? parseFloat(newTmc.consumption_rate) : null,
      })
      toast.success('ТМЦ добавлена')
      setNewTmc({ name: '', code: '', unit_symbol: '', quantity: '', consumption_rate: '' })
      setShowAddTmc(false)
      loadTmc(selectedOperation)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  const handleDeleteTmc = async (id: number) => {
    try {
      await tkApi.deleteTmc(id)
      toast.success('Удалено')
      if (selectedOperation) loadTmc(selectedOperation)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  // ── Verify ─────────────────────────────────────────────────────

  const handleVerify = async (type: 'component' | 'operation' | 'tmc', id: number) => {
    try {
      if (type === 'component') {
        await tkApi.verify({ component_ids: [id], verified: true })
      } else if (type === 'operation') {
        await tkApi.verify({ operation_ids: [id], verified: true })
      } else {
        await tkApi.verify({ tmc_ids: [id], verified: true })
      }
      toast.success('Проверено')
      if (selectedModel) loadComponents(selectedModel)
      if (selectedComponent) loadOperations(selectedComponent)
      if (selectedOperation) loadTmc(selectedOperation)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  // ── Empty state ─────────────────────────────────────────────────

  if (!dataLoaded) {
    return (
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div variants={itemVariants} className="animate-float mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink/20 via-orange/20 to-neon/20 flex items-center justify-center animate-glow-pulse">
            <FileText size={48} className="text-pink" />
          </div>
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-4xl font-bold gradient-text mb-4">
          ТК ТОиР
        </motion.h1>
        <motion.p variants={itemVariants} className="text-text-secondary text-lg mb-2 text-center max-w-xl">
          Сначала классифицируйте модели в разделе «Иерархия»
        </motion.p>
        <motion.p variants={itemVariants} className="text-text-muted text-sm text-center max-w-lg">
          Формирование состава компонентов, операций, трудоёмкости, ТМЦ
        </motion.p>
      </motion.div>
    )
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold neon-text flex items-center gap-3">
          <FileText size={28} /> Технологическая карта ТОиР
        </h1>
        {selectedModel && (
          <div className="flex gap-2">
            <ActionButton label="Операции" onClick={() => setShowUploadOps(true)} variant="secondary" size="sm" icon={<Upload size={14} />} />
            <ActionButton label="Профессии" onClick={() => setShowUploadProf(true)} variant="secondary" size="sm" icon={<Upload size={14} />} />
            <ActionButton label="Квалиф." onClick={() => setShowUploadQual(true)} variant="secondary" size="sm" icon={<Upload size={14} />} />
            <ActionButton label="Трудоемк." onClick={() => setShowUploadLabor(true)} variant="secondary" size="sm" icon={<Upload size={14} />} />
            <ActionButton label="Нормализовать" onClick={handleNormalizeOperations} loading={loading['normalize-ops']} variant="secondary" size="sm" icon={<Layers size={14} />} />
            <ActionButton label="Свод ТМЦ" onClick={handleTmcSummary} loading={loading['tmc-summary']} variant="secondary" size="sm" icon={<Package size={14} />} />
            <ActionButton label="Трудоемк. из источн." onClick={handleFillLaborFromSource} loading={loading['fill-labor']} variant="secondary" size="sm" icon={<Wrench size={14} />} />
            <ActionButton label="Трудоемк. web" onClick={async () => {
              if (!selectedModel) return toast.error('Выберите модель')
              setLoading('labor-web', true)
              try {
                const result = await tkApi.enrichLaborFromWeb(selectedModel) as any
                toast.success(result.message || 'Готово')
                if (selectedComponent) loadOperations(selectedComponent)
              } catch (e) {
                toast.error('Ошибка трудоемкости web')
              } finally {
                setLoading('labor-web', false)
              }
            }} loading={loading['labor-web']} variant="secondary" size="sm" icon={<Globe size={14} />} />
            <ActionButton label="Из БД" onClick={handleFillComponents} loading={loading['fill-components']} size="sm" icon={<Package size={14} />} />
            <ActionButton label="AI" onClick={handleEnrichComponents} loading={loading['enrich-components']} variant="secondary" size="sm" icon={<Globe size={14} />} />
            <ActionButton label="Компонент" onClick={() => setShowAddComponent(true)} variant="secondary" size="sm" icon={<Plus size={14} />} />
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showUploadOps && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <GlassPanel title="Загрузка справочника операций" action={
              <button onClick={() => setShowUploadOps(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            }>
              <FileUpload onUpload={handleUploadOperations} loading={loading['upload-ops']} />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUploadProf && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <GlassPanel title="Загрузка справочника профессий" action={
              <button onClick={() => setShowUploadProf(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            }>
              <FileUpload onUpload={handleUploadProfessions} loading={loading['upload-prof']} />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUploadQual && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <GlassPanel title="Загрузка справочника квалификаций" action={
              <button onClick={() => setShowUploadQual(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            }>
              <FileUpload onUpload={handleUploadQualifications} loading={loading['upload-qual']} />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUploadLabor && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <GlassPanel title="Загрузка справочника трудоемкости" action={
              <button onClick={() => setShowUploadLabor(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            }>
              <FileUpload onUpload={handleUploadLaborNorms} loading={loading['upload-labor']} />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTmcSummary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowTmcSummary(false)}>
            <div className="glass-panel w-full max-w-4xl max-h-[80vh] m-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-glass-border">
                <h3 className="text-lg font-semibold text-text-primary">Сводный перечень ТМЦ</h3>
                <button onClick={() => setShowTmcSummary(false)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)] space-y-2">
                {tmcSummary.length > 0 ? tmcSummary.map((it: any, idx: number) => (
                  <div key={idx} className="glass-panel p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{it.name}</div>
                      <div className="text-xs text-text-muted flex gap-3 flex-wrap">
                        {it.code && <span>Код: {it.code}</span>}
                        {it.unit_symbol && <span>Ед.: {it.unit_symbol}</span>}
                        <span>Строк: {it.items_count}</span>
                      </div>
                    </div>
                    <div className="text-sm text-text-secondary whitespace-nowrap">
                      {Number(it.quantity_sum || 0).toFixed(2)}
                    </div>
                  </div>
                )) : (
                  <p className="text-text-muted text-sm text-center py-6">Пока нет ТМЦ</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAoplAnalogs && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowAoplAnalogs(false)}>
            <div className="glass-panel w-full max-w-3xl max-h-[75vh] m-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-glass-border">
                <h3 className="text-lg font-semibold text-text-primary">Аналоги AOPL (по БД)</h3>
                <button onClick={() => setShowAoplAnalogs(false)} className="text-text-muted hover:text-text-primary"><X size={20} /></button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(75vh-60px)] space-y-2">
                {aoplAnalogs.length > 0 ? aoplAnalogs.map((a: any) => (
                  <div key={a.tmc_id} className="glass-panel p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{a.name}</span>
                      <ConfidenceBar value={a.match_score} />
                    </div>
                    <div className="text-xs text-text-muted flex gap-3 flex-wrap mt-1">
                      {a.code && <span>Код: {a.code}</span>}
                      {a.unit_symbol && <span>Ед.: {a.unit_symbol}</span>}
                      <span>Источник: {a.source}</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-text-muted text-sm text-center py-6">Аналоги не найдены</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Models */}
        <GlassPanel title="Модели" className="max-h-[500px] overflow-y-auto card-hover-effect">
          <div className="space-y-1">
            {models.map((model) => (
              <div
                key={model.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                  selectedModel === model.id ? 'bg-neon/10 text-neon shadow-[0_0_8px_rgba(0,212,255,0.15)]' : 'text-text-secondary hover:bg-glass-hover'
                }`}
                onClick={() => loadComponents(model.id)}
              >
                <ChevronRight size={14} className={selectedModel === model.id ? 'rotate-90' : ''} />
                <span className="truncate flex-1">{model.normalized_name || model.original_name}</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Components */}
        <GlassPanel title={`Компоненты (${components.length})`} className="max-h-[500px] overflow-y-auto card-hover-effect" action={
          selectedModel ? (
            <div className="flex gap-1">
              <ActionButton label="" onClick={handleFillComponents} loading={loading['fill-components']} size="sm" icon={<Package size={12} />} />
              <ActionButton label="" onClick={handleEnrichComponents} loading={loading['enrich-components']} variant="secondary" size="sm" icon={<Globe size={12} />} />
            </div>
          ) : undefined
        }>
          <AnimatePresence>
            {showAddComponent && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-panel p-3 mb-3 space-y-2">
                <input
                  className="w-full bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                  placeholder="Наименование компонента"
                  value={newComponent.name}
                  onChange={(e) => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                />
                <div className="flex gap-2">
                  <select
                    className="flex-1 bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                    value={newComponent.component_type}
                    onChange={(e) => setNewComponent(prev => ({ ...prev, component_type: e.target.value }))}
                  >
                    <option value="узел">Узел</option>
                    <option value="агрегат">Агрегат</option>
                    <option value="деталь">Деталь</option>
                    <option value="система">Система</option>
                    <option value="механизм">Механизм</option>
                    <option value="аппарат">Аппарат</option>
                  </select>
                  <ActionButton label="OK" onClick={handleAddComponent} size="sm" icon={<Check size={14} />} />
                  <button onClick={() => setShowAddComponent(false)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {components.length > 0 ? (
            <div className="space-y-1">
              {components.map((comp) => (
                <div
                  key={comp.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                    selectedComponent === comp.id ? 'bg-pink/10 text-pink' : 'text-text-secondary hover:bg-glass-hover'
                  }`}
                  onClick={() => loadOperations(comp.id)}
                >
                  <ChevronRight size={14} className={selectedComponent === comp.id ? 'rotate-90' : ''} />
                  <span className="truncate flex-1">{comp.name}</span>
                  <span className="text-xs text-text-muted">{comp.component_type}</span>
                  <SourceBadge source={comp.source_type} />
                  <VerifiedBadge verified={comp.verified} />
                  {!comp.verified && (
                    <button onClick={(e) => { e.stopPropagation(); handleVerify('component', comp.id) }} className="text-success hover:text-success/80">
                      <Check size={12} />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteComponent(comp.id) }} className="text-error hover:text-error/80">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-4">
              {selectedModel ? 'Нет компонентов. Заполните по источнику или интернету.' : 'Выберите модель'}
            </p>
          )}
        </GlassPanel>

        {/* Operations */}
        <GlassPanel title={selectedCompObj ? `Операции: ${selectedCompObj.name}` : 'Операции'} className="max-h-[500px] overflow-y-auto card-hover-effect" action={
          selectedComponent ? (
            <div className="flex gap-1">
              <ActionButton label="" onClick={handleFillOperations} loading={loading['fill-operations']} size="sm" icon={<Wrench size={12} />} />
              <ActionButton label="" onClick={handleEnrichOperations} loading={loading['enrich-operations']} variant="secondary" size="sm" icon={<Globe size={12} />} />
              <ActionButton label="" onClick={() => setShowAddOperation(true)} variant="secondary" size="sm" icon={<Plus size={12} />} />
            </div>
          ) : undefined
        }>
          <AnimatePresence>
            {showAddOperation && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-panel p-3 mb-3 space-y-2">
                <input
                  className="w-full bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                  placeholder="Наименование операции"
                  value={newOperation.custom_name}
                  onChange={(e) => setNewOperation(prev => ({ ...prev, custom_name: e.target.value }))}
                />
                <div className="grid grid-cols-3 gap-2">
                  <select className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none" value={newOperation.profession} onChange={(e) => setNewOperation(prev => ({ ...prev, profession: e.target.value }))}>
                    <option value="">Профессия</option>
                    {professions.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <select className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none" value={newOperation.qualification} onChange={(e) => setNewOperation(prev => ({ ...prev, qualification: e.target.value }))}>
                    <option value="">Разряд</option>
                    {qualifications.map((q) => (
                      <option key={q.id} value={q.name}>{q.name}</option>
                    ))}
                  </select>
                  <input className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none" placeholder="Чел.-ч" type="number" value={newOperation.labor_hours} onChange={(e) => setNewOperation(prev => ({ ...prev, labor_hours: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <ActionButton label="OK" onClick={handleAddOperation} size="sm" icon={<Check size={14} />} />
                  <button onClick={() => setShowAddOperation(false)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {selectedOperation && selectedOpObj && (
            <div className="glass-panel p-3 mb-3">
              <div className="text-xs text-text-muted mb-2">Ресурсы для операции</div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none"
                  value={editOpProfession}
                  onChange={(e) => setEditOpProfession(e.target.value)}
                >
                  <option value="">Профессия</option>
                  {professions.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <select
                  className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none"
                  value={editOpQualification}
                  onChange={(e) => setEditOpQualification(e.target.value)}
                >
                  <option value="">Разряд</option>
                  {qualifications.map((q) => (
                    <option key={q.id} value={q.name}>{q.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <ActionButton
                  label="Сохранить"
                  size="sm"
                  icon={<Check size={14} />}
                  onClick={async () => {
                    if (!selectedOperation) return
                    setLoading('save-resources', true)
                    try {
                      await tkApi.updateOperation(selectedOperation, {
                        profession: editOpProfession || null,
                        qualification: editOpQualification || null,
                      })
                      toast.success('Ресурсы сохранены')
                      if (selectedComponent) loadOperations(selectedComponent)
                    } catch (e) {
                      toast.error('Ошибка сохранения')
                    } finally {
                      setLoading('save-resources', false)
                    }
                  }}
                  loading={loading['save-resources']}
                />
                <ActionButton
                  label="Очистить"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (!selectedOperation) return
                    setEditOpProfession('')
                    setEditOpQualification('')
                    setLoading('save-resources', true)
                    try {
                      await tkApi.updateOperation(selectedOperation, { profession: null, qualification: null })
                      toast.success('Очищено')
                      if (selectedComponent) loadOperations(selectedComponent)
                    } catch (e) {
                      toast.error('Ошибка')
                    } finally {
                      setLoading('save-resources', false)
                    }
                  }}
                />
              </div>
            </div>
          )}

          {operations.length > 0 ? (
            <div className="space-y-1">
              {operations.map((op) => (
                <div
                  key={op.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                    selectedOperation === op.id ? 'bg-orange/10 text-orange' : 'text-text-secondary hover:bg-glass-hover'
                  }`}
                  onClick={() => loadTmc(op.id)}
                >
                  <ChevronRight size={14} className={selectedOperation === op.id ? 'rotate-90' : ''} />
                  <span className="truncate flex-1">{op.custom_name || op.operation?.name || `Операция #${op.id}`}</span>
                  {op.labor_hours && <span className="text-xs text-text-muted">{op.labor_hours} чел.-ч</span>}
                  <SourceBadge source={op.source_type} />
                  <VerifiedBadge verified={op.verified} />
                  {!op.verified && (
                    <button onClick={(e) => { e.stopPropagation(); handleVerify('operation', op.id) }} className="text-success hover:text-success/80">
                      <Check size={12} />
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteOperation(op.id) }} className="text-error hover:text-error/80">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-4">
              {selectedComponent ? 'Нет операций. Заполните по источнику или интернету.' : 'Выберите компонент'}
            </p>
          )}
        </GlassPanel>

        {/* TMC */}
        <GlassPanel title={selectedOpObj ? `ТМЦ: ${selectedOpObj.custom_name || selectedOpObj.operation?.name || ''}` : 'ТМЦ'} className="max-h-[500px] overflow-y-auto card-hover-effect" action={
          selectedOperation ? (
            <div className="flex gap-1">
              <ActionButton label="" onClick={handleFillTmc} loading={loading['fill-tmc']} size="sm" icon={<Package size={12} />} />
              <ActionButton label="" onClick={handleEnrichTmc} loading={loading['enrich-tmc']} variant="secondary" size="sm" icon={<Globe size={12} />} />
              <ActionButton label="" onClick={() => setShowAddTmc(true)} variant="secondary" size="sm" icon={<Plus size={12} />} />
            </div>
          ) : undefined
        }>
          <AnimatePresence>
            {showAddTmc && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-panel p-3 mb-3 space-y-2">
                <input className="w-full bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none" placeholder="Наименование ТМЦ" value={newTmc.name} onChange={(e) => setNewTmc(prev => ({ ...prev, name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none" placeholder="Код" value={newTmc.code} onChange={(e) => setNewTmc(prev => ({ ...prev, code: e.target.value }))} />
                  <input className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none" placeholder="Ед.изм." value={newTmc.unit_symbol} onChange={(e) => setNewTmc(prev => ({ ...prev, unit_symbol: e.target.value }))} />
                  <input className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none" placeholder="Кол-во" type="number" value={newTmc.quantity} onChange={(e) => setNewTmc(prev => ({ ...prev, quantity: e.target.value }))} />
                  <input className="bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-neon focus:outline-none" placeholder="Расход" type="number" value={newTmc.consumption_rate} onChange={(e) => setNewTmc(prev => ({ ...prev, consumption_rate: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <ActionButton label="OK" onClick={handleAddTmc} size="sm" icon={<Check size={14} />} />
                  <button onClick={() => setShowAddTmc(false)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {tmcItems.length > 0 ? (
            <div className="space-y-2">
              {tmcItems.map((tmc) => (
                <div key={tmc.id} className="glass-panel p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{tmc.name}</span>
                        <SourceBadge source={tmc.source_type} />
                        <VerifiedBadge verified={tmc.verified} />
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                        {tmc.code && <span>Код: {tmc.code}</span>}
                        {tmc.unit_symbol && <span>Ед.: {tmc.unit_symbol}</span>}
                        {tmc.quantity && <span>Кол-во: {tmc.quantity}</span>}
                        {tmc.consumption_rate && <span>Расход: {tmc.consumption_rate}</span>}
                      </div>
                      <ConfidenceBar value={tmc.confidence} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSearchAoplAnalogs(tmc.id)} className="text-text-muted hover:text-neon">
                        <Search size={14} />
                      </button>
                      {!tmc.verified && (
                        <button onClick={() => handleVerify('tmc', tmc.id)} className="text-success hover:text-success/80">
                          <Check size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDeleteTmc(tmc.id)} className="text-error hover:text-error/80">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-4">
              {selectedOperation ? 'Нет ТМЦ. Заполните по источнику или интернету.' : 'Выберите операцию'}
            </p>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}
