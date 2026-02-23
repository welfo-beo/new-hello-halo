import { useState, useRef, useEffect } from 'react'
import { Search, FileText, X } from 'lucide-react'
import { api } from '../../api'
import { useTranslation } from '../../i18n'

interface FileSearchResult {
  filePath: string
  relativePath: string
  fileName: string
  matchCount: number
  snippets: Array<{ line: number; content: string }>
}

interface FileSearchPanelProps {
  spaceId: string
  onInsert: (text: string) => void
  onClose: () => void
}

export function FileSearchPanel({ spaceId, onInsert, onClose }: FileSearchPanelProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FileSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const runSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await api.fileSearch(q, spaceId)
      if (res.success) setResults((res.data as FileSearchResult[]) || [])
    } catch {}
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => runSearch(q), 300)
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-0 bg-popover border border-border
      rounded-xl shadow-lg z-40 flex flex-col max-h-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Search size={14} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          placeholder={t('Search files in workspace...')}
          className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground/50"
        />
        {loading && <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />}
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      {/* Results */}
      <div className="overflow-y-auto flex-1">
        {results.length === 0 && query && !loading && (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">{t('No files found')}</div>
        )}
        {results.map((r) => (
          <button
            key={r.filePath}
            onClick={() => { onInsert(r.relativePath); onClose() }}
            className="w-full px-3 py-2 flex flex-col gap-0.5 text-left hover:bg-muted/50 transition-colors border-b border-border/20 last:border-0"
          >
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">{r.fileName}</span>
              <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{r.matchCount} matches</span>
            </div>
            <div className="text-xs text-muted-foreground truncate pl-5">{r.relativePath}</div>
            {r.snippets[0] && (
              <div className="text-xs text-muted-foreground/70 truncate pl-5 font-mono">
                L{r.snippets[0].line}: {r.snippets[0].content}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
