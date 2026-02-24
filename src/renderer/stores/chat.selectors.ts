import { useChatStore } from './chat.store'
import type { SessionState } from './chat.store'
import type { TaskStatus, PulseItem } from '../types'

export function deriveTaskStatus(
  session: SessionState | undefined,
  hasUnseenCompletion: boolean
): TaskStatus {
  if (session) {
    if (session.pendingToolApproval || session.pendingQuestion?.status === 'active') return 'waiting'
    if (session.error && session.errorType !== 'interrupted') return 'error'
    if (session.isGenerating) return 'generating'
  }
  if (hasUnseenCompletion) return 'completed-unseen'
  return 'idle'
}

export function useIsGenerating(): boolean {
  return useChatStore((state) => {
    const spaceState = state.currentSpaceId
      ? state.spaceStates.get(state.currentSpaceId)
      : null
    if (!spaceState?.currentConversationId) return false
    const session = state.sessions.get(spaceState.currentConversationId)
    return session?.isGenerating ?? false
  })
}

export function useConversationTaskStatus(conversationId: string | undefined): TaskStatus {
  return useChatStore((state) => {
    if (!conversationId) return 'idle'
    const session = state.sessions.get(conversationId)
    const hasUnseen = state.unseenCompletions.has(conversationId)
    return deriveTaskStatus(session, hasUnseen)
  })
}

export function useAllConversationStatuses(): Map<string, TaskStatus> {
  return useChatStore(
    (state) => {
      const result = new Map<string, TaskStatus>()
      const spaceState = state.currentSpaceId
        ? state.spaceStates.get(state.currentSpaceId)
        : null
      if (!spaceState) return result

      for (const conv of spaceState.conversations) {
        const session = state.sessions.get(conv.id)
        const hasUnseen = state.unseenCompletions.has(conv.id)
        const status = deriveTaskStatus(session, hasUnseen)
        if (status !== 'idle') {
          result.set(conv.id, status)
        }
      }
      return result
    },
    (a, b) => {
      if (a.size !== b.size) return false
      for (const [id, status] of a) {
        if (b.get(id) !== status) return false
      }
      return true
    }
  )
}

export function usePulseItems(): PulseItem[] {
  return useChatStore(state => state._pulseItems)
}

export function usePulseCount(): number {
  return useChatStore(state => state._pulseCount)
}

export function usePulseBeaconStatus(): 'waiting' | 'completed' | 'generating' | 'error' | null {
  return useChatStore((state) => {
    let hasWaiting = false
    let hasCompleted = false
    let hasGenerating = false
    let hasError = false

    for (const [conversationId, session] of state.sessions) {
      const hasUnseen = state.unseenCompletions.has(conversationId)
      const status = deriveTaskStatus(session, hasUnseen)
      if (status === 'waiting') hasWaiting = true
      if (status === 'completed-unseen') hasCompleted = true
      if (status === 'generating') hasGenerating = true
      if (status === 'error') hasError = true
    }

    if (state.unseenCompletions.size > 0) hasCompleted = true

    if (hasWaiting) return 'waiting'
    if (hasCompleted) return 'completed'
    if (hasGenerating) return 'generating'
    if (hasError) return 'error'

    for (const [, ss] of state.spaceStates) {
      if (ss.conversations.some(c => c.starred)) return null
    }

    return null
  })
}
