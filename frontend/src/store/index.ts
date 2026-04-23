import { create } from 'zustand'

interface AppState {
  activeWorkspace: string
  selectedModelId: number | null
  selectedNodeId: number | null
  sidebarOpen: boolean
  loading: Record<string, boolean>
  isAiLoading: boolean
  setActiveWorkspace: (ws: string) => void
  setSelectedModelId: (id: number | null) => void
  setSelectedNodeId: (id: number | null) => void
  setSidebarOpen: (open: boolean) => void
  setLoading: (key: string, value: boolean) => void
  setAiLoading: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeWorkspace: 'hierarchy',
  selectedModelId: null,
  selectedNodeId: null,
  sidebarOpen: true,
  loading: {},
  isAiLoading: false,
  setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),
  setSelectedModelId: (id) => set({ selectedModelId: id }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setLoading: (key, value) =>
    set((state) => {
      const newLoading = { ...state.loading, [key]: value }
      const aiLoading = Object.values(newLoading).some(Boolean)
      return { loading: newLoading, isAiLoading: aiLoading }
    }),
  setAiLoading: (v) => set({ isAiLoading: v }),
}))

export const WORKSPACES = [
  { id: 'hierarchy', label: 'Иерархия и модели', icon: 'Network' },
  { id: 'upper-levels', label: 'Карточки объектов', icon: 'Layers' },
  { id: 'mass-processing', label: 'Обработка моделей', icon: 'Cpu' },
  { id: 'maintenance', label: 'ВВ и периодичности', icon: 'Wrench' },
  { id: 'tk', label: 'ТК ТОиР', icon: 'FileText' },
  { id: 'specifications', label: 'ТМЦ', icon: 'Package' },
  { id: 'reliability', label: 'Надёжность', icon: 'Shield' },
  { id: 'chat', label: 'Единое окно (ТОРя)', icon: 'MessageCircle' },
  { id: 'parser', label: 'Парсинг паспортов', icon: 'FileSearch' },
] as const

