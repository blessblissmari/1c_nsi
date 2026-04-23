import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Calculator, CheckCircle2, ClipboardList, Cpu, FileText, Gauge, Loader2, Package, Search, Send, Settings2, Shield, Sparkles, Trash2, Upload, User, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'
import { chatApi, hierarchyApi, reliabilityApi } from '../../api'
import { useAppStore } from '../../store'
import { GlassPanel, SourceBadge, VerifiedBadge } from '../ui/GlassCard'
import { FileUpload } from '../ui/FileUpload'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
}

interface ModelDetail {
  id: number
  original_name: string
  normalized_name: string | null
  class_name: string | null
  subclass_name: string | null
  source_type: string | null
  confidence: number | null
  verified: boolean
  documents_count: number
  characteristics_count: number
}

interface ActionItem {
  id: string
  label: string
  icon: React.ReactNode
  tone?: 'primary' | 'muted'
}

function formatMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[\-•]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^ +/gm, '')
    .trim()
}

const actionGroups: { title: string; items: ActionItem[] }[] = [
  {
    title: 'Классификация',
    items: [
      { id: 'classify_classifier', label: 'По классификатору', icon: <ClipboardList size={15} />, tone: 'primary' },
      { id: 'classify_model', label: 'ИИ + интернет', icon: <Sparkles size={15} /> },
    ],
  },
  {
    title: 'Характеристики',
    items: [
      { id: 'required_from_docs', label: 'Обязательные из документов', icon: <FileText size={15} />, tone: 'primary' },
      { id: 'required_from_web', label: 'Обязательные из интернета', icon: <Search size={15} /> },
      { id: 'other_from_docs', label: 'Прочие из документов', icon: <Settings2 size={15} /> },
    ],
  },
  {
    title: 'ВВ и периодичности',
    items: [
      { id: 'maintenance_from_docs', label: 'Из документов', icon: <FileText size={15} />, tone: 'primary' },
      { id: 'maintenance_from_web', label: 'Из интернета', icon: <Search size={15} /> },
    ],
  },
  {
    title: 'ТК ТОиР',
    items: [
      { id: 'tk_components_docs', label: 'Узлы из документов', icon: <Cpu size={15} />, tone: 'primary' },
      { id: 'tk_components_web', label: 'Узлы из интернета', icon: <Search size={15} /> },
      { id: 'tk_operations_docs', label: 'Операции из документов', icon: <Wrench size={15} /> },
      { id: 'tk_operations_web', label: 'Операции из интернета', icon: <Search size={15} /> },
      { id: 'tk_tmc_docs', label: 'ТМЦ операций из документов', icon: <Package size={15} /> },
      { id: 'tk_tmc_web', label: 'ТМЦ операций из интернета', icon: <Search size={15} /> },
    ],
  },
  {
    title: 'ТМЦ',
    items: [
      { id: 'tmc_docs', label: 'Сформировать из документов', icon: <Package size={15} />, tone: 'primary' },
      { id: 'tmc_web', label: 'Обогатить из интернета', icon: <Search size={15} /> },
      { id: 'tmc_analogs', label: 'Подобрать аналоги', icon: <Shield size={15} /> },
    ],
  },
  {
    title: 'Надёжность',
    items: [
      { id: 'reliability_from_docs', label: 'Показатели из документов', icon: <Gauge size={15} />, tone: 'primary' },
      { id: 'reliability_from_web', label: 'Показатели из интернета', icon: <Search size={15} /> },
      { id: 'recalc_mtbf', label: 'Пересчитать MTBF', icon: <Calculator size={15} /> },
    ],
  },
]

