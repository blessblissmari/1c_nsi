import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Upload, Link, Globe, Search, Check, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel, ActionButton, SourceBadge, ConfidenceBar, VerifiedBadge, SourceUrlLink } from '../ui/GlassCard'
import { FileUpload } from '../ui/FileUpload'
import { massProcessingApi, hierarchyApi } from '../../api'
import { useAppStore } from '../../store'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as any } },
}

export function MassProcessingWorkspace() {
  const { loading, setLoading, selectedModelId } = useAppStore()
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<number | null>(null)
  const [requiredSet, setRequiredSet] = useState<Set<string>>(new Set())
  const [torChars, setTorChars] = useState<any[]>([])
  const [analogs, setAnalogs] = useState<any[]>([])
  const [selectedAnalogCharIds, setSelectedAnalogCharIds] = useState<number[]>([])
  const [showUpload, setShowUpload] = useState<string | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const data = await hierarchyApi.getModels({ limit: 200 })
      setModels(data as any[])
      setDataLoaded((data as any[]).length > 0)
      if (selectedModelId && (data as any[]).some((m) => m.id === selectedModelId)) {
        loadTorCharacteristics(selectedModelId)
      }
    } catch (e) {
      toast.error('Ошибка загрузки моделей')
    }
  }

  const loadTorCharacteristics = async (modelId: number) => {
    setSelectedModel(modelId)
    setSelectedAnalogCharIds([])
    setAnalogs([])
    try {
      const [torData, detail] = await Promise.all([
        massProcessingApi.getTorCharacteristics(modelId),
        hierarchyApi.getModelDetail(modelId),
      ])
      setTorChars(torData as any[])
      const classId = (detail as any)?.class_id
      const subclassId = (detail as any)?.subclass_id
      if (classId) {
        const req = await massProcessingApi.getClassCharacteristics({ class_id: classId, subclass_id: subclassId })
        setRequiredSet(new Set((req as any[]).filter((r) => !!r.required).map((r) => String(r.name))))
      } else {
        setRequiredSet(new Set())
      }
    } catch (e) {
      toast.error('Ошибка загрузки характеристик')
    }
  }

  const handleBindCharacteristics = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('bind', true)
    try {
      const result = await massProcessingApi.bindCharacteristics(selectedModel) as any
      toast.success(result.message)
      loadTorCharacteristics(selectedModel)
    } catch (e) {
      toast.error('Ошибка привязки')
    } finally {
      setLoading('bind', false)
    }
  }

  const handleFillFromSource = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('fill-source', true)
    try {
      const result = await massProcessingApi.fillFromSource(selectedModel) as any
      toast.success(result.message)
      loadTorCharacteristics(selectedModel)
    } catch (e) {
      toast.error('Ошибка заполнения')
    } finally {
      setLoading('fill-source', false)
    }
  }

  const handleEnrichFromWeb = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('enrich-web', true)
    try {
      const result = await massProcessingApi.enrichFromWeb(selectedModel) as any
      toast.success(result.message)
      loadTorCharacteristics(selectedModel)
    } catch (e) {
      toast.error('Ошибка обогащения')
    } finally {
      setLoading('enrich-web', false)
    }
  }

  const handleRequiredFromDocs = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('required-docs', true)
    try {
      const result = await massProcessingApi.requiredFromDocs(selectedModel) as any
      toast.success(result.message)
      loadTorCharacteristics(selectedModel)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    } finally {
      setLoading('required-docs', false)
    }
  }

  const handleRequiredFromWeb = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('required-web', true)
    try {
      const result = await massProcessingApi.requiredFromWeb(selectedModel) as any
      toast.success(result.message)
      loadTorCharacteristics(selectedModel)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    } finally {
      setLoading('required-web', false)
    }
  }

  const handleOtherFromDocs = async () => {
    if (!selectedModel) return toast.error('Выберите модель')
    setLoading('other-docs', true)
    try {
      const result = await massProcessingApi.otherFromDocs(selectedModel) as any
      toast.success(result.message)
      loadTorCharacteristics(selectedModel)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    } finally {
      setLoading('other-docs', false)
    }
  }

  const handleSearchAnalogs = async (modelId: number) => {
    setLoading('analogs', true)
    try {
      const results = await massProcessingApi.searchAnalogs(modelId, selectedAnalogCharIds.length ? selectedAnalogCharIds : undefined)
      setAnalogs(results as any[])
      toast.success(`Найдено ${(results as any[]).length} аналогов`)
    } catch (e) {
      toast.error('Ошибка поиска аналогов')
    } finally {
      setLoading('analogs', false)
    }
  }

  const handleVerify = async (ids: number[]) => {
    try {
      await massProcessingApi.verify(ids, true)
      toast.success('Проверено экспертом')
      if (selectedModel) loadTorCharacteristics(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  const handleUpload = async (type: string, file: File) => {
    setLoading(`upload-${type}`, true)
    try {
      let result: any
      switch (type) {
        case 'characteristics': result = await massProcessingApi.uploadCharacteristics(file); break
        case 'units': result = await massProcessingApi.uploadUnits(file); break
        default: return
      }
      toast.success(result.message)
      setShowUpload(null)
    } catch (e) {
      toast.error('Ошибка загрузки')
    } finally {
      setLoading(`upload-${type}`, false)
    }
  }

  if (!dataLoaded && !showUpload) {
    return (
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div variants={itemVariants} className="animate-float mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald/20 via-neon/20 to-purple/20 flex items-center justify-center animate-glow-pulse">
            <Cpu size={48} className="text-emerald" />
          </div>
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-4xl font-bold gradient-text mb-4">
          Массовая обработка
        </motion.h1>
        <motion.p variants={itemVariants} className="text-text-secondary text-lg mb-8 text-center max-w-xl">
          Загрузите характеристики и единицы измерения для начала массовой обработки моделей
        </motion.p>
        <motion.div variants={itemVariants} className="flex flex-wrap gap-3 justify-center">
          <ActionButton label="Характеристики" onClick={() => setShowUpload('characteristics')} icon={<Upload size={18} />} />
          <ActionButton label="Ед. измерения" onClick={() => setShowUpload('units')} variant="secondary" icon={<Cpu size={18} />} />
        </motion.div>
        <AnimatePresence>
          {showUpload && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="mt-8 w-full max-w-md">
              <GlassPanel title={`Загрузка: ${showUpload === 'characteristics' ? 'Характеристики' : 'Ед. измерения'}`} action={
                <button onClick={() => setShowUpload(null)} className="text-text-muted hover:text-text-primary">&#10005;</button>
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
          <Cpu size={28} /> Массовая обработка моделей
        </h1>
        <div className="flex gap-2">
          <ActionButton label="Характеристики" onClick={() => setShowUpload('characteristics')} variant="secondary" size="sm" icon={<Upload size={14} />} />
          <ActionButton label="Ед. измерения" onClick={() => setShowUpload('units')} variant="secondary" size="sm" icon={<Upload size={14} />} />
        </div>
      </motion.div>

      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <GlassPanel title={`Загрузка: ${showUpload === 'characteristics' ? 'Характеристики' : 'Ед. измерения'}`} action={
              <button onClick={() => setShowUpload(null)} className="text-text-muted hover:text-text-primary">&#10005;</button>
            }>
              <FileUpload onUpload={(f) => handleUpload(showUpload!, f)} loading={loading[`upload-${showUpload}`]} />
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel title="Модели" className="max-h-[500px] overflow-y-auto card-hover-effect">
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
                onClick={() => loadTorCharacteristics(model.id)}
              >
                <span className="truncate flex-1">{model.normalized_name || model.original_name}</span>
                <ActionButton
                  label="Аналоги"
                  onClick={() => { handleSearchAnalogs(model.id) }}
                  variant="secondary"
                  size="sm"
                  icon={<Search size={12} />}
                  loading={loading.analogs}
                />
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel title="Характеристики ТОР" action={
            selectedModel ? (
              <div className="flex gap-2">
                <ActionButton label="Привязать" onClick={handleBindCharacteristics} loading={loading.bind} size="sm" icon={<Link size={14} />} />
                <ActionButton label="Из БД" onClick={handleFillFromSource} loading={loading['fill-source']} size="sm" icon={<Upload size={14} />} />
                <ActionButton label="AI" onClick={handleEnrichFromWeb} loading={loading['enrich-web']} variant="secondary" size="sm" icon={<Globe size={14} />} />
                <ActionButton label="Обязат. док." onClick={handleRequiredFromDocs} loading={loading['required-docs']} variant="secondary" size="sm" icon={<Check size={14} />} />
                <ActionButton label="Обязат. web" onClick={handleRequiredFromWeb} loading={loading['required-web']} variant="secondary" size="sm" icon={<Globe size={14} />} />
                <ActionButton label="Прочие док." onClick={handleOtherFromDocs} loading={loading['other-docs']} variant="secondary" size="sm" icon={<Filter size={14} />} />
              </div>
            ) : undefined
          }>
            {torChars.length > 0 ? (
              <div className="space-y-2">
                <div className="glass-panel p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Filter size={14} className="text-text-muted" />
                      <span className="text-xs text-text-muted truncate">Характеристики для поиска аналогов</span>
                    </div>
                    <ActionButton
                      label="Найти аналоги"
                      onClick={() => selectedModel && handleSearchAnalogs(selectedModel)}
                      variant="secondary"
                      size="sm"
                      icon={<Search size={12} />}
                      loading={loading.analogs}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {torChars
                      .filter((tc) => tc.value)
                      .slice(0, 12)
                      .map((tc) => {
                        const checked = selectedAnalogCharIds.includes(tc.characteristic_id)
                        return (
                          <label key={tc.id} className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedAnalogCharIds((prev) => {
                                  if (e.target.checked) return [...prev, tc.characteristic_id]
                                  return prev.filter((id) => id !== tc.characteristic_id)
                                })
                              }}
                            />
                            <span className="truncate max-w-[220px]">{tc.characteristic_name}</span>
                          </label>
                        )
                      })}
                    {torChars.filter((tc) => tc.value).length === 0 && (
                      <span className="text-xs text-text-muted">Заполните характеристики, чтобы учитывать их при поиске</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="glass-panel p-3">
                    <div className="text-sm font-semibold text-slate-800 mb-2">Обязательные</div>
                    <div className="space-y-2">
                      {torChars
                        .filter((tc) => requiredSet.has(String(tc.characteristic_name)))
                        .map((tc) => (
                          <div key={tc.id} className="glass-panel p-3 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium truncate">{tc.characteristic_name}</span>
                                <SourceBadge source={tc.source_type} />
                                <VerifiedBadge verified={tc.verified} />
                              </div>
                              <div className="text-sm mt-1">
                                {tc.value || <span className="text-text-muted italic">не заполнено</span>}
                                {tc.unit_symbol && <span className="text-text-muted ml-1">{tc.unit_symbol}</span>}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <ConfidenceBar value={tc.confidence} />
                                <SourceUrlLink url={tc.source_url} />
                              </div>
                            </div>
                            {!tc.verified && (
                              <button onClick={() => handleVerify([tc.id])} className="text-success hover:text-success/80 ml-2">
                                <Check size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      {requiredSet.size > 0 && torChars.filter((tc) => requiredSet.has(String(tc.characteristic_name))).length === 0 && (
                        <div className="text-sm text-text-muted">Нет обязательных характеристик — нажмите «Привязать».</div>
                      )}
                    </div>
                  </div>

                  <div className="glass-panel p-3">
                    <div className="text-sm font-semibold text-slate-800 mb-2">Прочие</div>
                    <div className="space-y-2">
                      {torChars
                        .filter((tc) => !requiredSet.has(String(tc.characteristic_name)))
                        .map((tc) => (
                          <div key={tc.id} className="glass-panel p-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{tc.characteristic_name}</span>
                              <SourceBadge source={tc.source_type} />
                              <VerifiedBadge verified={tc.verified} />
                            </div>
                            <div className="text-sm mt-1">
                              {tc.value || <span className="text-text-muted italic">не заполнено</span>}
                              {tc.unit_symbol && <span className="text-text-muted ml-1">{tc.unit_symbol}</span>}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <ConfidenceBar value={tc.confidence} />
                              <SourceUrlLink url={tc.source_url} />
                            </div>
                          </div>
                        ))}
                      {torChars.filter((tc) => !requiredSet.has(String(tc.characteristic_name))).length === 0 && (
                        <div className="text-sm text-text-muted">Пока нет. Нажмите «Прочие док.»</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-sm text-center py-4">Выберите модель и привяжите характеристики</p>
            )}
          </GlassPanel>

          {analogs.length > 0 && (
            <GlassPanel title="Аналоги">
              <div className="space-y-2">
                {analogs.map((a: any, i: number) => (
                  <div key={i} className="glass-panel p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{a.model}</span>
                      <ConfidenceBar value={a.match_score} />
                    </div>
                    {a.differences && <p className="text-xs text-text-secondary mt-1">{a.differences}</p>}
                    {Array.isArray(a.compare) && a.compare.length > 0 && (
                      <div className="mt-2 text-xs text-text-muted space-y-1">
                        {a.compare.slice(0, 6).map((c: any, idx: number) => (
                          <div key={idx} className="flex gap-2">
                            <span className="w-40 truncate">{c.name}</span>
                            <span className="truncate">{c.base_value}</span>
                            <span className="text-text-muted">→</span>
                            <span className="truncate">{c.candidate_value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
