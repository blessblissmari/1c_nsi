import type { ReactNode } from "react";
import { X } from "lucide-react";

interface InfoDrawerProps {
  title: ReactNode;
  subtitle?: ReactNode;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

/** Простая боковая панель с карточкой узла. Без анимаций — намеренно. */
export function InfoDrawer({
  title,
  subtitle,
  open,
  onClose,
  children,
  width = 420,
}: InfoDrawerProps) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-slate-900/30"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed top-0 right-0 z-40 h-full bg-white border-l border-slate-200 shadow-xl flex flex-col"
        style={{ width }}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-800 truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm">{children}</div>
      </aside>
    </>
  );
}
