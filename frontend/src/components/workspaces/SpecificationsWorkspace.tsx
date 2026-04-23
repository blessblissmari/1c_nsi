import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, Globe, Search, Upload, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel, ActionButton, SourceBadge, ConfidenceBar, VerifiedBadge } from '../ui/GlassCard'
import { specificationsApi, hierarchyApi } from '../../api'
import { useAppStore } from '../../store'

type TabType = 'bom' | 'apl'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as any } },
}

export function SpecificationsWorkspace() {
  const { loading, setLoading } = useAppStore()
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('bom')
  const [bomItems, setBomItems] = useState<any[]>([])
  const [aplItems, setAplItems] = useState<any[]>([])
  const [analogResults, setAnalogResults] = useState<any[]>([])
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

  const loadItems = async (modelId: number) => {
    setSelectedModel(modelId)
    try {
      const [bom, apl] = await Promise.all([
        specificationsApi.getBom(modelId),
        specificationsApi.getApl(modelId),
      ])
      setBomItems(bom as any[])
      setAplItems(apl as any[])
    } catch (e) {
      toast.error('Ошибка загрузки спецификаций')
    }
  }

  const handleGenerateBom = async (fromWeb: boolean) => {
    if (!selectedModel) return toast.error('Выберите модель')
    const key = fromWeb ? 'bom-web' : 'bom-source'
    setLoading(key, true)
    try {
      const result = fromWeb
        ? await specificationsApi.generateBomFromWeb(selectedModel)
        : await specificationsApi.generateBomFromSource(selectedModel)
      toast.success((result as any).message)
      loadItems(selectedModel)
    } catch (e) {
      toast.error('Ошибка генерации BOM')
    } finally {
      setLoading(key, false)
    }
  }

  const handleGenerateApl = async (fromWeb: boolean) => {
    if (!selectedModel) return toast.error('Выберите модель')
    const key = fromWeb ? 'apl-web' : 'apl-source'
    setLoading(key, true)
    try {
      const result = fromWeb
        ? await specificationsApi.generateAplFromWeb(selectedModel)
        : await specificationsApi.generateAplFromSource(selectedModel)
      toast.success((result as any).message)
      loadItems(selectedModel)
    } catch (e) {
      toast.error('Ошибка генерации APL')
    } finally {
      setLoading(key, false)
    }
  }

  const handleSearchAnalog = async (type: TabType, itemId: number) => {
    setLoading(`analog-${itemId}`, true)
    try {
      const results = type === 'bom'
        ? await specificationsApi.searchBomAnalogs(itemId)
        : await specificationsApi.searchAplAnalogs(itemId)
      setAnalogResults(results as any[])
      toast.success(`Найдено ${(results as any[]).length} аналогов`)
      loadItems(selectedModel!)
    } catch (e) {
      toast.error('Ошибка поиска аналогов')
    } finally {
      setLoading(`analog-${itemId}`, false)
    }
  }

  const handleVerify = async (type: TabType, ids: number[]) => {
    try {
      if (type === 'bom') await specificationsApi.verifyBom(ids, true)
      else await specificationsApi.verifyApl(ids, true)
      toast.success('Проверено')
      if (selectedModel) loadItems(selectedModel)
    } catch (e) {
      toast.error('Ошибка')
    }
  }

  const currentItems = activeTab === 'bom' ? bomItems : aplItems

  if (!dataLoaded) {
    return (
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div variants={itemVariants} className="animate-float mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple/20 via-neon/20 to-emerald/20 flex items-center justify-center animate-glow-pulse">
            <Package size={48} className="text-purple" />
          </div>
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-4xl font-bold gradient-text mb-4">
          ТМЦ
        </motion.h1>
        <motion.p variants={itemVariants} className="text-text-secondary text-lg mb-8 text-center max-w-xl">
          Сначала классифицируйте модели и загрузите техническую документацию, затем формируйте BOM и APL
        </motion.p>
      </motion.div>
    )
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold neon-text flex items-center gap-3">
          <Package size={28} /> Спецификации
        </h1>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <GlassPanel title="Модели" className="max-h-[500px] overflow-y-auto card-hover-effect">
          <div className="space-y-1">
            {models.map((model, idx) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                  selectedModel === model.id ? 'bg-neon/10 text-neon shadow-[0_0_8px_rgba(0,212,255,0.15)]' : 'text-text-secondary hover:bg-glass-hover'
                }`}
                onClick={() => loadItems(model.id)}
              >
                <span className="truncate">{model.normalized_name || model.original_name}</span>
                <div className="flex gap-2 mt-1 text-xs text-text-muted">
                  <span>BOM: {bomItems.filter(b => b.model_id === model.id).length}</span>
                  <span>APL: {aplItems.filter(a => a.model_id === model.id).length}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title={activeTab === 'bom' ? `BOM (${bomItems.length})` : `APL (${aplItems.length})`} className="lg:col-span-2 card-hover-effect" action={
          <div className="flex gap-2">
            <div className="flex rounded-full bg-graphite-lighter p-0.5">
              <button
                className={`px-3 py-1 text-xs rounded-full transition-colors ${activeTab === 'bom' ? 'bg-neon/20 text-neon' : 'text-text-muted hover:text-text-primary'}`}
                onClick={() => setActiveTab('bom')}
              >BOM</button>
              <button
                className={`px-3 py-1 text-xs rounded-full transition-colors ${activeTab === 'apl' ? 'bg-neon/20 text-neon' : 'text-text-muted hover:text-text-primary'}`}
                onClick={() => setActiveTab('apl')}
              >APL</button>
            </div>
            {selectedModel && (
              <>
                <ActionButton
                  label="Из БД"
                  onClick={() => activeTab === 'bom' ? handleGenerateBom(false) : handleGenerateApl(false)}
                  loading={loading[activeTab === 'bom' ? 'bom-source' : 'apl-source']}
                  size="sm" icon={<Upload size={14} />}
                />
                <ActionButton
                  label="AI"
                  onClick={() => activeTab === 'bom' ? handleGenerateBom(true) : handleGenerateApl(true)}
                  loading={loading[activeTab === 'bom' ? 'bom-web' : 'apl-web']}
                  variant="secondary" size="sm" icon={<Globe size={14} />}
                />
              </>
            )}
          </div>
        }>
          {currentItems.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {currentItems.map((item) => (
                <div key={item.id} className="glass-panel p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      <SourceBadge source={item.source_type} />
                      <VerifiedBadge verified={item.verified} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      {item.code && <span>Код: {item.code}</span>}
                      {item.quantity && <span>Кол-во: {item.quantity}</span>}
                      {item.unit_symbol && <span>{item.unit_symbol}</span>}
                      {item.analog_name && <span className="text-neon-dim">Аналог: {item.analog_name}</span>}
                    </div>
                    <ConfidenceBar value={item.confidence} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSearchAnalog(activeTab, item.id)}
                      className="text-neon hover:text-neon-dim"
                      title="Поиск аналогов"
                    >
                      <Search size={16} />
                    </button>
                    {!item.verified && (
                      <button onClick={() => handleVerify(activeTab, [item.id])} className="text-success hover:text-success/80">
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-4">Выберите модель и сформируйте спецификацию</p>
          )}
        </GlassPanel>

        {analogResults.length > 0 && (
          <GlassPanel title="Найденные аналоги" className="max-h-[500px] overflow-y-auto card-hover-effect">
            <div className="space-y-2">
              {analogResults.map((a: any, i: number) => (
                <div key={i} className="glass-panel p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{a.model}</span>
                    <ConfidenceBar value={a.match_score} />
                  </div>
                  {a.manufacturer && <p className="text-xs text-text-muted mt-1">{a.manufacturer}</p>}
                  {a.differences && <p className="text-xs text-text-secondary mt-1">{a.differences}</p>}
                </div>
              ))}
            </div>
          </GlassPanel>
        )}
      </motion.div>
    </motion.div>
  )
}
