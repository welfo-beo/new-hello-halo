import { useChatStore } from './chat.store'
import type { ChatState, SessionState, SpaceState } from './chat.store'
import type { TaskStatus, PulseItem, ConversationMeta } from '../types'
import { PULSE_READ_GRACE_PERIOD_MS } from '../types'
import { deriveTaskStatus } from './chat.selectors'

function _extractPulseFingerprint(sessions: Map<string, SessionState>): string {
  const parts: string[] = []
  for (const [id, s] of sessions) {
    if (s.isGenerating || s.pendingToolApproval || s.error || s.pendingQuestion?.status === 'active') {
      parts.push(`${id}:${s.isGenerating ? 1 : 0}${s.pendingToolApproval ? 1 : 0}${s.error && s.errorType !== 'interrupted' ? 1 : 0}${s.pendingQuestion?.status === 'active' ? 1 : 0}`)
    }
  }
  return parts.join('|')
}

function _extractStarredFingerprint(spaceStates: Map<string, SpaceState>): string {
  const parts: string[] = []
  for (const [, ss] of spaceStates) {
    for (const conv of ss.conversations) {
      if (conv.starred) {
        parts.push(`${conv.id}:${conv.title}:${conv.updatedAt}`)
      }
    }
  }
  return parts.join('|')
}

function _computePulseItems(state: ChatState): PulseItem[] {
  const items: PulseItem[] = []
  const addedIds = new Set<string>()
  const getSpaceName = (spaceId: string): string => spaceId === 'halo-temp' ? 'Halo' : spaceId

  // 1. Active sessions
  for (const [conversationId, session] of state.sessions) {
    const hasUnseen = state.unseenCompletions.has(conversationId)
    const status = deriveTaskStatus(session, hasUnseen)
    if (status === 'idle') continue
    let meta: ConversationMeta | undefined
    for (const [, ss] of state.spaceStates) {
      meta = ss.conversations.find(c => c.id === conversationId)
      if (meta) break
    }
    if (!meta) continue
    items.push({ conversationId, spaceId: meta.spaceId, spaceName: getSpaceName(meta.spaceId), title: meta.title, status, starred: !!meta.starred, updatedAt: meta.updatedAt })
    addedIds.add(conversationId)
  }

  // 2. Unseen completions
  for (const [conversationId, info] of state.unseenCompletions) {
    if (addedIds.has(conversationId)) continue
    let meta: ConversationMeta | undefined
    for (const [, ss] of state.spaceStates) {
      meta = ss.conversations.find(c => c.id === conversationId)
      if (meta) break
    }
    items.push({ conversationId, spaceId: info.spaceId, spaceName: getSpaceName(info.spaceId), title: meta?.title || info.title, status: 'completed-unseen', starred: !!meta?.starred, updatedAt: meta?.updatedAt || new Date().toISOString() })
    addedIds.add(conversationId)
  }

  // 3. Starred conversations
  for (const [, ss] of state.spaceStates) {
    for (const conv of ss.conversations) {
      if (!conv.starred || addedIds.has(conv.id)) continue
      items.push({ conversationId: conv.id, spaceId: conv.spaceId, spaceName: getSpaceName(conv.spaceId), title: conv.title, status: 'idle', starred: true, updatedAt: conv.updatedAt })
      addedIds.add(conv.id)
    }
  }

  // 4. Read items in grace period
  const now = Date.now()
  for (const [conversationId, info] of state.pulseReadAt) {
    if (addedIds.has(conversationId)) continue
    if (now - info.readAt >= PULSE_READ_GRACE_PERIOD_MS) continue
    items.push({ conversationId, spaceId: info.spaceId, spaceName: getSpaceName(info.spaceId), title: info.title, status: info.originalStatus, starred: false, updatedAt: new Date(info.readAt).toISOString(), readAt: info.readAt })
    addedIds.add(conversationId)
  }

  const priorityOrder: Record<TaskStatus, number> = { 'waiting': 0, 'generating': 1, 'completed-unseen': 2, 'error': 3, 'idle': 4 }
  items.sort((a, b) => {
    const pa = priorityOrder[a.status]
    const pb = priorityOrder[b.status]
    if (pa !== pb) return pa - pb
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
  return items
}

function _computePulseCount(state: ChatState): number {
  let count = 0
  const countedIds = new Set<string>()
  for (const [conversationId, session] of state.sessions) {
    const hasUnseen = state.unseenCompletions.has(conversationId)
    const status = deriveTaskStatus(session, hasUnseen)
    if (status !== 'idle') { count++; countedIds.add(conversationId) }
  }
  for (const [conversationId] of state.unseenCompletions) {
    if (!countedIds.has(conversationId)) { count++; countedIds.add(conversationId) }
  }
  for (const [, ss] of state.spaceStates) {
    for (const conv of ss.conversations) {
      if (conv.starred && !countedIds.has(conv.id)) { count++; countedIds.add(conv.id) }
    }
  }
  const now = Date.now()
  for (const [conversationId, info] of state.pulseReadAt) {
    if (!countedIds.has(conversationId) && now - info.readAt < PULSE_READ_GRACE_PERIOD_MS) { count++; countedIds.add(conversationId) }
  }
  return count
}

let _prevPulseFingerprint = ''
let _prevUnseenSize = 0
let _prevPulseReadAtSize = 0
let _prevStarredFingerprint = ''

export function initPulseSubscription() {
  useChatStore.subscribe((state) => {
    const sessionFingerprint = _extractPulseFingerprint(state.sessions)
    const unseenSize = state.unseenCompletions.size
    const pulseReadAtSize = state.pulseReadAt.size
    const starredFingerprint = _extractStarredFingerprint(state.spaceStates)

    if (
      sessionFingerprint === _prevPulseFingerprint &&
      unseenSize === _prevUnseenSize &&
      pulseReadAtSize === _prevPulseReadAtSize &&
      starredFingerprint === _prevStarredFingerprint
    ) return

    _prevPulseFingerprint = sessionFingerprint
    _prevUnseenSize = unseenSize
    _prevPulseReadAtSize = pulseReadAtSize
    _prevStarredFingerprint = starredFingerprint

    const newItems = _computePulseItems(state)
    const newCount = _computePulseCount(state)
    const currentItems = state._pulseItems
    const itemsChanged = newItems.length !== currentItems.length ||
      newItems.some((item, i) =>
        item.conversationId !== currentItems[i]?.conversationId ||
        item.status !== currentItems[i]?.status ||
        item.starred !== currentItems[i]?.starred ||
        item.title !== currentItems[i]?.title ||
        item.updatedAt !== currentItems[i]?.updatedAt ||
        item.readAt !== currentItems[i]?.readAt
      )

    if (itemsChanged || newCount !== state._pulseCount) {
      useChatStore.setState({ _pulseItems: newItems, _pulseCount: newCount })
    }
  })
}
