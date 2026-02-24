/**		      	    				  	  	  	 		 		       	 	 	         	 	    					 
 * Halo - Main App Component
 */

import { useEffect, Suspense, lazy } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from './stores/app.store'
import { useChatStore } from './stores/chat.store'
import { useOnboardingStore } from './stores/onboarding.store'
import { initAIBrowserStoreListeners } from './stores/ai-browser.store'
import { initPerfStoreListeners } from './stores/perf.store'
import { useSpaceStore } from './stores/space.store'
import { useSearchStore } from './stores/search.store'
import { SplashScreen } from './components/splash/SplashScreen'
import { SectionErrorBoundary } from './components/ErrorBoundary'
import { SetupFlow } from './components/setup/SetupFlow'
import { GitBashSetup } from './components/setup/GitBashSetup'
import { SearchPanel } from './components/search/SearchPanel'
import { SearchHighlightBar } from './components/search/SearchHighlightBar'
import { OnboardingOverlay } from './components/onboarding'
import { UpdateNotification } from './components/updater/UpdateNotification'
import { api } from './api'
import type { HaloConfig } from './types'
import { hasAnyAISource } from './types'
import { useAgentEventListeners } from './hooks/useAgentEventListeners'
import { useHighlightBarKeyboard } from './hooks/useHighlightBarKeyboard'
import { useSearchResultNavigation } from './hooks/useSearchResultNavigation'

// ============================================================================
// Zustand Selectors — subscribe only to needed slices, not entire stores
// ============================================================================

// Lazy load heavy page components for better initial load performance
// These pages contain complex components (chat, markdown, code highlighting, etc.)
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
const SpacePage = lazy(() => import('./pages/SpacePage').then(m => ({ default: m.SpacePage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const DevModePage = lazy(() => import('./pages/DevModePage').then(m => ({ default: m.DevModePage })))

// Page loading fallback - minimal spinner that matches app style
function PageLoader() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  )
}

// Theme colors for titleBarOverlay
const THEME_COLORS = {
  light: { color: '#ffffff', symbolColor: '#1a1a1a' },
  dark: { color: '#0a0a0a', symbolColor: '#ffffff' }
}

// Apply theme to document and sync to localStorage (for anti-flash on reload)
function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement

  // Save to localStorage for anti-flash script
  try {
    localStorage.setItem('halo-theme', theme)
  } catch (e) { /* ignore */ }

  let isDark: boolean
  if (theme === 'system') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('light', !isDark)
  } else {
    isDark = theme === 'dark'
    root.classList.toggle('light', theme === 'light')
  }

  // Update titleBarOverlay colors (Windows/Linux only)
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light
  api.setTitleBarOverlay(colors).catch(() => {
    // Ignore errors - may not be supported on current platform
  })
}

