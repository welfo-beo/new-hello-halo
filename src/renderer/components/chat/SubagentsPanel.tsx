import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Edit2, X, Check, Bot, Sparkles, ChevronDown, AlertCircle, GripVertical, Copy, Download, Upload, LayoutTemplate, GitBranch, Zap, CopyPlus, Power } from 'lucide-react'
import { useSubagentsStore, type SubagentDef, type SubagentsMode } from '../../stores/subagents.store'
import { useSpaceStore } from '../../stores/space.store'
import { useTranslation } from '../../i18n'
import { api } from '../../api'

type AgentForm = Omit<SubagentDef, 'id'>

const AGENT_TEMPLATES: AgentForm[] = [
  {
    name: 'code-reviewer',
    description: 'Expert code review specialist. Use for quality, security, and maintainability reviews.',
    prompt: 'You are a code review specialist. Identify security vulnerabilities, performance issues, and suggest specific improvements. Be thorough but concise.',
    tools: ['Read', 'Grep', 'Glob'],
    model: 'sonnet',
  },
  {
    name: 'test-runner',
    description: 'Runs and analyzes test suites. Use for test execution and coverage analysis.',
    prompt: 'You are a test execution specialist. Run tests, analyze output, identify failing tests, and suggest fixes.',
    tools: ['Bash', 'Read', 'Grep'],
    model: 'inherit',
  },
  {
    name: 'security-scanner',
    description: 'Security vulnerability scanner. Use for auditing code for security issues.',
    prompt: 'You are a security expert. Scan code for OWASP top 10 vulnerabilities, injection flaws, and insecure configurations. Report findings clearly.',
    tools: ['Read', 'Grep', 'Glob'],
    model: 'opus',
  },
  {
    name: 'doc-writer',
    description: 'Documentation writer. Use for generating or improving code documentation.',
    prompt: 'You are a technical writer. Write clear, concise documentation including JSDoc/docstrings, README sections, and inline comments.',
    tools: ['Read', 'Edit', 'Write', 'Glob'],
    model: 'haiku',
  },
  {
    name: 'refactor-agent',
    description: 'Code refactoring specialist. Use for improving code structure and readability.',
    prompt: 'You are a refactoring expert. Improve code structure, reduce duplication, apply design patterns, and maintain existing behavior.',
    tools: ['Read', 'Edit', 'Write', 'Grep', 'Glob'],
    model: 'sonnet',
  },
  {
    name: 'data-analyst',
    description: 'Data analysis specialist. Use for analyzing datasets, generating insights, and creating reports.',
    prompt: 'You are a data analysis expert. Analyze data files, identify patterns and anomalies, compute statistics, and present findings clearly.',
    tools: ['Read', 'Bash', 'Write'],
    model: 'sonnet',
  },
  {
    name: 'debugger',
    description: 'Bug investigation specialist. Use for tracing errors, analyzing stack traces, and finding root causes.',
    prompt: 'You are a debugging expert. Trace errors to their root cause, analyze logs and stack traces, reproduce issues, and propose targeted fixes.',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    model: 'inherit',
  },
  {
    name: 'api-designer',
    description: 'API design specialist. Use for designing REST/GraphQL APIs, writing OpenAPI specs, and reviewing contracts.',
    prompt: 'You are an API design expert. Design clean, consistent REST or GraphQL APIs, write OpenAPI/Swagger specs, and ensure backward compatibility.',
    tools: ['Read', 'Write', 'Glob'],
    model: 'sonnet',
  },
]

