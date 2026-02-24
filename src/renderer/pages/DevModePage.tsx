/**
 * Dev Mode Page - Dedicated development interface for Halo project
 * Agent catalog + task decomposition + workflow execution
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '../stores/app.store'
import { useSpaceStore } from '../stores/space.store'
import { useChatStore } from '../stores/chat.store'
import { api } from '../api'
import { Header } from '../components/layout/Header'
import { ArrowLeft, Search, Play, Users, GitBranch, Zap, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from '../i18n'
import { OMC_CATEGORIES, CATEGORY_ORDER, resolveSelectedOmcAgents } from './dev-mode-agents'
import type { OmcAgentInfo, OmcAgentDef } from './dev-mode-agents'

type LoadState = 'loading' | 'ready' | 'error'

// OMC workflow templates using OMC native agent names
const WORKFLOW_TEMPLATES = [
  {
    id: 'new-feature',
    label: 'New Feature',
    icon: Zap,
    rounds: [
      { agents: ['analyst', 'planner'], desc: 'Analyze + plan', parallel: true },
      { agents: ['executor', 'designer'], desc: 'Parallel implementation', parallel: true },
      { agents: ['code-reviewer'], desc: 'Review changes' }
    ]
  },
  {
    id: 'bug-fix',
    label: 'Bug Fix',
    icon: GitBranch,
    rounds: [
      { agents: ['debugger', 'explore'], desc: 'Investigate root cause', parallel: true },
      { agents: ['executor'], desc: 'Implement fix' },
      { agents: ['verifier'], desc: 'Verify fix' }
    ]
  },
  {
    id: 'code-review',
    label: 'Code Review',
    icon: Users,
    rounds: [
      { agents: ['code-reviewer', 'security-reviewer', 'quality-reviewer'], desc: 'Parallel review', parallel: true },
      { agents: ['critic'], desc: 'Synthesize report' }
    ]
  },
  {
    id: 'refactor',
    label: 'Refactoring',
    icon: GitBranch,
    rounds: [
      { agents: ['architect'], desc: 'Assess architecture' },
      { agents: ['code-simplifier'], desc: 'Execute changes' },
      { agents: ['verifier'], desc: 'Validate' }
    ]
  }
]

export function DevModePage() {
  const { t } = useTranslation()
  const { goBack } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER))
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)
  const [taskDescription, setTaskDescription] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [agentsLoadState, setAgentsLoadState] = useState<LoadState>('loading')
  const [defsLoadState, setDefsLoadState] = useState<LoadState>('loading')
  const [omcAgents, setOmcAgents] = useState<OmcAgentInfo[]>([])
  const [omcAgentDefs, setOmcAgentDefs] = useState<Record<string, OmcAgentDef>>({})

  const currentSpace = useSpaceStore(s => s.currentSpace)

  // Fetch OMC agents/defs from API.
  useEffect(() => {
    let isDisposed = false

    const loadOmcData = async () => {
      setAgentsLoadState('loading')
      setDefsLoadState('loading')
      setLoadError(null)

      try {
        const [agentsRes, defsRes] = await Promise.all([
          api.getOmcAgents(),
          api.getOmcAgentDefs()
        ])

        if (isDisposed) return

        if (agentsRes.success && agentsRes.data) {
          setOmcAgents(agentsRes.data as OmcAgentInfo[])
          setAgentsLoadState('ready')
        } else {
          setOmcAgents([])
          setAgentsLoadState('error')
        }

        if (defsRes.success && defsRes.data) {
          setOmcAgentDefs(defsRes.data as Record<string, OmcAgentDef>)
          setDefsLoadState('ready')
        } else {
          setOmcAgentDefs({})
          setDefsLoadState('error')
        }

        const errors: string[] = []
        if (!agentsRes.success) errors.push(agentsRes.error || 'Failed to load OMC agents.')
        if (!defsRes.success) errors.push(defsRes.error || 'Failed to load OMC agent definitions.')
        if (errors.length > 0) setLoadError(errors.join(' '))
      } catch (error) {
        if (isDisposed) return
        setAgentsLoadState('error')
        setDefsLoadState('error')
        setOmcAgents([])
        setOmcAgentDefs({})
        setLoadError((error as Error).message || 'Failed to load OMC data.')
      }
    }

    loadOmcData()
    return () => {
      isDisposed = true
    }
  }, [])

  const { unresolvedAgents } = useMemo(
    () => resolveSelectedOmcAgents(selectedAgents, omcAgentDefs),
    [selectedAgents, omcAgentDefs]
  )
  const defsReady = defsLoadState === 'ready'
  const hasUnresolvedAgents = unresolvedAgents.length > 0

  // OMC-style orchestration: build prompt + subagents, create conversation, send, navigate.
  const handleExecute = useCallback(async () => {
    setExecuteError(null)
    if (!taskDescription.trim() || selectedAgents.size === 0 || !currentSpace || isExecuting) return

    if (!defsReady) {
      setExecuteError(t('Agent definitions are still loading.'))
      return
    }

    const resolution = resolveSelectedOmcAgents(selectedAgents, omcAgentDefs)
    if (resolution.resolvedSubagents.length === 0 || resolution.unresolvedAgents.length > 0) {
      if (resolution.unresolvedAgents.length > 0) {
        setExecuteError(t('Some selected agents are unavailable: {{agents}}', { agents: resolution.unresolvedAgents.join(', ') }))
      } else {
        setExecuteError(t('No valid agents resolved from current selection.'))
      }
      return
    }

    setIsExecuting(true)
    try {
      // 1. Build orchestration prompt (task + workflow rounds)
      const wf = selectedWorkflow ? WORKFLOW_TEMPLATES.find(w => w.id === selectedWorkflow) : null
      let prompt = taskDescription
      if (wf) {
        const rounds = wf.rounds.map((r, i) =>
          `Round ${i + 1}${r.parallel ? ' (parallel)' : ''}: ${r.agents.length > 0 ? r.agents.join(' + ') : 'synthesize'} - ${r.desc}`
        ).join('\n')
        prompt += `\n\n<workflow>\n${rounds}\n</workflow>`
      }
      prompt += `\n\n<available-agents>\n${resolution.resolvedSubagents.map(a => `- ${a.name}: ${a.description}`).join('\n')}\n</available-agents>`
      prompt += '\n\nDelegate aggressively to the available agents. Parallelize independent tasks. Verify all work before completing.'

      // 2. Create conversation and send
      const spaceId = currentSpace.id
      useChatStore.getState().setCurrentSpace(spaceId)
      const conversation = await useChatStore.getState().createConversation(spaceId)
      if (!conversation) throw new Error('Failed to create conversation')

      await api.sendMessage({
        spaceId,
        conversationId: conversation.id,
        message: prompt,
        subagents: resolution.resolvedSubagents,
        effort: 'high'
      })

      // 3. Navigate to chat
      useChatStore.setState(state => {
        const sessions = new Map(state.sessions)
        sessions.set(conversation.id, {
          isGenerating: true,
          streamingContent: '',
          isStreaming: false,
          thoughts: [],
          isThinking: true,
          pendingToolApproval: null,
          error: null,
          errorType: null,
          compactInfo: null,
          textBlockVersion: 0,
          pendingQuestion: null
        })
        return { sessions }
      })
      useAppStore.getState().setView('space')
    } catch (error) {
      console.error('[DevMode] Execute failed:', error)
      setExecuteError((error as Error).message || t('Failed to launch workflow.'))
    } finally {
      setIsExecuting(false)
    }
  }, [taskDescription, selectedAgents, selectedWorkflow, currentSpace, isExecuting, defsReady, omcAgentDefs, t])

  // Group OMC agents by category, filtered by search
  const filteredCategories = useMemo(() => {
    const grouped: Record<string, { label: string; agents: OmcAgentInfo[] }> = {}
    for (const key of CATEGORY_ORDER) {
      const cat = OMC_CATEGORIES[key]
      if (cat) grouped[key] = { label: cat.label, agents: [] }
    }
    const q = searchQuery.toLowerCase().trim()
    for (const agent of omcAgents) {
      if (q && !agent.name.includes(q) && !agent.description.toLowerCase().includes(q)) continue
      const cat = grouped[agent.category]
      if (cat) cat.agents.push(agent)
    }
    for (const key of Object.keys(grouped)) {
      if (grouped[key].agents.length === 0) delete grouped[key]
    }
    return grouped
  }, [searchQuery, omcAgents])

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleAgent = (agent: string) => {
    setExecuteError(null)
    setSelectedAgents(prev => {
      const next = new Set(prev)
      next.has(agent) ? next.delete(agent) : next.add(agent)
      return next
    })
  }

  const applyWorkflow = (workflowId: string) => {
    setExecuteError(null)
    setSelectedWorkflow(workflowId)
    const wf = WORKFLOW_TEMPLATES.find(w => w.id === workflowId)
    if (wf) {
      const agents = new Set<string>()
      wf.rounds.forEach(r => r.agents.forEach(a => agents.add(a)))
      setSelectedAgents(agents)
    }
  }

  const canExecute = taskDescription.trim().length > 0 &&
    selectedAgents.size > 0 &&
    !isExecuting &&
    !!currentSpace &&
    defsReady &&
    !hasUnresolvedAgents

  return (
    <div className="h-full flex flex-col bg-background">
      <Header
        left={
          <>
            <button
              onClick={goBack}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-foreground">{t('Dev Mode')}</span>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              OMC | {omcAgents.length} {t('agents')}
            </span>
          </>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent Catalog */}
        <div className="w-72 border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('Search agents...')}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              {selectedAgents.size > 0 && `${selectedAgents.size} ${t('selected')}`}
            </div>
            {(agentsLoadState === 'loading' || defsLoadState === 'loading') && (
              <div className="mt-1 text-[10px] text-amber-500">{t('Loading OMC data...')}</div>
            )}
            {loadError && (
              <div className="mt-1 text-[10px] text-destructive">{loadError}</div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {Object.entries(filteredCategories).map(([key, cat]) => (
              <div key={key}>
                <button
                  onClick={() => toggleCategory(key)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors"
                >
                  {expandedCategories.has(key) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {cat.label}
                  <span className="ml-auto text-[10px] opacity-60">{cat.agents.length}</span>
                </button>
                {expandedCategories.has(key) && (
                  <div className="ml-4 space-y-0.5">
                    {cat.agents.map(agent => (
                      <button
                        key={agent.name}
                        onClick={() => toggleAgent(agent.name)}
                        title={agent.description}
                        className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                          selectedAgents.has(agent.name)
                            ? 'bg-primary/15 text-primary'
                            : 'text-foreground/80 hover:bg-accent'
                        }`}
                      >
                        <span>{agent.name}</span>
                        {agent.model && (
                          <span className="ml-1.5 text-[9px] opacity-50">{agent.model}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Task & Workflow */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Workflow Templates */}
          <div className="p-4 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground mb-2">{t('Workflow Templates')}</div>
            <div className="flex flex-wrap gap-2">
              {WORKFLOW_TEMPLATES.map(wf => {
                const Icon = wf.icon
                return (
                  <button
                    key={wf.id}
                    onClick={() => applyWorkflow(wf.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      selectedWorkflow === wf.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground/80 hover:bg-accent'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t(wf.label)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Workflow Detail */}
          {selectedWorkflow && (
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <div className="text-xs font-medium text-foreground mb-2">
                {t(WORKFLOW_TEMPLATES.find(w => w.id === selectedWorkflow)?.label || '')}
              </div>
              <div className="space-y-1.5">
                {WORKFLOW_TEMPLATES.find(w => w.id === selectedWorkflow)?.rounds.map((round, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground w-14 flex-shrink-0">
                      Round {i + 1}{round.parallel ? ' ||' : ''}
                    </span>
                    <span className="text-foreground/80">
                      {round.agents.length > 0 ? round.agents.join(' + ') : '-'} - {round.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task Input */}
          <div className="flex-1 flex flex-col p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">{t('Task Description')}</div>
            <textarea
              value={taskDescription}
              onChange={e => setTaskDescription(e.target.value)}
              placeholder={t('Describe the development task...')}
              className="flex-1 min-h-[120px] p-3 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {selectedAgents.size > 0 && (
                  <span>{t('Agents')}: {Array.from(selectedAgents).join(', ')}</span>
                )}
                {!defsReady && defsLoadState !== 'error' && (
                  <div className="text-amber-500 mt-1">{t('Agent definitions are still loading.')}</div>
                )}
                {hasUnresolvedAgents && (
                  <div className="text-destructive mt-1">
                    {t('Unresolved agents')}: {unresolvedAgents.join(', ')}
                  </div>
                )}
                {executeError && (
                  <div className="text-destructive mt-1">{executeError}</div>
                )}
              </div>
              <button
                onClick={handleExecute}
                disabled={!canExecute}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {t(isExecuting ? 'Launching...' : 'Execute')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
