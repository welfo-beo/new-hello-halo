import { useWorkspaceStore } from '../../stores/agent-workspace.store'
import { Loader2, Zap } from 'lucide-react'
import { useTranslation } from '../../i18n'

interface AgentAtomBarProps {
  onOpenWorkspace: () => void
}

export function AgentAtomBar({ onOpenWorkspace }: AgentAtomBarProps) {
  const { t } = useTranslation()
  const tasks = useWorkspaceStore(s => s.tasks)
  const active = Object.values(tasks).filter(t => t.status === 'running')

  if (active.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 border-b border-primary/10 flex-shrink-0">
      <Zap size={11} className="text-primary flex-shrink-0" />
      <div className="flex items-center gap-1 flex-1 overflow-hidden">
        {active.slice(0, 4).map(task => (
          <button
            key={task.id}
            onClick={onOpenWorkspace}
            className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] hover:bg-primary/20 transition-colors max-w-[140px]"
          >
            <Loader2 size={8} className="animate-spin flex-shrink-0" />
            <span className="truncate">{task.title}</span>
            {task.tool && <span className="text-primary/60 flex-shrink-0">· {task.tool}</span>}
          </button>
        ))}
        {active.length > 4 && (
          <span className="text-[10px] text-muted-foreground">+{active.length - 4}</span>
        )}
      </div>
      <button
        onClick={onOpenWorkspace}
        className="text-[10px] text-primary hover:text-primary/80 transition-colors flex-shrink-0"
      >
        {t('View')} →
      </button>
    </div>
  )
}
