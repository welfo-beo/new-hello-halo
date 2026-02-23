import { useState } from 'react'
import { useWorkspaceStore, WorkspaceTask } from '../../stores/agent-workspace.store'
import { CheckCircle2, Circle, Loader2, XCircle, ChevronRight, X, Zap, Wrench, LayoutGrid, GitBranch } from 'lucide-react'
import { useTranslation } from '../../i18n'

function StatusIcon({ status }: { status: WorkspaceTask['status'] }) {
  if (status === 'done') return <CheckCircle2 size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
  if (status === 'error') return <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
  if (status === 'running') return <Loader2 size={13} className="text-primary animate-spin flex-shrink-0 mt-0.5" />
  return <Circle size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />
}

function TaskNode({ id, tasks, depth = 0 }: { id: string; tasks: Record<string, WorkspaceTask>; depth?: number }) {
  const task = tasks[id]
  const [expanded, setExpanded] = useState(true)
  if (!task) return null
  const hasChildren = task.children.length > 0

  return (
    <div>
      <div
        className="flex items-start gap-1.5 py-1.5 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: 8 }}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        {hasChildren
          ? <ChevronRight size={11} className={`mt-1 flex-shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
          : <span className="w-[11px] flex-shrink-0" />
        }
        <StatusIcon status={task.status} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground leading-snug">{task.title}</p>
          {task.status === 'running' && task.tool && (
            <p className="text-[10px] text-primary/70 mt-0.5 flex items-center gap-1">
              <Wrench size={9} />{task.tool}
            </p>
          )}
        </div>
        {task.status === 'done' && task.endTime && (
          <span className="text-[9px] text-muted-foreground flex-shrink-0 mt-0.5">
            {((task.endTime - task.startTime) / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      {expanded && task.children.map(cid => (
        <TaskNode key={cid} id={cid} tasks={tasks} depth={depth + 1} />
      ))}
    </div>
  )
}

export function AgentWorkspacePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { tasks, rootIds, clear } = useWorkspaceStore()
  const all = Object.values(tasks)
  const running = all.filter(t => t.status === 'running').length
  const done = all.filter(t => t.status === 'done').length
  const total = all.length

  // Group root tasks by parallelGroupId to show parallel execution
  const orderedGroups: { groupId: string; ids: string[] }[] = []
  for (const id of rootIds) {
    const gid = tasks[id]?.parallelGroupId || id
    const last = orderedGroups[orderedGroups.length - 1]
    if (last && last.groupId === gid) {
      last.ids.push(id)
    } else {
      orderedGroups.push({ groupId: gid, ids: [id] })
    }
  }

  return (
    <div className="h-full flex flex-col bg-background/95 backdrop-blur-sm border-r border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 flex-shrink-0">
        <Zap size={14} className="text-primary flex-shrink-0" />
        <span className="text-sm font-medium flex-1">{t('Agent Workspace')}</span>
        {total > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {running > 0 ? `${running} running` : `${done}/${total}`}
          </span>
        )}
        {total > 0 && (
          <button onClick={clear} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors">
            {t('Clear')}
          </button>
        )}
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <LayoutGrid size={28} className="text-muted-foreground/30" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('No active tasks')}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">{t('Tasks appear here when agents are working')}</p>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {/* Stats bar */}
            {total > 1 && (
              <div className="flex items-center gap-3 px-2 py-1.5 mb-2 bg-muted/30 rounded-lg">
                <span className="text-[10px] text-muted-foreground">{total} {t('tasks')}</span>
                {running > 0 && <span className="text-[10px] text-primary">{running} {t('running')}</span>}
                {done > 0 && <span className="text-[10px] text-green-500">{done} {t('done')}</span>}
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all duration-500"
                    style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Task groups */}
            {orderedGroups.map(({ groupId, ids }) => (
              <div key={groupId}>
                {ids.length > 1 && (
                  <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-primary/60">
                    <GitBranch size={9} />
                    <span>{t('Parallel')} ×{ids.length}</span>
                  </div>
                )}
                {ids.map(id => <TaskNode key={id} id={id} tasks={tasks} />)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
