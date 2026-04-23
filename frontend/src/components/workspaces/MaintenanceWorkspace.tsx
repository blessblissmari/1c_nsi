import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wrench, Upload, Globe, Check, Plus, Trash2, X, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel, ActionButton, SourceBadge, ConfidenceBar, VerifiedBadge, SourceUrlLink } from '../ui/GlassCard'
import { FileUpload } from '../ui/FileUpload'
import { maintenanceApi, hierarchyApi } from '../../api'
import { useAppStore } from '../../store'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as any } },
}

export function MaintenanceWorkspace() {
  const { loading, setLoading } = useAppStore()
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<number | null>(null)
  const [maintenanceTypes, setMaintenanceTypes] = useState<any[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [schedule, setSchedule] = useState<any | null>(null)
  const [newMT, setNewMT] = useState({ name: '', periodicity_months: '' })
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const data = await hierarchyApi.getModels({ limit: 200, has_class: true })
      setModels(data as any[])
      setDataLoaded((data as any[]).length > 0)
    } catch (e) {
      toast.error('Ошибка загрузки моделей')
    }
  }

  const loadMaintenanceTypes = async (modelId: number) => {
    setSelectedModel(modelId)
    try {
      const data = await maintenanceApi.getTypes({ model_id: modelId })
      setMaintenanceTypes(data as any[])
    } catch (e) {
      toast.error('Ошибка загрузки ВВ')
    }
  }

  const handleFillFromSource = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('fill-source', true)
    try {
      const result = await maintenanceApi.fillFromSource(selectedModel) as any
      toast.success(result.message)
      loadMaintenanceTypes(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    } finally {
      setLoading('fill-source', false)
    }
  }

  const handleEnrichFromWeb = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('enrich-web', true)
    try {
      const result = await maintenanceApi.enrichFromWeb(selectedModel) as any
      toast.success(result.message)
      loadMaintenanceTypes(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    } finally {
      setLoading('enrich-web', false)
    }
  }

  const handleUpload = async (file: File) => {
    setLoading('upload', true)
    try {
      const result = await maintenanceApi.uploadMaintenance(file) as any
      toast.success(result.message)
      setShowUpload(false)
      if (selectedModel) loadMaintenanceTypes(selectedModel)
    } catch (e) {
      toast.error('Ошибка загрузки')
    } finally {
      setLoading('upload', false)
    }
  }

  const handleAddManual = async () => {
    if (!selectedModel || !newMT.name) return
    try {
      await maintenanceApi.createType({
        model_id: selectedModel,
        name: newMT.name,
        periodicity_months: newMT.periodicity_months ? parseFloat(newMT.periodicity_months) : null,
      })
      toast.success('Добавлено')
      setNewMT({ name: '', periodicity_months: '' })
      setShowAddForm(false)
      loadMaintenanceTypes(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await maintenanceApi.deleteType(id)
      toast.success('Удалено')
      if (selectedModel) loadMaintenanceTypes(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  const handleVerify = async (ids: number[]) => {
    try {
      await maintenanceApi.verify(ids, true)
      toast.success('Проверено')
      if (selectedModel) loadMaintenanceTypes(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  const handleBuildSchedule = async () => {
    setLoading('schedule', true)
    try {
      const data = await maintenanceApi.getPprSchedule(12)
      setSchedule(data)
      setShowSchedule(true)
      toast.success('График ППР сформирован')
    } catch (e) {
      toast.error('Ошибка формирования графика')
    } finally {
      setLoading('schedule', false)
    }
  }

  if (!dataLoaded && !showUpload) {
    return (
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div variants={itemVariants} className="animate-float mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange/20 via-pink/20 to-purple/20 flex items-center justify-center animate-glow-pulse">
            <Wrench size={48} className="text-orange" />
          </div>
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-4xl font-bold gradient-text mb-4">
          Виды воздействий
        </motion.h1>
        <motion.p variants={itemVariants} className="text-text-secondary text-lg mb-8 text-center max-w-xl">
          Сначала классифицируйте модели в разделе «Иерархия», затем загрузите справочник ВВ
        </motion.p>
        <motion.div variants={itemVariants} className="flex flex-wrap gap-3 justify-center">
          <ActionButton label="Загрузить ВВ" onClick={() => setShowUpload(true)} icon={<Upload size={18} />} />
        </motion.div>
        <AnimatePresence>
          {showUpload && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="mt-8 w-full max-w-md">
              <GlassPanel title="Загрузка видов воздействий" action={
                <button onClick={() => setShowUpload(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
              }>
                <FileUpload onUpload={handleUpload} loading={loading.upload} />
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
          <Wrench size={28} /> Виды воздействий и периодичности
        </h1>
        <div className="flex gap-2 flex-wrap">
          <ActionButton label="Загрузить ВВ" onClick={() => setShowUpload(true)} variant="secondary" size="sm" icon={<Upload size={14} />} />
          <ActionButton label="График ППР" onClick={handleBuildSchedule} loading={loading.schedule} variant="secondary" size="sm" icon={<Calendar size={14} />} />
        </div>
      </motion.div>

      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <GlassPanel title="Загрузка видов воздействий" action={
              <button onClick={() => setShowUpload(false)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
            }>
              <FileUpload onUpload={handleUpload} loading={loading.upload} />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSchedule && schedule && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSchedule(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel w-full max-w-5xl max-h-[85vh] m-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-glass-border">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar size={18} className="text-neon" />
                  <h3 className="text-lg font-semibold text-text-primary truncate">Графики ППР (на 12 месяцев)</h3>
                </div>
                <button onClick={() => setShowSchedule(false)} className="text-text-muted hover:text-text-primary transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(85vh-64px)] space-y-3">
                {Array.isArray(schedule.items) && schedule.items.length > 0 ? (
                  schedule.items.map((item: any) => (
                    <div key={item.model_id} className="glass-panel p-3">
                      <div className="text-sm font-semibold text-text-primary">{item.model}</div>
                      <div className="mt-2 space-y-2">
                        {item.types.map((t: any) => (
                          <div key={t.id} className="text-xs text-text-secondary">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{t.name}</span>
                              <span className="text-text-muted">{t.periodicity_months} мес.</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {t.dates.map((d: string) => (
                                <span key={d} className="px-2 py-0.5 rounded-full bg-neon/10 text-neon">
                                  {d}
                                </span>
                              ))}
                              {t.dates.length === 0 && <span className="text-text-muted italic">нет дат</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-text-muted text-sm text-center py-6">Нет данных для построения графиков</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassPanel title="Классифицированные модели" className="max-h-[500px] overflow-y-auto card-hover-effect">
          <div className="space-y-1">
            {models.map((model, idx) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                  selectedModel === model.id ? 'bg-neon/10 text-neon shadow-[0_0_8px_rgba(0,212,255,0.15)]' : 'text-text-secondary hover:bg-glass-hover'
                }`}
                onClick={() => loadMaintenanceTypes(model.id)}
              >
                <span className="truncate flex-1">{model.normalized_name || model.original_name}</span>
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title={`ВВ и периодичности (${maintenanceTypes.length})`} className="lg:col-span-2 card-hover-effect" action={
          selectedModel ? (
            <div className="flex gap-2">
              <ActionButton label="Из БД" onClick={handleFillFromSource} loading={loading['fill-source']} size="sm" icon={<Upload size={14} />} />
              <ActionButton label="AI" onClick={handleEnrichFromWeb} loading={loading['enrich-web']} variant="secondary" size="sm" icon={<Globe size={14} />} />
              <ActionButton label="Добавить" onClick={() => setShowAddForm(true)} variant="secondary" size="sm" icon={<Plus size={14} />} />
            </div>
          ) : undefined
        }>
          {showAddForm && (
            <div className="glass-panel p-3 mb-4 space-y-2">
              <input
                className="w-full bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                placeholder="Вид воздействия"
                value={newMT.name}
                onChange={(e) => setNewMT(prev => ({ ...prev, name: e.target.value }))}
              />
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                  placeholder="Периодичность (мес.)"
                  type="number"
                  value={newMT.periodicity_months}
                  onChange={(e) => setNewMT(prev => ({ ...prev, periodicity_months: e.target.value }))}
                />
                <ActionButton label="Добавить" onClick={handleAddManual} size="sm" icon={<Check size={14} />} />
              </div>
            </div>
          )}

          {maintenanceTypes.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {maintenanceTypes.map((mt) => (
                <div key={mt.id} className="glass-panel p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{mt.name}</span>
                      <SourceBadge source={mt.source_type} />
                      <VerifiedBadge verified={mt.verified} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                      {mt.periodicity && <span>Периодичность: {mt.periodicity}</span>}
                      {mt.periodicity_months && <span>({mt.periodicity_months} мес.)</span>}
                      <SourceUrlLink url={mt.source_url} />
                    </div>
                    <ConfidenceBar value={mt.confidence} />
                  </div>
                  <div className="flex items-center gap-2">
                    {!mt.verified && (
                      <button onClick={() => handleVerify([mt.id])} className="text-success hover:text-success/80">
                        <Check size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(mt.id)} className="text-error hover:text-error/80">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-4">Выберите модель для работы с ВВ</p>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}
