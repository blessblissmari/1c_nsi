import { motion } from 'framer-motion'
import { NavLink, useNavigate } from 'react-router'
import { Network, Layers, Cpu, Wrench, FileText, Package, Shield, MessageCircle, Database, FileSearch, ChevronLeft, ChevronRight, Menu, LogOut, User } from 'lucide-react'
import { WORKSPACES } from '../../store'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '../../auth/store'

const ICONS: Record<string, any> = { Network, Layers, Cpu, Wrench, FileText, Package, Shield, MessageCircle, Database, FileSearch }

const handleExport1C = () => alert('Экспорт в 1С: пока заглушка')
const handleExportSAP = () => alert('Экспорт в SAP: пока заглушка')

export function Navbar() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [showMore, setShowMore] = useState(false)
  const [showAllTabs, setShowAllTabs] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const workspaces = useMemo(() => WORKSPACES, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const active = scroller.querySelector<HTMLElement>('[data-active="true"]')
    if (!active) return
    active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  })

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const compute = () => setIsOverflowing(scroller.scrollWidth > scroller.clientWidth + 4)
    compute()

    const ro = new ResizeObserver(compute)
    ro.observe(scroller)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [])

  const scrollByAmount = (dir: -1 | 1) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollBy({ left: dir * Math.max(240, Math.floor(scroller.clientWidth * 0.6)), behavior: 'smooth' })
  }

  return (
    <>
      <nav className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-6xl pointer-events-auto">
        <div className="glass px-2 py-1.5 rounded-full border border-slate-300/50">
          <div className="relative flex items-center gap-2">
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/70 to-transparent rounded-l-full" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/70 to-transparent rounded-r-full" />

            {isOverflowing && (
              <button
                onClick={() => scrollByAmount(-1)}
                className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                title="Прокрутить влево"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <div ref={scrollerRef} className="no-scrollbar flex items-center gap-0.5 overflow-x-auto whitespace-nowrap pr-2">
              {workspaces.map((ws) => {
                const Icon = ICONS[ws.icon]
                return (
                  <NavLink
                    key={ws.id}
                    to={`/${ws.id}`}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-neon/20 text-neon shadow-[0_0_12px_rgba(37,99,235,0.25)]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="flex items-center gap-1.5" data-active={isActive ? 'true' : 'false'}>
                          {Icon && <Icon size={16} className={isActive ? 'drop-shadow-[0_0_6px_rgba(37,99,235,0.5)]' : ''} />}
                          <span className="hidden md:inline whitespace-nowrap">{ws.label}</span>
                        </span>
                        {isActive && (
                          <motion.div
                            layoutId="navbar-glow"
                            className="absolute -bottom-0.5 left-3 right-3 h-[2px] bg-neon rounded-full"
                            style={{ boxShadow: '0 0 8px rgba(37,99,235,0.5)' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white/90 text-slate-800 text-[10px] px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-300 shadow-sm">
                          {ws.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>

            {isOverflowing && (
              <button
                onClick={() => scrollByAmount(1)}
                className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                title="Прокрутить вправо"
              >
                <ChevronRight size={16} />
              </button>
            )}

            <div className="relative flex items-center gap-1 pl-2 border-l border-slate-300/50">
              <button
                onClick={() => setShowAllTabs((v) => !v)}
                className="px-2 py-1.5 rounded-full text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                title="Все вкладки"
              >
                <span className="inline-flex items-center gap-1">
                  <Menu size={12} />
                  Вкладки
                </span>
              </button>
              <button
                onClick={() => setShowMore((v) => !v)}
                className="px-2 py-1.5 rounded-full text-[10px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-all"
                title="Меню"
              >
                Ещё
              </button>

              {showAllTabs && (
                <div className="absolute right-0 top-[calc(100%+10px)] glass-panel p-2 min-w-56 z-50">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted px-2 py-1">Перейти</div>
                  {workspaces.map((ws) => (
                    <NavLink
                      key={`all-${ws.id}`}
                      to={`/${ws.id}`}
                      onClick={() => setShowAllTabs(false)}
                      className={({ isActive }) =>
                        `block px-2 py-2 rounded-lg text-xs transition-colors ${isActive ? 'bg-neon/10 text-neon' : 'text-text-secondary hover:bg-slate-200/60'}`
                      }
                    >
                      {ws.label}
                    </NavLink>
                  ))}
                </div>
              )}

              {showMore && (
                <div className="absolute right-0 top-[calc(100%+10px)] glass-panel p-2 min-w-56 z-50">
                  {user && (
                    <div className="px-2 py-1 text-[10px] text-text-muted flex items-center gap-1">
                      <User size={10} /> {user.full_name || user.email}
                    </div>
                  )}
                  <button
                    onClick={() => { setShowMore(false); handleExport1C() }}
                    className="w-full text-left px-2 py-2 rounded-lg text-xs text-text-secondary hover:bg-slate-200/60 transition-colors"
                  >
                    Экспорт в 1С
                  </button>
                  <button
                    onClick={() => { setShowMore(false); handleExportSAP() }}
                    className="w-full text-left px-2 py-2 rounded-lg text-xs text-text-secondary hover:bg-slate-200/60 transition-colors"
                  >
                    Экспорт в SAP
                  </button>
                  <div className="my-1 border-t border-slate-300/50" />
                  <button
                    onClick={() => { setShowMore(false); logout(); navigate('/login') }}
                    className="w-full text-left px-2 py-2 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                  >
                    <LogOut size={12} /> Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="fixed bottom-4 right-4 z-40 pointer-events-none select-none">
        <div className="glass-panel px-3 py-2">
          <img src="/logo.svg" alt="NSI Tool" className="w-28 md:w-36 h-auto object-contain opacity-90" />
        </div>
      </div>
    </>
  )
}

