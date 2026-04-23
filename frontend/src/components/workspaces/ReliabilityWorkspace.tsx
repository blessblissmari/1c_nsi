import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Globe, Plus, Shield, Trash2, Upload, Calculator, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel, ActionButton, SourceBadge, ConfidenceBar, VerifiedBadge, SourceUrlLink } from '../ui/GlassCard'
import { reliabilityApi, hierarchyApi } from '../../api'
import { useAppStore } from '../../store'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as any } },
}

const METRIC_LABELS: Record<string, string> = {
  mtbf: 'Наработка на отказ (MTBF)',
  mttr: 'Среднее время восстановления (MTTR)',
  availability: 'Коэффициент готовности',
  failure_rate: 'Интенсивность отказов (λ)',
}

export function ReliabilityWorkspace() {
  const { loading, setLoading } = useAppStore()
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<any[]>([])
  const [failures, setFailures] = useState<any[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMetric, setNewMetric] = useState({ metric_type: 'mtbf', value: '', unit: '', description: '' })
  const [dataLoaded, setDataLoaded] = useState(false)
  const failuresInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const data = await hierarchyApi.getModels({ limit: 200, has_class: true })
      setModels(data as any[])
      setDataLoaded((data as any[]).length > 0)
    } catch {
      toast.error('Ошибка загрузки моделей')
    }
  }

  const loadAllForModel = async (modelId: number) => {
    setSelectedModel(modelId)
    try {
      const [m, f] = await Promise.all([
        reliabilityApi.getMetrics(modelId),
        reliabilityApi.getFailures(modelId).catch(() => []),
      ])
      setMetrics(m as any[])
      setFailures(f as any[])
    } catch {
      toast.error('Ошибка загрузки данных')
    }
  }

  const handleFillFromSource = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('fill-source', true)
    try {
      const result = await reliabilityApi.fillFromSource(selectedModel) as any
      toast.success(result.message)
      loadAllForModel(selectedModel)
    } catch {
      toast.error('Ошибка')
    } finally {
      setLoading('fill-source', false)
    }
  }

  const handleEnrichFromWeb = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('enrich-web', true)
    try {
      const result = await reliabilityApi.enrichFromWeb(selectedModel) as any
      toast.success(result.message)
      loadAllForModel(selectedModel)
    } catch {
      toast.error('Ошибка')
    } finally {
      setLoading('enrich-web', false)
    }
  }

  const handleAddManual = async () => {
    if (!selectedModel || !newMetric.metric_type) return
    try {
      await reliabilityApi.createMetric({
        model_id: selectedModel,
        metric_type: newMetric.metric_type,
        value: newMetric.value ? parseFloat(newMetric.value) : null,
        unit: newMetric.unit || null,
        description: newMetric.description || null,
      })
      toast.success('Добавлено')
      setNewMetric({ metric_type: 'mtbf', value: '', unit: '', description: '' })
      setShowAddForm(false)
      loadAllForModel(selectedModel)
    } catch {
      toast.error('Ошибка')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await reliabilityApi.deleteMetric(id)
      toast.success('Удалено')
      if (selectedModel) loadAllForModel(selectedModel)
    } catch {
      toast.error('Ошибка')
    }
  }

  const handleVerify = async (ids: number[]) => {
    try {
      await reliabilityApi.verify(ids, true)
      toast.success('Проверено')
      if (selectedModel) loadAllForModel(selectedModel)
    } catch {
      toast.error('Ошибка')
    }
  }

  const handlePickFailuresFile = () => failuresInputRef.current?.click()

  const handleUploadFailures = async (file: File) => {
    setLoading('upload-failures', true)
    try {
      const result = await reliabilityApi.uploadFailures(file) as any
      toast.success(result.message)
      if (selectedModel) loadAllForModel(selectedModel)
    } catch {
      toast.error('Не удалось загрузить статистику отказов')
    } finally {
      setLoading('upload-failures', false)
    }
  }

  const handleRecalcMtbf = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('recalc-mtbf', true)
    try {
      const result = await reliabilityApi.recalcMtbf(selectedModel) as any
      toast.success(result.message)
      loadAllForModel(selectedModel)
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Не удалось пересчитать MTBF'
      toast.error(msg)
    } finally {
      setLoading('recalc-mtbf', false)
    }
  }

  const selectedModelName = useMemo(() => {
    const m = models.find((x) => x.id === selectedModel)
    return m ? (m.normalized_name || m.original_name) : null
  }, [models, selectedModel])

  if (!dataLoaded) {
    return (
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div variants={itemVariants} className="animate-float mb-8">
          <div className="w-20 h-20 bg-neon/10 rounded-3xl flex items-center justify-center border border-neon/20">
            <Shield className="w-10 h-10 text-neon" />
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-3">Параметры надёжности</h2>
          <p className="text-text-muted">Сначала добавьте модели с классом/подклассом (и загрузите классификатор).</p>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="max-w-6xl mx-auto p-6">
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassPanel title="Модели" className="lg:col-span-1">
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => loadAllForModel(m.id)}
                className={`w-full text-left glass-panel p-3 transition-colors ${
                  selectedModel === m.id ? 'border border-neon/40 bg-neon/5' : 'hover:bg-slate-200/40'
                }`}
              >
                <div className="text-sm font-medium">{m.normalized_name || m.original_name}</div>
                <div className="text-xs text-text-muted mt-0.5 truncate">
                  {m.eq_class?.name}{m.eq_subclass?.name ? ` / ${m.eq_subclass?.name}` : ''}
                </div>
              </button>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel
          title="Параметры"
          className="lg:col-span-2"
          action={
            selectedModel ? (
              <div className="flex flex-wrap gap-2">
                <ActionButton label="Vector Store" onClick={handleFillFromSource} loading={loading['fill-source']} variant="secondary" size="sm" icon={<Shield size={14} />} />
                <ActionButton label="Web" onClick={handleEnrichFromWeb} loading={loading['enrich-web']} variant="secondary" size="sm" icon={<Globe size={14} />} />
                <ActionButton label="Добавить" onClick={() => setShowAddForm(true)} variant="secondary" size="sm" icon={<Plus size={14} />} />
              </div>
            ) : undefined
          }
        >
          {selectedModel ? (
            <>
              <div className="glass-panel p-3 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{selectedModelName}</div>
                    <div className="text-xs text-text-muted mt-0.5">Отказы: {failures.length}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={failuresInputRef}
                      type="file"
                      accept=".xlsx,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.currentTarget.value = ''
                        if (f) handleUploadFailures(f)
                      }}
                    />
                    <ActionButton label="Загрузить отказы" onClick={handlePickFailuresFile} loading={loading['upload-failures']} variant="secondary" size="sm" icon={<Upload size={14} />} />
                    <ActionButton label="Пересчитать MTBF" onClick={handleRecalcMtbf} loading={loading['recalc-mtbf']} variant="secondary" size="sm" icon={<Calculator size={14} />} />
                  </div>
                </div>
              </div>

              {showAddForm && (
                <div className="glass-panel p-3 mb-4 space-y-2">
                  <select
                    className="w-full bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                    value={newMetric.metric_type}
                    onChange={(e) => setNewMetric(prev => ({ ...prev, metric_type: e.target.value }))}
                  >
                    {Object.entries(METRIC_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                      placeholder="Значение"
                      type="number"
                      value={newMetric.value}
                      onChange={(e) => setNewMetric(prev => ({ ...prev, value: e.target.value }))}
                    />
                    <input
                      className="bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                      placeholder="Ед. изм. (ч, 1/ч, -)"
                      value={newMetric.unit}
                      onChange={(e) => setNewMetric(prev => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>
                  <input
                    className="w-full bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none"
                    placeholder="Пояснение (необязательно)"
                    value={newMetric.description}
                    onChange={(e) => setNewMetric(prev => ({ ...prev, description: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <ActionButton label="Добавить" onClick={handleAddManual} size="sm" icon={<Check size={14} />} />
                    <button onClick={() => setShowAddForm(false)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
                  </div>
                </div>
              )}

              {metrics.length > 0 ? (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {metrics.map((mt) => (
                    <div key={mt.id} className="glass-panel p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{METRIC_LABELS[mt.metric_type] || mt.metric_type}</span>
                          <SourceBadge source={mt.source_type} />
                          <VerifiedBadge verified={mt.verified} />
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-text-muted">
                          {mt.value != null && <span className="text-text-primary font-semibold">{mt.value}</span>}
                          {mt.unit && <span>{mt.unit}</span>}
                          {mt.description && <span className="truncate max-w-[360px]">{mt.description}</span>}
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
                <p className="text-text-muted text-sm text-center py-4">Нет параметров — добавьте вручную или обогатите из источников.</p>
              )}
            </>
          ) : (
            <p className="text-text-muted text-sm text-center py-4">Выберите модель слева.</p>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}
