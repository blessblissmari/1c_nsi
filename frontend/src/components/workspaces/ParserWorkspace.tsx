// -*- coding: utf-8 -*-
import { useState } from 'react'
import { FileText, Upload, Save, X, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { GlassPanel, ActionButton } from '../ui/GlassCard'
import { parserApi } from '../../api'

interface ModelCard {
  original_name: string
  normalized_name?: string
  model_code?: string
  class_id?: number
  class_name?: string
  characteristics: { name: string; value: string; unit: string }[]
  maintenance: { name: string; periodicity_months: number }[]
  reliability: { name: string; value: number }[]
}

export function ParserWorkspace() {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<any>(null)
  const [card, setCard] = useState<ModelCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [jobStatus, setJobStatus] = useState<string | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
      setParsed(null)
      setCard(null)
      setJobStatus(null)
    }
  }

  const handleParse = async () => {
    if (!file) return
    setLoading(true)
    setJobStatus('Загружаю документ...')
    try {
      const accepted = await parserApi.parseDocument(file) as any
      if (!accepted?.job_id) throw new Error('Не удалось запустить парсинг')

      const jobId = String(accepted.job_id)
      setJobStatus('Распознаю (MinerU pipeline)...')

      let result: any = null
      const startedAt = Date.now()
      while (true) {
        // Hard-stop after 15 minutes to avoid infinite wait.
        if (Date.now() - startedAt > 15 * 60 * 1000) {
          throw new Error('Парсинг слишком долгий (15 мин). Проверьте MinerU и повторите попытку.')
        }
        await new Promise((r) => setTimeout(r, 2000))
        const poll = await parserApi.getParseJob(jobId) as any
        if (poll?.status === 'success') {
          result = poll
          break
        }
        if (poll?.status === 'running') setJobStatus('Распознаю (MinerU pipeline)...')
        if (poll?.status === 'queued') setJobStatus('В очереди...')
      }

      if (result?.status !== 'success') throw new Error('Не удалось прочитать документ')

      setParsed(result.data)
      toast.success('Текст извлечён')

      const cardResult = await parserApi.generateCard(result.data) as any
      setCard(cardResult)
      toast.success('Карточка модели создана')
    } catch (e: any) {
      toast.error(e.message || 'Ошибка парсинга')
    } finally {
      setLoading(false)
      setJobStatus(null)
    }
  }

  const handleSave = async () => {
    if (!card) return
    setSaving(true)
    try {
      const result = await parserApi.addToHierarchy(card) as any
      toast.success(result.message || 'Модель добавлена')
      setFile(null)
      setParsed(null)
      setCard(null)
      setJobStatus(null)
    } catch (e: any) {
      toast.error(e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Парсинг техпаспортов
        </h1>

        {/* Upload */}
        <GlassPanel title="Загрузка документа" className="mb-4">
          <div className="flex flex-col items-center gap-4">
            <label className="flex flex-col items-center gap-3 cursor-pointer">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
                <FileText size={32} className="text-gray-400" />
              </div>
              <span className="text-sm text-gray-500">
                {file ? file.name : 'Выберите PDF или изображение'}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {file && (
              <ActionButton
                label={loading ? 'Распознаю... (скан может занять до 5 минут)' : 'Распознать документ'}
                onClick={handleParse}
                disabled={loading}
                icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              />
            )}

            {loading && jobStatus && (
              <div className="text-xs text-gray-500">{jobStatus}</div>
            )}
          </div>
        </GlassPanel>

        {/* Parsed Result */}
        {parsed && card && (
          <>
            <div className="mb-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Check size={16} className="text-green-500" />
                <span className="text-sm">Документ распознан</span>
              </div>
            </div>

            {/* Model Card */}
            <GlassPanel title="Карточка модели" className="mb-4">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs text-gray-400 uppercase">Наименование</label>
                  <input
                    value={card.original_name}
                    onChange={(e) => setCard({ ...card, original_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Normalized */}
                <div>
                  <label className="text-xs text-gray-400 uppercase">Нормализованное</label>
                  <input
                    value={card.normalized_name || ''}
                    onChange={(e) => setCard({ ...card, normalized_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Code */}
                <div>
                  <label className="text-xs text-gray-400 uppercase">Код модели</label>
                  <input
                    value={card.model_code || ''}
                    onChange={(e) => setCard({ ...card, model_code: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Class */}
                <div>
                  <label className="text-xs text-gray-400 uppercase">Класс</label>
                  <input
                    value={card.class_name || ''}
                    onChange={(e) => setCard({ ...card, class_name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {/* Characteristics */}
                {card.characteristics.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-400 uppercase">Характеристики</label>
                    <div className="mt-1 space-y-1">
                      {card.characteristics.map((c, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="text-gray-600">{c.name}:</span>
                          <span className="font-medium">{c.value}</span>
                          <span className="text-gray-400">{c.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Maintenance */}
                {card.maintenance.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-400 uppercase">ТО</label>
                    <div className="mt-1 space-y-1">
                      {card.maintenance.map((m, i) => (
                        <div key={i} className="flex gap-2 text-sm">
                          <span className="text-gray-600">{m.name}:</span>
                          <span className="font-medium">{m.periodicity_months} мес.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </GlassPanel>

            {/* Actions */}
            <div className="flex gap-3">
              <ActionButton
                label="Добавить в иерархию"
                onClick={handleSave}
                disabled={saving}
                icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              />
              <ActionButton
                label="Отмена"
                onClick={() => { setFile(null); setParsed(null); setCard(null); }}
                variant="secondary"
                icon={<X size={18} />}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
