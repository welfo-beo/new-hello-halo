import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Edit2, X, Check, Bot, Sparkles, ChevronDown, AlertCircle } from 'lucide-react'
import { useSubagentsStore, type SubagentDef, type SubagentsMode } from '../../stores/subagents.store'
import { useTranslation } from '../../i18n'

type AgentForm = Omit<SubagentDef, 'id'>

const TOOL_OPTIONS = ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob', 'Task']
const MODEL_OPTIONS: Array<{ value: NonNullable<SubagentDef['model']>; label: string }> = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'haiku', label: 'Haiku' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
]
const EMPTY_FORM: AgentForm = { name: '', description: '', prompt: '', tools: undefined, model: 'inherit' }

interface SubagentFormProps {
  initial: AgentForm
  existingNames: string[]
  editingName?: string
  onSave: (agent: AgentForm) => void
  onCancel: () => void
}

function ToolPickerPortal({ anchorRef, tools, onToggle, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  tools: string[]
  onToggle: (tool: string) => void
  onClose: () => void
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [anchorRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('tool-picker-portal')
      if (el && !el.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [anchorRef, onClose])

  return createPortal(
    <div
      id="tool-picker-portal"
      style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
      className="p-2 bg-popover border border-border rounded-xl shadow-lg z-[9999] flex flex-wrap gap-1 min-w-[200px]"
    >
      {TOOL_OPTIONS.map(tool => (
        <button
          key={tool}
          onClick={() => onToggle(tool)}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            tools.includes(tool) ? 'bg-primary/15 text-primary' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          {tool}
        </button>
      ))}
    </div>,
    document.body
  )
}

function SubagentForm({ initial, existingNames, editingName, onSave, onCancel }: SubagentFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AgentForm>(initial)
  const [showToolPicker, setShowToolPicker] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const toggleTool = (tool: string) => {
    const current = form.tools ?? []
    const next = current.includes(tool) ? current.filter(t => t !== tool) : [...current, tool]
    setForm(f => ({ ...f, tools: next.length > 0 ? next : undefined }))
  }

  const isDuplicate = form.name.trim() !== editingName && existingNames.includes(form.name.trim())
  const canSave = form.name.trim() && form.description.trim() && form.prompt.trim() && !isDuplicate

  return (
    <div className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border/50">
      <div>
        <input
          className={`w-full px-3 py-1.5 text-sm bg-background border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40 ${isDuplicate ? 'border-destructive' : 'border-border'}`}
          placeholder={t('Agent name (e.g. code-reviewer)')}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value.replace(/\s+/g, '-').toLowerCase() }))}
        />
        {isDuplicate && (
          <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
            <AlertCircle size={11} />
            {t('Name already exists')}
          </div>
        )}
      </div>
      <input
        className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40"
        placeholder={t('Description: when should Claude use this agent?')}
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      />
      <textarea
        className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
        placeholder={t("System prompt: define the agent's role and behavior")}
        rows={3}
        value={form.prompt}
        onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
      />
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <button
            ref={btnRef}
            onClick={() => setShowToolPicker(v => !v)}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg flex items-center justify-between hover:bg-muted/50"
          >
            <span className="text-muted-foreground truncate">
              {form.tools?.length ? form.tools.join(', ') : t('Tools: inherit all')}
            </span>
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
          {showToolPicker && (
            <ToolPickerPortal
              anchorRef={btnRef}
              tools={form.tools ?? []}
              onToggle={toggleTool}
              onClose={() => setShowToolPicker(false)}
            />
          )}
        </div>
        <select
          className="px-2 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none"
          value={form.model ?? 'inherit'}
          onChange={e => setForm(f => ({ ...f, model: e.target.value as SubagentDef['model'] }))}
        >
          {MODEL_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          {t('Cancel')}
        </button>
        <button
          onClick={() => canSave && onSave(form)}
          disabled={!canSave}
          className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 ${
            canSave ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          <Check size={14} />
          {t('Save')}
        </button>
      </div>
    </div>
  )
}

interface SubagentsPanelProps {
  spaceId: string
  onClose: () => void
}

export function SubagentsPanel({ spaceId, onClose }: SubagentsPanelProps) {
  const { t } = useTranslation()
  const { setMode, addSubagent, updateSubagent, removeSubagent } = useSubagentsStore()
  const { mode, subagents } = useSubagentsStore(s => s.spaces[spaceId] ?? { mode: 'off' as SubagentsMode, subagents: [] })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const existingNames = subagents.map(a => a.name)

  const MODES: Array<{ value: SubagentsMode; label: string; icon?: React.ReactNode }> = [
    { value: 'off', label: t('Off') },
    { value: 'manual', label: t('Manual') },
    { value: 'auto', label: t('AI Auto'), icon: <Sparkles size={11} /> },
  ]

  return (
    <div className="absolute bottom-full right-0 mb-2 w-[380px] max-w-[calc(100vw-2rem)]
      max-h-[500px] overflow-y-auto bg-popover border border-border rounded-2xl shadow-xl z-30 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 sticky top-0 bg-popover z-50">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-primary" />
          <span className="text-sm font-medium">{t('Subagents')}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={15} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Mode selector */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => setMode(spaceId, m.value)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg transition-colors ${
                mode === m.value
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Mode description */}
        {mode === 'auto' && (
          <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
            {t('Claude will autonomously spawn a built-in general-purpose subagent when parallel work helps.')}
          </div>
        )}

        {/* Agent list (only shown in manual mode) */}
        {mode === 'manual' && (
          <>
            {subagents.length === 0 && !showAddForm ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Bot size={28} className="text-muted-foreground/30" />
                <div className="text-sm text-muted-foreground">{t('No agents defined yet')}</div>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  {t('Add first agent')}
                </button>
              </div>
            ) : (
              <>
                {subagents.map((agent) => (
                  <div key={agent.id}>
                    {editingId === agent.id ? (
                      <SubagentForm
                        initial={{ name: agent.name, description: agent.description, prompt: agent.prompt, tools: agent.tools, model: agent.model }}
                        existingNames={existingNames}
                        editingName={agent.name}
                        onSave={(a) => { updateSubagent(spaceId, agent.id, a); setEditingId(null) }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-xl border border-border/40 group">
                        <Bot size={14} className="text-primary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-medium truncate">{agent.name}</div>
                            {agent.model && agent.model !== 'inherit' && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded flex-shrink-0">{agent.model}</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{agent.description}</div>
                          {agent.tools && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {agent.tools.map(tool => (
                                <span key={tool} className="px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded">
                                  {tool}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingId(agent.id)} className="p-1 text-muted-foreground hover:text-foreground">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => { removeSubagent(spaceId, agent.id); setEditingId(null) }} className="p-1 text-muted-foreground hover:text-destructive">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {showAddForm ? (
                  <SubagentForm
                    initial={EMPTY_FORM}
                    existingNames={existingNames}
                    onSave={(a) => { addSubagent(spaceId, a); setShowAddForm(false) }}
                    onCancel={() => setShowAddForm(false)}
                  />
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2 flex items-center justify-center gap-2 text-sm text-muted-foreground
                      border border-dashed border-border/60 rounded-xl hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Plus size={14} />
                    {t('Add agent')}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
