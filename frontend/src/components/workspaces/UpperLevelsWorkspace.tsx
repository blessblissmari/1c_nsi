import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Layers, Edit2, X, Save, Network } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel, ActionButton } from '../ui/GlassCard'
import { upperLevelsApi } from '../../api'
import { useAppStore } from '../../store'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as any } },
}

export function UpperLevelsWorkspace() {
  const { selectedNodeId } = useAppStore()
  const [card, setCard] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({ description: '', custom_fields: {} as Record<string, string> })

  useEffect(() => {
    if (selectedNodeId) loadCard()
  }, [selectedNodeId])

  const loadCard = async () => {
    if (!selectedNodeId) return
    try {
      const data = await upperLevelsApi.getCard(selectedNodeId) as any
      setCard(data)
      setFormData({
        description: data.description || '',
        custom_fields: data.custom_fields || {},
      })
    } catch (e) {
      toast.error('Ошибка загрузки карточки')
    }
  }

  const handleSave = async () => {
    if (!selectedNodeId) return
    try {
      await upperLevelsApi.updateCard(selectedNodeId, formData)
      toast.success('Обновлено')
      setEditing(false)
      loadCard()
    } catch (e) {
      toast.error('Ошибка сохранения')
    }
  }

  const addCustomField = () => {
    setFormData(prev => ({
      ...prev,
      custom_fields: { ...prev.custom_fields, [`Поле ${Object.keys(prev.custom_fields).length + 1}`]: '' },
    }))
  }

  const updateCustomField = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: { ...prev.custom_fields, [key]: value },
    }))
  }

  if (!card && !selectedNodeId) {
    return (
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className="flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div variants={itemVariants} className="animate-float mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neon/20 via-emerald/20 to-orange/20 flex items-center justify-center animate-glow-pulse">
            <Layers size={48} className="text-neon" />
          </div>
        </motion.div>
        <motion.h1 variants={itemVariants} className="text-4xl font-bold gradient-text mb-4">
          Верхние уровни
        </motion.h1>
        <motion.p variants={itemVariants} className="text-text-secondary text-lg text-center max-w-xl">
          Выберите узел в разделе «Иерархия» для просмотра
        </motion.p>
      </motion.div>
    )
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="space-y-6">
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold neon-text flex items-center gap-3">
          <Layers size={28} /> Карточки верхних уровней
        </h1>
      </motion.div>

      {card ? (
        <motion.div variants={itemVariants}>
          <GlassPanel title={card.name} action={
            editing ? (
              <div className="flex gap-2">
                <ActionButton label="Сохранить" onClick={handleSave} size="sm" icon={<Save size={14} />} />
                <ActionButton label="Отмена" onClick={() => setEditing(false)} variant="secondary" size="sm" icon={<X size={14} />} />
              </div>
            ) : (
              <ActionButton label="Редактировать" onClick={() => setEditing(true)} variant="secondary" size="sm" icon={<Edit2 size={14} />} />
            )
          }>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-muted">Тип уровня</label>
                <p className="text-sm mt-1">{card.level_type}</p>
              </div>

              <div>
                <label className="text-xs text-text-muted">Описание</label>
                {editing ? (
                  <textarea
                    className="w-full bg-graphite-lighter border border-glass-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-neon focus:outline-none focus:shadow-[0_0_10px_rgba(0,212,255,0.2)] mt-1"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm mt-1">{card.description || <span className="text-text-muted italic">Нет описания</span>}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-text-muted">Дочерних элементов</label>
                <p className="text-sm mt-1">{card.children_count}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-text-muted">Пользовательские поля</label>
                  {editing && (
                    <button onClick={addCustomField} className="text-xs text-neon hover:text-neon-dim">+ Добавить поле</button>
                  )}
                </div>
                <div className="space-y-2">
                  {Object.entries(editing ? formData.custom_fields : (card.custom_fields || {})).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-text-muted w-32 truncate">{key}</span>
                      {editing ? (
                        <input
                          className="flex-1 bg-graphite-lighter border border-glass-border rounded-lg px-2 py-1 text-sm text-text-primary focus:border-neon focus:outline-none"
                          value={value as string}
                          onChange={(e) => updateCustomField(key, e.target.value)}
                        />
                      ) : (
                        <span className="text-sm flex-1">{value as string || <span className="text-text-muted italic">пусто</span>}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          <GlassPanel>
            <div className="text-center py-12">
              <Network size={36} className="mx-auto text-text-muted mb-3 opacity-50" />
              <p className="text-text-muted text-sm">Выберите узел в иерархии для просмотра карточки</p>
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </motion.div>
  )
}
