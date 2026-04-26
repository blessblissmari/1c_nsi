import type { ReactNode } from "react";
import { ExternalLink, FileText, X } from "lucide-react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className = "",
  hover = false,
  onClick,
}: GlassCardProps) {
  const hoverCls = hover ? "transition-colors hover:bg-slate-50" : "";
  return (
    <div
      className={`glass p-4 ${hoverCls} ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : undefined }}
    >
      {children}
    </div>
  );
}

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}

export function GlassPanel({
  children,
  className = "",
  title,
  action,
}: GlassPanelProps) {
  return (
    <div className={`glass-panel p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4 min-w-0">
          {title && (
            <div className="text-base font-semibold text-slate-800 truncate min-w-0">
              {title}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

interface SourceBadgeProps {
  source?: string | null;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  if (!source) return null;
  const labels: Record<string, string> = {
    upload: "Загрузка",
    vector_store: "Документ",
    yandex_web: "Интернет",
    seed: "Справочник",
    classifier: "Классификатор",
    classifier_partial: "Классификатор",
    seed_file: "Файл",
  };
  return (
    <span className={`source-badge-${source} text-xs px-2 py-0.5 rounded-full`}>
      {labels[source] || source}
    </span>
  );
}

interface ConfidenceBarProps {
  value?: number | null;
}

export function ConfidenceBar({ value }: ConfidenceBarProps) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-error";
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-16 h-1.5 bg-graphite-lighter rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-text-muted">{pct}%</span>
    </div>
  );
}

interface VerifiedBadgeProps {
  verified: boolean;
}

export function VerifiedBadge({ verified }: VerifiedBadgeProps) {
  if (!verified) return null;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">
      Проверено Иванов И.И.
    </span>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
  size?: "sm" | "md";
}

export function ActionButton({
  label,
  onClick,
  loading,
  disabled,
  variant = "primary",
  icon,
  size = "md",
}: ActionButtonProps) {
  const baseClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? "btn-primary !bg-error"
        : "btn-secondary";
  const sizeClass = size === "sm" ? "text-xs px-3 py-1.5" : "";

  return (
    <button
      className={`${baseClass} ${sizeClass} flex items-center gap-2 disabled:opacity-50`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <span className="animate-spin">⏳</span> : icon}
      {label}
    </button>
  );
}

interface SourceUrlLinkProps {
  url?: string | null;
}

export function SourceUrlLink({ url }: SourceUrlLinkProps) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-neon hover:text-neon/80 transition-colors"
      title={url}
    >
      <ExternalLink size={10} />
      <span className="truncate max-w-[150px]">Источник</span>
    </a>
  );
}

interface DocumentPreviewModalProps {
  document: {
    filename: string;
    parsed_content?: string | null;
    file_type?: string;
  } | null;
  onClose: () => void;
}

export function DocumentPreviewModal({
  document,
  onClose,
}: DocumentPreviewModalProps) {
  if (!document) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-3xl max-h-[80vh] m-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-glass-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-neon" />
            <h3 className="text-lg font-semibold text-text-primary truncate">
              {document.filename}
            </h3>
            {document.file_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-neon/10 text-neon">
                {document.file_type}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
          {document.parsed_content ? (
            <pre className="whitespace-pre-wrap text-sm text-text-secondary font-mono leading-relaxed">
              {document.parsed_content}
            </pre>
          ) : (
            <p className="text-text-muted text-sm text-center py-8">
              Содержимое документа не доступно
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface DocumentPreviewButtonProps {
  filename: string;
  hasContent: boolean;
  onClick: () => void;
}

export function DocumentPreviewButton({
  filename,
  hasContent,
  onClick,
}: DocumentPreviewButtonProps) {
  if (!hasContent) return null;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-pink hover:text-pink/80 transition-colors"
      title={`Предпросмотр: ${filename}`}
    >
      <FileText size={10} />
      <span>Документ</span>
    </button>
  );
}
