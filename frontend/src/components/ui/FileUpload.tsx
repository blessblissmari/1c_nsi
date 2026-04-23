import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'

interface FileUploadProps {
  onUpload: (file: File) => void
  accept?: Record<string, string[]>
  label?: string
  loading?: boolean
}

export function FileUpload({ onUpload, accept, label = 'Загрузить файл', loading }: FileUploadProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onUpload(accepted[0])
    },
    [onUpload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      className={`glass-panel p-6 text-center cursor-pointer transition-all ${
        isDragActive ? 'border-neon bg-neon-glow/10' : 'hover:border-neon/50'
      }`}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto mb-2 text-neon" size={28} />
      <p className="text-text-secondary text-sm">
        {isDragActive ? 'Отпустите файл...' : label}
      </p>
      <p className="text-text-muted text-xs mt-1">.xlsx, .pdf, .docx, .csv</p>
      {loading && <p className="text-neon text-xs mt-2 animate-pulse">Загрузка...</p>}
    </div>
  )
}
