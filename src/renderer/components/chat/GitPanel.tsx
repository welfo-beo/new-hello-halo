import { useState, useEffect } from 'react'
import { GitBranch, GitCommit, FileText, X, Sparkles, RefreshCw } from 'lucide-react'
import { api } from '../../api'
import { useTranslation } from '../../i18n'

interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
}

interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

interface GitPanelProps {
  spaceId: string
  onInsert: (text: string) => void
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  modified: 'text-yellow-500',
  added: 'text-green-500',
  deleted: 'text-red-500',
  renamed: 'text-blue-500',
  untracked: 'text-muted-foreground'
}

const STATUS_LABELS: Record<string, string> = {
  modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: '?'
}

export function GitPanel({ spaceId, onInsert, onClose }: GitPanelProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'changes' | 'history'>('changes')
  const [files, setFiles] = useState<GitFileStatus[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  const [loading, setLoading] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await api.gitStatus(spaceId)
      if (res.success) setFiles((res.data as GitFileStatus[]) || [])
    } catch {}
    setLoading(false)
  }

  const loadLog = async () => {
    setLoading(true)
    try {
      const res = await api.gitLog(spaceId)
      if (res.success) setCommits((res.data as GitCommit[]) || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'changes') loadStatus()
    else loadLog()
  }, [tab])

  const handleFileClick = async (file: GitFileStatus) => {
    setSelectedFile(file.path)
    try {
      const res = await api.gitDiff(spaceId, file.path, file.staged)
      if (res.success) setDiff(res.data as string || '')
    } catch {}
  }

  const handleAIReview = () => {
    const prompt = selectedFile && diff
      ? `Please review the following git diff for \`${selectedFile}\` and provide feedback on code quality, potential bugs, and improvements:\n\n\`\`\`diff\n${diff.substring(0, 3000)}\n\`\`\``
      : `Please review the current git changes and provide a summary of what changed and any concerns:\n\n${files.map(f => `${STATUS_LABELS[f.status]} ${f.path}`).join('\n')}`
    onInsert(prompt)
    onClose()
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border
      rounded-xl shadow-lg z-40 flex flex-col max-h-96">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <GitBranch size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium flex-1">{t('Git')}</span>
        <button onClick={loadStatus} className="text-muted-foreground hover:text-foreground p-0.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={handleAIReview}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
        >
          <Sparkles size={12} />
          {t('AI Review')}
        </button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        {(['changes', 'history'] as const).map(t2 => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`px-3 py-1.5 text-xs capitalize transition-colors
              ${tab === t2 ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t2 === 'changes' ? `${t('Changes')} ${files.length > 0 ? `(${files.length})` : ''}` : t('History')}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* File list / commit list */}
        <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-border/30">
          {tab === 'changes' ? (
            files.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                {loading ? t('Loading...') : t('No changes')}
              </div>
            ) : files.map(f => (
              <button
                key={f.path}
                onClick={() => handleFileClick(f)}
                className={`w-full px-2 py-1.5 flex items-center gap-1.5 text-left hover:bg-muted/50 transition-colors
                  ${selectedFile === f.path ? 'bg-primary/10' : ''}`}
              >
                <span className={`text-xs font-mono font-bold flex-shrink-0 ${STATUS_COLORS[f.status]}`}>
                  {STATUS_LABELS[f.status]}
                </span>
                <span className="text-xs truncate text-foreground">{f.path.split('/').pop()}</span>
                {f.staged && <span className="ml-auto text-[10px] text-green-500 flex-shrink-0">S</span>}
              </button>
            ))
          ) : (
            commits.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                {loading ? t('Loading...') : t('No commits')}
              </div>
            ) : commits.map(c => (
              <button
                key={c.hash}
                onClick={() => setDiff(`commit ${c.hash}\nAuthor: ${c.author}\nDate: ${c.date}\n\n    ${c.message}`)}
                className="w-full px-2 py-1.5 flex flex-col gap-0.5 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <GitCommit size={11} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] font-mono text-muted-foreground">{c.hash}</span>
                </div>
                <span className="text-xs truncate text-foreground">{c.message}</span>
                <span className="text-[10px] text-muted-foreground">{c.date}</span>
              </button>
            ))
          )}
        </div>

        {/* Diff viewer */}
        <div className="flex-1 overflow-auto p-2">
          {diff ? (
            <pre className="text-[11px] font-mono whitespace-pre-wrap text-foreground/80 leading-relaxed">
              {diff.split('\n').map((line, i) => (
                <span key={i} className={
                  line.startsWith('+') && !line.startsWith('+++') ? 'text-green-600 dark:text-green-400' :
                  line.startsWith('-') && !line.startsWith('---') ? 'text-red-600 dark:text-red-400' :
                  line.startsWith('@@') ? 'text-blue-500' : ''
                }>{line}{'\n'}</span>
              ))}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1">
                <FileText size={20} className="opacity-30" />
                <span>{t('Select a file to view diff')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