const TOOL_OPTIONS = ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob', 'Task']
const MODEL_OPTIONS: Array<{ value: NonNullable<SubagentDef['model']>; label: string }> = [
  { value: 'inherit', label: 'Same as main' },
  { value: 'haiku', label: 'Haiku' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
]
const EMPTY_FORM: AgentForm = { name: '', description: '', prompt: '', tools: undefined, model: 'inherit', skills: undefined }

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

function SkillPickerPortal({ anchorRef, skills, available, onToggle, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  skills: string[]
  available: string[]
  onToggle: (skill: string) => void
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
      const el = document.getElementById('skill-picker-portal')
      if (el && !el.contains(e.target as Node) && !anchorRef.current?.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [anchorRef, onClose])

  return createPortal(
    <div
      id="skill-picker-portal"
      style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
      className="p-2 bg-popover border border-border rounded-xl shadow-lg z-[9999] flex flex-wrap gap-1 min-w-[200px]"
    >
      {available.map(skill => (
        <button
          key={skill}
          onClick={() => onToggle(skill)}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            skills.includes(skill) ? 'bg-violet-500/15 text-violet-500' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          /{skill}
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
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [availableSkills, setAvailableSkills] = useState<string[]>([])
  const btnRef = useRef<HTMLButtonElement>(null)
  const skillBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    api.skillsList().then((r: any) => {
      if (r.success) setAvailableSkills((r.data as any[]).map(s => s.name))
    }).catch(() => {})
  }, [])

  const toggleTool = (tool: string) => {
    const current = form.tools ?? []
    const next = current.includes(tool) ? current.filter(t => t !== tool) : [...current, tool]
    setForm(f => ({ ...f, tools: next.length > 0 ? next : undefined }))
  }

  const toggleSkill = (skill: string) => {
    const current = form.skills ?? []
    const next = current.includes(skill) ? current.filter(s => s !== skill) : [...current, skill]
    setForm(f => ({ ...f, skills: next.length > 0 ? next : undefined }))
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
      {availableSkills.length > 0 && (
        <div className="relative">
          <button
            ref={skillBtnRef}
            onClick={() => setShowSkillPicker(v => !v)}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg flex items-center justify-between hover:bg-muted/50"
          >
            <span className="text-muted-foreground truncate">
              {form.skills?.length ? `Skills: ${form.skills.join(', ')}` : t('Skills: none')}
            </span>
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
          {showSkillPicker && (
            <SkillPickerPortal
              anchorRef={skillBtnRef}
              skills={form.skills ?? []}
              available={availableSkills}
              onToggle={toggleSkill}
              onClose={() => setShowSkillPicker(false)}
            />
          )}
        </div>
      )}
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

const MODEL_COLORS: Record<string, string> = {
  opus: 'bg-purple-500/15 text-purple-500',
  sonnet: 'bg-blue-500/15 text-blue-500',
  haiku: 'bg-emerald-500/15 text-emerald-500',
}

function AgentAvatar({ name }: { name: string }) {
  const letter = name.charAt(0).toUpperCase()
  // Generate a stable hue from the name
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
      style={{ background: `hsl(${hue}, 60%, 45%)` }}
    >
      {letter}
    </div>
  )
}

function AgentCard({ agent, onEdit, onRemove, onToggle, onDuplicate, onCopyTo, onDragStart, onDragEnd, onDragOver, onDrop, isDragging }: {
  agent: SubagentDef
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
  onDuplicate: () => void
  onCopyTo?: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  isDragging: boolean
}) {
  const isDisabled = agent.enabled === false
  const modelColor = agent.model && agent.model !== 'inherit' ? MODEL_COLORS[agent.model] ?? 'bg-muted text-muted-foreground' : null
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`p-2.5 bg-muted/20 rounded-xl border transition-colors group ${
        isDragging ? 'opacity-40 border-primary/40' : isDisabled ? 'border-border/20 opacity-50' : 'border-border/40 hover:border-border/70 hover:bg-muted/30'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="cursor-grab active:cursor-grabbing mt-0.5 text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0">
          <GripVertical size={14} />
        </div>
        <AgentAvatar name={agent.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-medium truncate ${isDisabled ? 'line-through text-muted-foreground' : ''}`}>{agent.name}</span>
            {modelColor && (
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md flex-shrink-0 ${modelColor}`}>
                {agent.model}
              </span>
            )}
            {isDisabled && <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded-md">off</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{agent.description}</p>
          {(agent.tools?.length || agent.skills?.length) ? (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {agent.tools?.map(tool => (
                <span key={tool} className="px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded-md font-medium">
                  {tool}
                </span>
              ))}
              {agent.skills?.map(skill => (
                <span key={skill} className="px-1.5 py-0.5 text-[10px] bg-violet-500/10 text-violet-500 rounded-md font-medium">
                  /{skill}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onToggle} title={isDisabled ? 'Enable' : 'Disable'} className={`p-1 rounded-md hover:bg-muted ${isDisabled ? 'text-muted-foreground' : 'text-green-500 hover:text-green-600'}`}>
            <Power size={13} />
          </button>
          <button onClick={onDuplicate} title="Duplicate" className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
            <CopyPlus size={13} />
          </button>
          {onCopyTo && (
            <button onClick={onCopyTo} className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
              <Copy size={13} />
            </button>
          )}
          <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
            <Edit2 size={13} />
          </button>
          <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function TemplatesPanel({ existingNames, onSelect, onClose }: {
  existingNames: string[]
  onSelect: (tpl: AgentForm) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{t('Templates')}</span>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">{t('Cancel')}</button>
      </div>
      {AGENT_TEMPLATES.map(tpl => {
        const taken = existingNames.includes(tpl.name)
        return (
          <button
            key={tpl.name}
            disabled={taken}
            onClick={() => !taken && onSelect(tpl)}
            className={`w-full text-left p-2.5 rounded-xl border transition-colors ${
              taken
                ? 'border-border/20 bg-muted/10 opacity-40 cursor-not-allowed'
                : 'border-border/40 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{tpl.name}</span>
              {tpl.model && tpl.model !== 'inherit' && (
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md ${MODEL_COLORS[tpl.model] ?? ''}`}>{tpl.model}</span>
              )}
              {taken && <span className="text-[10px] text-muted-foreground ml-auto">{t('Already added')}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tpl.description}</p>
          </button>
        )
      })}
    </div>
  )
}

interface SubagentsPanelProps {
  spaceId: string
  onClose: () => void
}

export function SubagentsPanel({ spaceId, onClose }: SubagentsPanelProps) {
  const { t } = useTranslation()
  const { setMode, addSubagent, updateSubagent, removeSubagent, toggleSubagent, duplicateSubagent, reorderSubagents, copySubagentsToSpace } = useSubagentsStore()
  const { mode, subagents } = useSubagentsStore(s => s.spaces[spaceId] ?? { mode: 'off' as SubagentsMode, subagents: [] })
  const allSpaces = useSpaceStore(s => s.spaces)
  const otherSpaces = allSpaces.filter(s => s.id !== spaceId)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showCopyTo, setShowCopyTo] = useState<string | null>(null) // agentId being copied
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const existingNames = subagents.map(a => a.name)

  const handleDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) {
      reorderSubagents(spaceId, dragIndex, toIndex)
    }
    setDragIndex(null)
  }

  const handleExport = () => {
    const data = JSON.stringify(subagents.map(({ id: _id, ...rest }) => rest), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subagents.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string)
          const agents: AgentForm[] = Array.isArray(parsed) ? parsed : [parsed]
          agents.forEach(a => {
            if (a.name && a.description && a.prompt && !existingNames.includes(a.name)) {
              addSubagent(spaceId, a)
            }
          })
        } catch { /* invalid json */ }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const MODES: Array<{ value: SubagentsMode; label: string; icon?: React.ReactNode }> = [
    { value: 'off', label: t('Off') },
    { value: 'manual', label: t('Manual') },
    { value: 'auto', label: t('AI Auto'), icon: <Sparkles size={11} /> },
  ]

  return (
    <div className="absolute bottom-full right-0 mb-2 w-[380px] max-w-[calc(100vw-2rem)]
      max-h-[560px] overflow-y-auto bg-popover border border-border rounded-2xl shadow-xl z-30 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 sticky top-0 bg-popover z-50">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-primary" />
          <span className="text-sm font-medium">{t('Subagents')}</span>
          {mode === 'manual' && subagents.length >= 2 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-primary/10 text-primary/70">
              <GitBranch size={9} />
              {t('×{{n}} parallel', { n: subagents.length })}
            </span>
          )}
          {mode === 'auto' && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-primary/10 text-primary/70">
              <Zap size={9} />
              {t('Auto')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {mode === 'manual' && subagents.length > 0 && (
            <>
              <button onClick={handleExport} title={t('Export')} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <Download size={13} />
              </button>
              <button onClick={handleImport} title={t('Import')} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <Upload size={13} />
              </button>
            </>
          )}
          {mode === 'manual' && subagents.length === 0 && (
            <button onClick={handleImport} title={t('Import')} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
              <Upload size={13} />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
            <X size={15} />
          </button>
        </div>
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

        {mode === 'off' && (
          <p className="text-xs text-muted-foreground px-1">
            {t('Enable Manual or AI Auto to run parallel agents on your tasks.')}
          </p>
        )}

        {mode === 'auto' && (
          <div className="space-y-2.5">
            <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg px-3 py-2 leading-relaxed">
              {t('Claude autonomously decides how many agents to spawn and what each one does — optimized for your task.')}
            </div>

            {/* Parallel execution diagram */}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={11} className="text-primary/70" />
                <span className="text-[11px] font-medium text-muted-foreground">{t('How it works')}</span>
              </div>

              {/* Step 1: single task in */}
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-primary">1</span>
                </div>
                <div className="flex-1 h-px bg-border/40" />
                <div className="px-2 py-1 rounded-md bg-background border border-border/50 text-[10px] text-muted-foreground">
                  {t('Your task')}
                </div>
              </div>

              {/* Step 2: fan-out to parallel agents */}
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[9px] font-bold text-primary">2</span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {['Agent A', 'Agent B', 'Agent C'].map((a, i) => (
                    <div key={a} className={`px-1.5 py-1.5 rounded-md border text-center text-[10px] font-medium ${
                      i === 0 ? 'border-blue-500/30 bg-blue-500/8 text-blue-400' :
                      i === 1 ? 'border-violet-500/30 bg-violet-500/8 text-violet-400' :
                      'border-emerald-500/30 bg-emerald-500/8 text-emerald-400'
                    }`}>
                      <GitBranch size={9} className="inline mr-0.5 opacity-70" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: synthesize */}
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-primary">3</span>
                </div>
                <div className="flex-1 h-px bg-border/40" />
                <div className="px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-[10px] text-primary font-medium">
                  {t('Synthesized result')}
                </div>
              </div>
            </div>

            {/* Decision rules */}
            <div className="space-y-1">
              {[
                { n: '2', desc: t('Separable concerns (e.g. frontend + backend)') },
                { n: '3', desc: t('Larger tasks (explore + test + config)') },
                { n: '4+', desc: t('Genuinely independent large workstreams') },
              ].map(row => (
                <div key={row.n} className="flex items-center gap-2 text-[10px]">
                  <span className="w-6 text-center font-bold text-primary/70 flex-shrink-0">{row.n}</span>
                  <span className="text-muted-foreground">{row.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <>
            {showTemplates ? (
              <TemplatesPanel
                existingNames={existingNames}
                onSelect={(tpl) => { addSubagent(spaceId, tpl); setShowTemplates(false) }}
                onClose={() => setShowTemplates(false)}
              />
            ) : subagents.length === 0 && !showAddForm ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Bot size={28} className="text-muted-foreground/30" />
                <div className="text-sm text-muted-foreground">{t('No agents defined yet')}</div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setShowTemplates(true)}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted/50 flex items-center gap-1.5"
                  >
                    <LayoutTemplate size={13} />
                    {t('From template')}
                  </button>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                  >
                    {t('Add first agent')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {subagents.map((agent, index) => (
                  <div key={agent.id}>
                    {editingId === agent.id ? (
                      <SubagentForm
                        initial={{ name: agent.name, description: agent.description, prompt: agent.prompt, tools: agent.tools, model: agent.model, skills: agent.skills, enabled: agent.enabled }}
                        existingNames={existingNames}
                        editingName={agent.name}
                        onSave={(a) => { updateSubagent(spaceId, agent.id, a); setEditingId(null) }}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : showCopyTo === agent.id ? (
                      <div className="p-2.5 bg-muted/20 rounded-xl border border-primary/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{t('Copy to space')}</span>
                          <button onClick={() => setShowCopyTo(null)} className="text-xs text-muted-foreground hover:text-foreground">{t('Cancel')}</button>
                        </div>
                        {otherSpaces.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t('No other spaces available')}</p>
                        ) : otherSpaces.map(sp => (
                          <button
                            key={sp.id}
                            onClick={() => { copySubagentsToSpace(spaceId, sp.id, [agent.id]); setShowCopyTo(null) }}
                            className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted/50 truncate"
                          >
                            {sp.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <AgentCard
                        agent={agent}
                        onEdit={() => setEditingId(agent.id)}
                        onRemove={() => { removeSubagent(spaceId, agent.id); setEditingId(null) }}
                        onToggle={() => toggleSubagent(spaceId, agent.id)}
                        onDuplicate={() => duplicateSubagent(spaceId, agent.id)}
                        onCopyTo={otherSpaces.length > 0 ? () => setShowCopyTo(agent.id) : undefined}
                        onDragStart={() => setDragIndex(index)}
                        onDragEnd={() => setDragIndex(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(index)}
                        isDragging={dragIndex === index}
                      />
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowTemplates(true)}
                      className="flex-none px-2.5 py-2 flex items-center gap-1.5 text-sm text-muted-foreground
                        border border-dashed border-border/60 rounded-xl hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <LayoutTemplate size={14} />
                    </button>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="flex-1 py-2 flex items-center justify-center gap-2 text-sm text-muted-foreground
                        border border-dashed border-border/60 rounded-xl hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <Plus size={14} />
                      {t('Add agent')}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
