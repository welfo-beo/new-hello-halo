import { useState, useEffect } from 'react'
import { GitBranch, GitCommit, FileText, X, Sparkles, RefreshCw, Plus, Check } from 'lucide-react'
import { api } from '../../api'
import { useTranslation } from '../../i18n'

interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
}

interface GitCommitItem {
  hash: string
  message: string
  author: string
  date: string
}

interface GitBranchItem {
  name: string
  current: boolean
  remote: boolean
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
  const [tab, setTab] = useState<'changes' | 'history' | 'branches'>('changes')
  const [files, setFiles] = useState<GitFileStatus[]>([])
  const [commits, setCommits] = useState<GitCommitItem[]>([])
  const [branches, setBranches] = useState<GitBranchItem[]>([])
  const [currentBranch, setCurrentBranch] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState('')
  const [loading, setLoading] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [generatingMsg, setGeneratingMsg] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)

  const loadStatus = async () => {
    setLoading(true)
    try {
      const [statusRes, branchRes] = await Promise.all([
        api.gitStatus(spaceId),
        (api as any).gitCurrentBranch(spaceId)
      ])
      if (statusRes.success) setFiles((statusRes.data as GitFileStatus[]) || [])
      if (branchRes.success) setCurrentBranch(branchRes.data as string || '')
    } catch {}
    setLoading(false)
  }

  const loadLog = async () => {
    setLoading(true)
    try {
      const res = await api.gitLog(spaceId)
      if (res.success) setCommits((res.data as GitCommitItem[]) || [])
    } catch {}
    setLoading(false)
  }

  const loadBranches = async () => {
    setLoading(true)
    try {
      const res = await (api as any).gitBranches(spaceId)
      if (res.success) setBranches((res.data as GitBranchItem[]) || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'changes') loadStatus()
    else if (tab === 'history') loadLog()
    else loadBranches()
  }, [tab])

  const handleFileClick = async (file: GitFileStatus) => {
    setSelectedFile(file.path)
    try {
      const res = await api.gitDiff(spaceId, file.path, file.staged)
      if (res.success) setDiff(res.data as string || '')
    } catch {}
  }

  const handleStageToggle = async (file: GitFileStatus, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (file.staged) {
        await (api as any).gitUnstage(spaceId, file.path)
      } else {
        await (api as any).gitStage(spaceId, file.path)
      }
      await loadStatus()
    } catch {}
  }

  const handleGenerateCommitMsg = async () => {
    setGeneratingMsg(true)
    try {
      const res = await (api as any).gitStagedDiff(spaceId)
      const stagedDiff = res.success ? (res.data as string) : ''
      const stagedFiles = files.filter(f => f.staged)
      const prompt = stagedDiff
        ? `Generate a concise git commit message (imperative mood, max 72 chars) for this staged diff:\n\n\`\`\`diff\n${stagedDiff.substring(0, 4000)}\n\`\`\`\n\nRespond with ONLY the commit message, no explanation.`
        : `Generate a concise git commit message for these staged files: ${stagedFiles.map(f => f.path).join(', ')}\n\nRespond with ONLY the commit message.`
      onInsert(prompt)
      onClose()
    } catch {}
    setGeneratingMsg(false)
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setCommitting(true)
    try {
      const res = await (api as any).gitCommit(spaceId, commitMsg.trim())
      if (res.success) {
        setCommitMsg('')
        await loadStatus()
      }
    } catch {}
    setCommitting(false)
  }

  const handleCheckout = async (branch: string) => {
    try {
      await (api as any).gitCheckout(spaceId, branch)
      setCurrentBranch(branch)
      await loadBranches()
    } catch {}
  }

  const handleCreateBranch = async () => {
    if (!newBranch.trim()) return
    try {
      await (api as any).gitCheckout(spaceId, newBranch.trim(), true)
      setCurrentBranch(newBranch.trim())
      setNewBranch('')
      setShowNewBranch(false)
      await loadBranches()
    } catch {}
  }

  const handleAIReview = () => {
    const prompt = selectedFile && diff
      ? `Please review the following git diff for \`${selectedFile}\` and provide feedback on code quality, potential bugs, and improvements:\n\n\`\`\`diff\n${diff.substring(0, 3000)}\n\`\`\``
      : `Please review the current git changes and provide a summary of what changed and any concerns:\n\n${files.map(f => `${STATUS_LABELS[f.status]} ${f.path}`).join('\n')}`
    onInsert(prompt)
    onClose()
  }

  const stagedCount = files.filter(f => f.staged).length

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border border-border
      rounded-xl shadow-lg z-40 flex flex-col max-h-[28rem]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <GitBranch size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium flex-1 truncate">
          {t('Git')}{currentBranch ? ` · ${currentBranch}` : ''}
        </span>
        <button
          onClick={() => { if (tab === 'changes') loadStatus(); else if (tab === 'history') loadLog(); else loadBranches() }}
          className="text-muted-foreground hover:text-foreground p-0.5"
        >
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
        {(['changes', 'history', 'branches'] as const).map(t2 => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            className={`px-3 py-1.5 text-xs capitalize transition-colors
              ${tab === t2 ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t2 === 'changes' ? `${t('Changes')}${files.length > 0 ? ` (${files.length})` : ''}` :
             t2 === 'history' ? t('History') : t('Branches')}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left panel */}
        <div className="w-48 flex-shrink-0 border-r border-border/30 flex flex-col overflow-hidden">
          {tab === 'changes' ? (
            <>
              <div className="flex-1 overflow-y-auto">
                {files.length === 0 ? (
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
                    <span
                      onClick={(e) => handleStageToggle(f, e)}
                      className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors
                        ${f.staged ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary'}`}
                    >
                      {f.staged && <Check size={10} />}
                    </span>
                    <span className={`text-xs font-mono font-bold flex-shrink-0 ${STATUS_COLORS[f.status]}`}>
                      {STATUS_LABELS[f.status]}
                    </span>
                    <span className="text-xs truncate text-foreground">{f.path.split('/').pop()}</span>
                  </button>
                ))}
              </div>
              {/* Commit area */}
              <div className="border-t border-border/30 p-2 space-y-1.5 flex-shrink-0">
                <div className="flex gap-1">
                  <input
                    value={commitMsg}
                    onChange={e => setCommitMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleCommit()}
                    placeholder={t('Commit message...')}
                    className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background min-w-0"
                  />
                  <button
                    onClick={handleGenerateCommitMsg}
                    disabled={generatingMsg}
                    title={t('Generate with AI')}
                    className="px-1.5 py-1 border border-border rounded bg-background hover:bg-muted transition-colors flex-shrink-0"
                  >
                    <Sparkles size={11} className={generatingMsg ? 'animate-pulse text-primary' : 'text-muted-foreground'} />
                  </button>
                </div>
                <button
                  onClick={handleCommit}
                  disabled={!commitMsg.trim() || committing || stagedCount === 0}
                  className="w-full py-1 text-xs bg-primary text-primary-foreground rounded disabled:opacity-40 hover:bg-primary/90 transition-colors"
                >
                  {committing ? t('Committing...') : `${t('Commit')}${stagedCount > 0 ? ` (${stagedCount})` : ''}`}
                </button>
              </div>
            </>
          ) : tab === 'history' ? (
            <div className="flex-1 overflow-y-auto">
              {commits.length === 0 ? (
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
              ))}
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {branches.filter(b => !b.remote).map(b => (
                  <button
                    key={b.name}
                    onClick={() => !b.current && handleCheckout(b.name)}
                    className={`w-full px-2 py-1.5 flex items-center gap-1.5 text-left transition-colors
                      ${b.current ? 'bg-primary/10 text-primary cursor-default' : 'hover:bg-muted/50 text-foreground'}`}
                  >
                    {b.current && <Check size={11} className="flex-shrink-0" />}
                    <span className="text-xs truncate">{b.name}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-border/30 p-2 flex-shrink-0">
                {showNewBranch ? (
                  <div className="flex gap-1">
                    <input
                      value={newBranch}
                      onChange={e => setNewBranch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch(); if (e.key === 'Escape') setShowNewBranch(false) }}
                      placeholder={t('Branch name...')}
                      autoFocus
                      className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background min-w-0"
                    />
                    <button onClick={handleCreateBranch} className="px-1.5 py-1 text-xs bg-primary text-primary-foreground rounded">
                      <Check size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewBranch(true)}
                    className="w-full py-1 text-xs border border-border rounded hover:bg-muted transition-colors flex items-center justify-center gap-1 text-muted-foreground"
                  >
                    <Plus size={11} />
                    {t('New branch')}
                  </button>
                )}
              </div>
            </div>
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
