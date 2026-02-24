/**
 * useAgentEventListeners Hook
 *
 * Registers global agent event listeners (IPC) for all conversations.
 * Extracted from App.tsx to reduce component complexity.
 */

import { useEffect } from 'react'
import { api } from '../api'
import { useWorkspaceStore } from '../stores/agent-workspace.store'
import type { AgentEventBase, Thought, ToolCall, AgentErrorType, Question } from '../types'

interface ChatActions {
  handleAgentMessage: (data: AgentEventBase & { content: string; isComplete: boolean }) => void
  handleAgentToolCall: (data: AgentEventBase & ToolCall) => void
  handleAgentToolResult: (data: AgentEventBase & { toolId: string; result: string; isError: boolean }) => void
  handleAgentError: (data: AgentEventBase & { error: string; errorType?: AgentErrorType }) => void
  handleAgentComplete: (data: AgentEventBase) => void
  handleAgentThought: (data: AgentEventBase & { thought: Thought }) => void
  handleAgentThoughtDelta: (data: any) => void
  handleAgentCompact: (data: AgentEventBase & { trigger: 'manual' | 'auto'; preTokens: number }) => void
  handleAskQuestion: (data: AgentEventBase & { id: string; questions: Question[] }) => void
}

export function useAgentEventListeners(
  chatActions: ChatActions,
  setMcpStatus: (servers: any, timestamp: number) => void
) {
  useEffect(() => {
    console.log('[App] Registering agent event listeners')

    const unsubThought = api.onAgentThought((data) => {
      console.log('[App] Received agent:thought event:', data)
      chatActions.handleAgentThought(data as AgentEventBase & { thought: Thought })
    })

    const unsubThoughtDelta = api.onAgentThoughtDelta((data) => {
      chatActions.handleAgentThoughtDelta(data as AgentEventBase & {
        thoughtId: string
        delta?: string
        content?: string
        toolInput?: Record<string, unknown>
        isComplete?: boolean
        isReady?: boolean
        isToolInput?: boolean
      })
    })

    const unsubMessage = api.onAgentMessage((data) => {
      chatActions.handleAgentMessage(data as AgentEventBase & { content: string; isComplete: boolean })
    })

    const unsubToolCall = api.onAgentToolCall((data) => {
      console.log('[App] Received agent:tool-call event:', data)
      const d = data as AgentEventBase & ToolCall
      chatActions.handleAgentToolCall(d)
      useWorkspaceStore.getState().onToolCall(d.id || String(Date.now()), d.name, (d.input || {}) as Record<string, unknown>)
    })

    const unsubToolResult = api.onAgentToolResult((data) => {
      console.log('[App] Received agent:tool-result event:', data)
      const d = data as AgentEventBase & { toolId: string; result: string; isError: boolean }
      chatActions.handleAgentToolResult(d)
      useWorkspaceStore.getState().onToolResult(d.toolId, d.isError)
    })

    const unsubError = api.onAgentError((data) => {
      console.log('[App] Received agent:error event:', data)
      chatActions.handleAgentError(data as AgentEventBase & { error: string; errorType?: AgentErrorType })
    })

    const unsubComplete = api.onAgentComplete((data) => {
      console.log('[App] Received agent:complete event:', data)
      chatActions.handleAgentComplete(data as AgentEventBase)
      useWorkspaceStore.getState().onComplete()
    })

    const unsubCompact = api.onAgentCompact((data) => {
      console.log('[App] Received agent:compact event:', data)
      chatActions.handleAgentCompact(data as AgentEventBase & { trigger: 'manual' | 'auto'; preTokens: number })
    })

    const unsubAskQuestion = api.onAgentAskQuestion((data) => {
      console.log('[App] Received agent:ask-question event:', data)
      chatActions.handleAskQuestion(data as AgentEventBase & { id: string; questions: Question[] })
    })

    const unsubMcpStatus = api.onAgentMcpStatus((data) => {
      console.log('[App] Received agent:mcp-status event:', data)
      const event = data as { servers: Array<{ name: string; status: string }>; timestamp: number }
      if (event.servers) {
        setMcpStatus(event.servers as any, event.timestamp)
      }
    })

    return () => {
      unsubThought()
      unsubThoughtDelta()
      unsubMessage()
      unsubToolCall()
      unsubToolResult()
      unsubError()
      unsubComplete()
      unsubCompact()
      unsubAskQuestion()
      unsubMcpStatus()
    }
  }, [chatActions, setMcpStatus])
}
