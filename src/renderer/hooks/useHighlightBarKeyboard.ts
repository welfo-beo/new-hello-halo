/**
 * useHighlightBarKeyboard Hook
 *
 * Handles keyboard shortcuts when the search highlight bar is visible:
 * - Escape: Close highlight bar
 * - ArrowUp/Down: Navigate between results (debounced)
 * - Cmd+K / Ctrl+K: Re-open search panel
 *
 * Extracted from App.tsx to reduce component complexity.
 */

import { useEffect, useRef } from 'react'

interface SearchActions {
  hideHighlightBar: () => void
  goToPreviousResult: () => void
  goToNextResult: () => void
  openSearch: () => void
}

export function useHighlightBarKeyboard(
  isHighlightBarVisible: boolean,
  searchActions: SearchActions
) {
  const navigationDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingNavigationRef = useRef<(() => void) | null>(null)

  const debouncedNavigate = (callback: () => void) => {
    if (navigationDebounceTimerRef.current) {
      clearTimeout(navigationDebounceTimerRef.current)
    }
    pendingNavigationRef.current = callback
    navigationDebounceTimerRef.current = setTimeout(() => {
      console.log('[App] Executing debounced keyboard navigation')
      pendingNavigationRef.current?.()
      pendingNavigationRef.current = null
      navigationDebounceTimerRef.current = null
    }, 300)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isHighlightBarVisible) return

      const isMac = typeof navigator !== 'undefined' &&
        navigator.platform.toUpperCase().indexOf('MAC') >= 0

      if (e.key === 'Escape') {
        e.preventDefault()
        searchActions.hideHighlightBar()
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        debouncedNavigate(() => {
          console.log('[App] Keyboard: navigating to earlier result')
          searchActions.goToNextResult()
        })
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        debouncedNavigate(() => {
          console.log('[App] Keyboard: navigating to more recent result')
          searchActions.goToPreviousResult()
        })
        return
      }

      const metaKey = isMac ? e.metaKey : e.ctrlKey
      if (metaKey && e.key === 'k' && !e.shiftKey) {
        e.preventDefault()
        searchActions.openSearch()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isHighlightBarVisible, searchActions])
}
