/**
 * useSearchResultNavigation Hook
 *
 * Handles the complete navigation flow when a search result is selected
 * (from highlight bar clicks or keyboard navigation):
 * 1. Switch space if needed
 * 2. Load conversations
 * 3. Select conversation
 * 4. Dispatch navigate-to-message event for ChatView
 *
 * Extracted from App.tsx to reduce component complexity.
 */

import { useEffect } from 'react'

interface Space {
  id: string
  name: string
  [key: string]: any
}

interface ChatActions {
  setChatCurrentSpace: (spaceId: string) => void
  loadConversations: (spaceId: string) => Promise<any>
  selectConversation: (conversationId: string) => Promise<any>
}

export function useSearchResultNavigation(
  currentSpaceId: string | null,
  spaces: Space[],
  haloSpace: Space | null,
  setSpaceStoreCurrentSpace: (space: Space) => void,
  refreshCurrentSpace: () => void,
  chatActions: ChatActions
) {
  useEffect(() => {
    const handleNavigateToResult = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        messageId: string
        spaceId: string
        conversationId: string
        query: string
        resultIndex: number
      }>

      const { messageId, spaceId, conversationId, query } = customEvent.detail

      console.log(`[App] search:navigate-to-result event - space=${spaceId}, conv=${conversationId}, msg=${messageId}`)

      try {
        // Step 1: If switching spaces, update both stores
        if (spaceId !== currentSpaceId) {
          console.log(`[App] Switching to space: ${spaceId}`)

          let targetSpace = null
          if (spaceId === 'halo-temp' && haloSpace) {
            targetSpace = haloSpace
          } else {
            targetSpace = spaces.find(s => s.id === spaceId)
          }

          if (!targetSpace) {
            console.error(`[App] Space not found: ${spaceId}`)
            return
          }

          console.log(`[App] Updating space to: ${targetSpace.name}`)
          setSpaceStoreCurrentSpace(targetSpace)
          refreshCurrentSpace()

          chatActions.setChatCurrentSpace(spaceId)

          await new Promise(resolve => setTimeout(resolve, 50))
        }

        // Step 2: Load conversations if needed
        console.log(`[App] Loading conversations for space: ${spaceId}`)
        await chatActions.loadConversations(spaceId)

        // Step 3: Select conversation
        console.log(`[App] Selecting conversation: ${conversationId}`)
        await chatActions.selectConversation(conversationId)

        // Step 4: Dispatch navigation event for ChatView
        setTimeout(() => {
          console.log(`[App] Dispatching navigate-to-message for: ${messageId}`)
          const navEvent = new CustomEvent('search:navigate-to-message', {
            detail: { messageId, query }
          })
          window.dispatchEvent(navEvent)
        }, 300)
      } catch (error) {
        console.error(`[App] Error navigating to result:`, error)
      }
    }

    window.addEventListener('search:navigate-to-result', handleNavigateToResult)
    return () => window.removeEventListener('search:navigate-to-result', handleNavigateToResult)
  }, [currentSpaceId, spaces, haloSpace, setSpaceStoreCurrentSpace, refreshCurrentSpace, chatActions])
}