export default function App() {
  // -- AppStore: only subscribe to reactive state (view, config)
  const { view, config } = useAppStore(useShallow(s => ({ view: s.view, config: s.config })))
  const initialize = useAppStore(s => s.initialize)
  const setMcpStatus = useAppStore(s => s.setMcpStatus)
  const setView = useAppStore(s => s.setView)
  const setConfig = useAppStore(s => s.setConfig)

  // -- ChatStore: only subscribe to reactive state (currentSpaceId)
  const currentSpaceId = useChatStore(s => s.currentSpaceId)
  const chatActions = useChatStore(useShallow(s => ({
    handleAgentMessage: s.handleAgentMessage,
    handleAgentToolCall: s.handleAgentToolCall,
    handleAgentToolResult: s.handleAgentToolResult,
    handleAgentError: s.handleAgentError,
    handleAgentComplete: s.handleAgentComplete,
    handleAgentThought: s.handleAgentThought,
    handleAgentThoughtDelta: s.handleAgentThoughtDelta,
    handleAgentCompact: s.handleAgentCompact,
    handleAskQuestion: s.handleAskQuestion,
    setChatCurrentSpace: s.setCurrentSpace,
    loadConversations: s.loadConversations,
    selectConversation: s.selectConversation,
  })))

  // -- OnboardingStore: action only (stable ref)
  const initializeOnboarding = useOnboardingStore(s => s.initialize)

  // -- SearchStore: subscribe to reactive state only
  const { isSearchOpen, isHighlightBarVisible } = useSearchStore(
    useShallow(s => ({ isSearchOpen: s.isSearchOpen, isHighlightBarVisible: s.isHighlightBarVisible }))
  )
  const searchActions = useSearchStore(useShallow(s => ({
    closeSearch: s.closeSearch,
    hideHighlightBar: s.hideHighlightBar,
    goToPreviousResult: s.goToPreviousResult,
    goToNextResult: s.goToNextResult,
    openSearch: s.openSearch,
  })))

  // -- SpaceStore: subscribe to reactive state only
  const { spaces, haloSpace } = useSpaceStore(useShallow(s => ({ spaces: s.spaces, haloSpace: s.haloSpace })))
  const setSpaceStoreCurrentSpace = useSpaceStore(s => s.setCurrentSpace)
  const refreshCurrentSpace = useSpaceStore(s => s.refreshCurrentSpace)

  // Initialize app on mount - wait for backend extended services to be ready
  // Uses Pull+Push pattern for reliable initialization:
  // - Pull: Query status immediately (handles HMR, error recovery - 0ms delay)
  // - Push: Listen for event (normal startup flow)
  // - Timeout: Fallback protection if something goes wrong
  useEffect(() => {
    let initialized = false
    const startTime = Date.now()
    console.log('[App] Mounted, initializing with Pull+Push pattern...')

    const doInit = async (trigger: 'query' | 'event' | 'timeout') => {
      if (initialized) return
      initialized = true

      const waitTime = Date.now() - startTime
      console.log(`[App] Starting initialization (trigger: ${trigger}, waited: ${waitTime}ms)`)

      await initialize()
      // Initialize onboarding after app config is loaded
      await initializeOnboarding()
    }

    // 1. Pull: Query current status immediately
    // This handles HMR reload and error recovery scenarios where event was already sent
    api.getBootstrapStatus().then(status => {
      if (status.extendedReady) {
        console.log('[App] Bootstrap status: already ready, initializing immediately')
        doInit('query')
      } else {
        console.log('[App] Bootstrap status: not ready, waiting for event...')
      }
    }).catch(err => {
      console.warn('[App] Failed to query bootstrap status:', err)
    })

    // 2. Push: Listen for extended services ready event from main process
    // This is the normal startup flow for fresh app launch
    const unsubscribe = api.onBootstrapExtendedReady((data) => {
      console.log('[App] Received bootstrap:extended-ready', data)
      doInit('event')
    })

    // 3. Timeout: Fallback protection if something goes wrong
    // Reduced to 5s since we now have Pull mechanism as primary fast path
    const fallbackTimeout = setTimeout(() => {
      if (!initialized) {
        console.warn('[App] Bootstrap timeout after 5000ms, force initializing...')
        doInit('timeout')
      }
    }, 5000)

    return () => {
      unsubscribe()
      clearTimeout(fallbackTimeout)
    }
  }, [initialize, initializeOnboarding])

  // Theme switching
  useEffect(() => {
    // Default to 'dark' before config loads, then use config value
    const theme = config?.appearance?.theme || 'dark'
    applyTheme(theme)

    // Listen for system theme changes when using 'system' mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [config?.appearance?.theme])

  // Connect WebSocket for remote mode
  useEffect(() => {
    if (api.isRemoteMode()) {
      console.log('[App] Remote mode detected, connecting WebSocket...')
      api.connectWebSocket()
    }
  }, [])

  // Initialize AI Browser IPC listeners for active view sync
  useEffect(() => {
    console.log('[App] Initializing AI Browser store listeners')
    initPerfStoreListeners()
    const cleanup = initAIBrowserStoreListeners()
    return cleanup
  }, [])

  // Register agent event listeners (global - handles events for all conversations)
  useAgentEventListeners(chatActions, setMcpStatus)

  // Handle search keyboard shortcuts (highlight bar: Esc, arrows, Cmd+K)
  useHighlightBarKeyboard(isHighlightBarVisible, searchActions)

  // Handle search result navigation from highlight bar
  useSearchResultNavigation(currentSpaceId, spaces, haloSpace, setSpaceStoreCurrentSpace, refreshCurrentSpace, chatActions)

  // Handle Git Bash setup completion
  const handleGitBashSetupComplete = async (installed: boolean) => {
    console.log('[App] Git Bash setup completed, installed:', installed)

    // Save skip preference if not installed
    if (!installed) {
      await api.setConfig({ gitBash: { skipped: true, installed: false, path: null } })
    }

    // Continue with normal initialization - sync config to store
    const response = await api.getConfig()
    if (response.success && response.data) {
      const loadedConfig = response.data as HaloConfig
      setConfig(loadedConfig)  // Sync config to store (was missing, causing empty apiKey in settings)
      // Show setup if first launch or no AI source configured
      if (loadedConfig.isFirstLaunch || !hasAnyAISource(loadedConfig.aiSources)) {
        setView('setup')
      } else {
        setView('home')
      }
    } else {
      setView('setup')
    }
  }

  // Render based on current view
  // Heavy pages (HomePage, SpacePage, SettingsPage) are lazy-loaded for better initial performance
  const renderView = () => {
    switch (view) {
      case 'splash':
        return <SplashScreen />
      case 'gitBashSetup':
        return <GitBashSetup onComplete={handleGitBashSetupComplete} />
      case 'setup':
        return <SetupFlow />
      case 'home':
        return (
          <Suspense fallback={<PageLoader />}>
            <SectionErrorBoundary><HomePage /></SectionErrorBoundary>
          </Suspense>
        )
      case 'space':
        return (
          <Suspense fallback={<PageLoader />}>
            <SectionErrorBoundary><SpacePage /></SectionErrorBoundary>
          </Suspense>
        )
      case 'settings':
        return (
          <Suspense fallback={<PageLoader />}>
            <SectionErrorBoundary><SettingsPage /></SectionErrorBoundary>
          </Suspense>
        )
      case 'devMode':
        return (
          <Suspense fallback={<PageLoader />}>
            <SectionErrorBoundary><DevModePage /></SectionErrorBoundary>
          </Suspense>
        )
      default:
        return <SplashScreen />
    }
  }

  return (
    <div className="h-full w-full overflow-hidden bg-background">
      {renderView()}
      {/* Search panel - full screen edit mode */}
      <SearchPanel isOpen={isSearchOpen} onClose={searchActions.closeSearch} />
      {/* Search highlight bar - floating navigation mode */}
      <SearchHighlightBar />
      {/* Onboarding overlay - renders on top of everything */}
      <OnboardingOverlay />
      {/* Update notification - shows when update is downloaded */}
      <UpdateNotification />
    </div>
  )
}