export function ChatWorkspace() {
  const { isAiLoading, setAiLoading, selectedModelId, setSelectedModelId, loading, setLoading } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [models, setModels] = useState<any[]>([])
  const [modelDetail, setModelDetail] = useState<ModelDetail | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const failuresInputRef = useRef<HTMLInputElement>(null)
  const messageIdRef = useRef(0)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    scrollToBottom()
  }, [messages, isAiLoading])

  useEffect(() => {
    ;(async () => {
      try {
        const data = await hierarchyApi.getModels({ limit: 500 })
        setModels(data as any[])
      } catch {
        toast.error('Ошибка загрузки списка моделей')
      }
    })()
  }, [])

  useEffect(() => {
    if (selectedModelId) {
      loadModelDetail(selectedModelId)
    } else {
      setModelDetail(null)
    }
  }, [selectedModelId])

  const selectedModelName = useMemo(() => {
    const m = models.find((x) => x.id === selectedModelId)
    return modelDetail?.normalized_name || modelDetail?.original_name || m?.normalized_name || m?.original_name || 'Модель не выбрана'
  }, [models, modelDetail, selectedModelId])

  const loadModelDetail = async (id: number) => {
    try {
      const detail = await hierarchyApi.getModelDetail(id)
      setModelDetail(detail as ModelDetail)
    } catch {
      setModelDetail(null)
    }
  }

  const appendAssistant = (content: string, sources?: string[]) => {
    setMessages((prev) => [
      ...prev,
      { id: ++messageIdRef.current, role: 'assistant', content, sources: sources || [] },
    ])
  }

  const handleUploadDocument = async (file: File) => {
    if (!selectedModelId) return toast.error('Выберите модель')
    setLoading('chat-upload-doc', true)
    try {
      await hierarchyApi.uploadDocument(selectedModelId, file)
      toast.success('Документ загружен')
      await loadModelDetail(selectedModelId)
    } catch {
      toast.error('Ошибка загрузки документа')
    } finally {
      setLoading('chat-upload-doc', false)
    }
  }

  const handleUploadFailures = async (file: File) => {
    setLoading('chat-upload-failures', true)
    try {
      const res = await reliabilityApi.uploadFailures(file) as any
      toast.success(res.message)
      appendAssistant(res.message)
    } catch {
      toast.error('Не удалось загрузить статистику отказов')
    } finally {
      setLoading('chat-upload-failures', false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isAiLoading) return

    const userMessage: Message = { id: ++messageIdRef.current, role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setAiLoading(true)

    try {
      const response = (await chatApi.sendMessage(userMessage.content, selectedModelId ?? undefined)) as any
      appendAssistant(response?.message || response?.text || 'Пустой ответ от ТОРи', response?.sources || [])
    } catch (e: any) {
      appendAssistant(`Ошибка: ${e?.message || e?.toString() || 'не удалось получить ответ'}`)
    } finally {
      setAiLoading(false)
      inputRef.current?.focus()
    }
  }

  const runAction = async (action: string) => {
    if (!selectedModelId) return toast.error('Выберите модель')
    setLoading(`chat-action-${action}`, true)
    try {
      const res = await chatApi.action(action, selectedModelId)
      toast.success(res.message)
      appendAssistant(res.message, res.sources || [])
      await loadModelDetail(selectedModelId)
    } catch (e: any) {
      const message = e?.response?.data?.detail || e?.message || 'Ошибка действия'
      toast.error(message)
      appendAssistant(`Ошибка действия: ${message}`)
    } finally {
      setLoading(`chat-action-${action}`, false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto h-[calc(100vh-6rem)] grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_430px] gap-4">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 truncate">Единое окно (ТОРя)</h1>
                <p className="text-xs text-gray-500 truncate">Чат и действия по выбранной модели: классификация, характеристики, ТК, ТМЦ, надёжность</p>
              </div>
            </div>
            {hasMessages && (
              <button
                onClick={() => setMessages([])}
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Очистить чат"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto glass rounded-2xl p-4 mb-4 min-h-0">
            {!hasMessages ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Bot className="w-16 h-16 text-blue-600/30 mb-4" />
                <h2 className="text-lg font-medium text-gray-700 mb-2">ТОРя готова работать по модели</h2>
                <p className="text-sm text-gray-500 max-w-md">
                  Выберите модель справа, загрузите документы и запускайте нужные действия. Все результаты будут появляться в этом чате.
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-2">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex p-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[86%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'}`}>
                      <div className="flex items-start gap-2">
                        {msg.role === 'assistant' && <Bot size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />}
                        {msg.role === 'user' && <User size={16} className="text-white mt-0.5 flex-shrink-0" />}
                        <div className="text-sm whitespace-pre-wrap break-words">{formatMarkdown(msg.content)}</div>
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300">
                          <p className="text-xs text-gray-500">Источники:</p>
                          {msg.sources.map((src, i) => (
                            <p key={i} className="text-xs text-gray-500 truncate">{src}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">ТОРя думает...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Напишите вопрос по выбранной модели..."
                className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
                rows={2}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isAiLoading}
                className="p-3 rounded-xl bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                title="Отправить"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 min-h-0">
          <GlassPanel title="Окно работы по модели">
            <select
              value={selectedModelId ?? ''}
              onChange={(e) => setSelectedModelId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
            >
              <option value="">Модель не выбрана</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.normalized_name || m.original_name}
                </option>
              ))}
            </select>

            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{selectedModelName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <SourceBadge source={modelDetail?.source_type} />
                    <VerifiedBadge verified={!!modelDetail?.verified} />
                  </div>
                </div>
                {modelDetail?.verified && <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <div className="text-gray-500">Класс</div>
                  <div className="font-medium text-gray-900 truncate">{modelDetail?.class_name || 'Не определён'}</div>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <div className="text-gray-500">Подкласс</div>
                  <div className="font-medium text-gray-900 truncate">{modelDetail?.subclass_name || 'Не определён'}</div>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <div className="text-gray-500">Документы</div>
                  <div className="font-medium text-gray-900">{modelDetail?.documents_count ?? 0}</div>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <div className="text-gray-500">Характеристики</div>
                  <div className="font-medium text-gray-900">{modelDetail?.characteristics_count ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-2">Документы карточки ТОР</div>
                <FileUpload onUpload={handleUploadDocument} loading={loading['chat-upload-doc']} />
              </div>
              <div>
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
                <button
                  className="w-full btn-secondary text-sm px-3 py-2 flex items-center justify-center gap-2"
                  onClick={() => failuresInputRef.current?.click()}
                  disabled={loading['chat-upload-failures']}
                >
                  {loading['chat-upload-failures'] ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Загрузить статистику отказов
                </button>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel title="Действия">
            <div className="space-y-4">
              {actionGroups.map((group) => (
                <div key={group.title}>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group.title}</div>
                  <div className="grid grid-cols-1 gap-2">
                    {group.items.map((item) => {
                      const key = `chat-action-${item.id}`
                      const busy = !!loading[key]
                      return (
                        <button
                          key={item.id}
                          className={`text-sm px-3 py-2 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                            item.tone === 'primary'
                              ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          disabled={!selectedModelId || busy}
                          onClick={() => runAction(item.id)}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            {busy ? <Loader2 size={15} className="animate-spin flex-shrink-0" /> : item.icon}
                            <span className="truncate">{item.label}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}

