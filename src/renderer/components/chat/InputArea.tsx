/**
 * Input Area - Enhanced message input with bottom toolbar
 *
 * Layout (following industry standard - Qwen, ChatGPT, Baidu):
 * ┌──────────────────────────────────────────────────────┐
 * │ [Image previews]                                     │
 * │ ┌──────────────────────────────────────────────────┐ │
 * │ │ Textarea                                         │ │
 * │ └──────────────────────────────────────────────────┘ │
 * │ [+] [⚛]─────────────────────────────────  [Send] │
 * │      Bottom toolbar: always visible, expandable     │
 * └──────────────────────────────────────────────────────┘
 *
 * Features:
 * - Auto-resize textarea
 * - Keyboard shortcuts (Enter to send, Shift+Enter newline)
 * - Image paste/drop support with compression
 * - Extended thinking mode toggle (theme-colored)
 * - Bottom toolbar for future extensibility
 */

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent, DragEvent } from 'react'
import { Plus, ImagePlus, Loader2, AlertCircle, Atom, Globe, Gauge, Bot, Wand2, Search, GitBranch } from 'lucide-react'
import { useOnboardingStore } from '../../stores/onboarding.store'
import { useAIBrowserStore } from '../../stores/ai-browser.store'
import { useSubagentsStore, type SubagentsMode } from '../../stores/subagents.store'
import { useSpaceStore } from '../../stores/space.store'
import { getOnboardingPrompt } from '../onboarding/onboardingData'
import { ImageAttachmentPreview } from './ImageAttachmentPreview'
import { SubagentsPanel } from './SubagentsPanel'
import { FileSearchPanel } from './FileSearchPanel'
import { GitPanel } from './GitPanel'
import { processImage, isValidImageType, formatFileSize } from '../../utils/imageProcessor'
import type { ImageAttachment } from '../../types'
import { useTranslation } from '../../i18n'
import { api } from '../../api'

type SkillItem = { name: string; description: string; content: string }

type ThinkingMode = 'disabled' | 'enabled' | 'adaptive'
type EffortLevel = 'max' | 'high' | 'medium' | 'low'

interface InputAreaProps {
  onSend: (content: string, images?: ImageAttachment[], thinkingMode?: ThinkingMode, effort?: EffortLevel) => void
  onStop: () => void
  isGenerating: boolean
  placeholder?: string
  isCompact?: boolean
}

// Image constraints
const MAX_IMAGE_SIZE = 20 * 1024 * 1024  // 20MB max per image (before compression)
const MAX_IMAGES = 10  // Max images per message

// Error message type
interface ImageError {
  id: string
  message: string
}

export function InputArea({ onSend, onStop, isGenerating, placeholder, isCompact = false }: InputAreaProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessingImages, setIsProcessingImages] = useState(false)
  const [imageError, setImageError] = useState<ImageError | null>(null)
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('disabled')
  const [effort, setEffort] = useState<EffortLevel>('high')
  const [showEffortMenu, setShowEffortMenu] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)  // Attachment menu visibility
  const [showSubagentsPanel, setShowSubagentsPanel] = useState(false)
  const [showFileSearch, setShowFileSearch] = useState(false)
  const [showGitPanel, setShowGitPanel] = useState(false)
  const [showSkillMenu, setShowSkillMenu] = useState(false)
  const [skillQuery, setSkillQuery] = useState('')
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillMenuIdx, setSkillMenuIdx] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const effortMenuRef = useRef<HTMLDivElement>(null)
  const subagentsPanelRef = useRef<HTMLDivElement>(null)
  const skillMenuRef = useRef<HTMLDivElement>(null)

  // AI Browser state
  const { enabled: aiBrowserEnabled, setEnabled: setAIBrowserEnabled } = useAIBrowserStore()

  // Subagents state (per-space)
  const spaceId = useSpaceStore(s => s.currentSpace?.id ?? '')
  const { mode, subagents } = useSubagentsStore(s => s.spaces[spaceId] ?? { mode: 'off' as SubagentsMode, subagents: [] })
  const subagentsActive = mode !== 'off'

  // Auto-clear error after 3 seconds
  useEffect(() => {
    if (imageError) {
      const timer = setTimeout(() => setImageError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [imageError])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false)
      }
      if (effortMenuRef.current && !effortMenuRef.current.contains(event.target as Node)) {
        setShowEffortMenu(false)
      }
      if (subagentsPanelRef.current && !subagentsPanelRef.current.contains(event.target as Node)) {
        setShowSubagentsPanel(false)
      }
      if (skillMenuRef.current && !skillMenuRef.current.contains(event.target as Node)) {
        setShowSkillMenu(false)
      }
    }

    if (showAttachMenu || showEffortMenu || showSubagentsPanel || showSkillMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAttachMenu, showEffortMenu, showSubagentsPanel, showSkillMenu])

  // Show error to user
  const showError = (message: string) => {
    setImageError({ id: `err-${Date.now()}`, message })
  }

  // Skill slash command detection
  const filteredSkills = skills.filter(s =>
    !skillQuery || s.name.toLowerCase().startsWith(skillQuery.toLowerCase())
  )

  const handleContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isOnboardingSendStep) return
    const val = e.target.value
    setContent(val)
    const pos = e.target.selectionStart ?? val.length
    const before = val.slice(0, pos)
    const m = before.match(/(^|\s)\/(\w*)$/)
    if (m) {
      setSkillQuery(m[2])
      setShowSkillMenu(true)
      setSkillMenuIdx(0)
      if (skills.length === 0) {
        try { setSkills(await api.skillsList()) } catch {}
      }
    } else {
      setShowSkillMenu(false)
    }
  }

  const applySkill = (skill: SkillItem) => {
    const pos = textareaRef.current?.selectionStart ?? content.length
    const before = content.slice(0, pos)
    const m = before.match(/(^|\s)(\/\w*)$/)
    if (m) {
      const slashStart = pos - m[2].length
      setContent(content.slice(0, slashStart) + skill.content + content.slice(pos))
    }
    setShowSkillMenu(false)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  // Onboarding state
  const { isActive: isOnboarding, currentStep } = useOnboardingStore()
  const isOnboardingSendStep = isOnboarding && currentStep === 'send-message'

  // In onboarding send step, show prefilled prompt
  const onboardingPrompt = getOnboardingPrompt(t)
  const displayContent = isOnboardingSendStep ? onboardingPrompt : content

  // Process file to ImageAttachment with professional compression
  const processFileWithCompression = async (file: File): Promise<ImageAttachment | null> => {
    // Validate type
    if (!isValidImageType(file)) {
      showError(t('Unsupported image format: {{type}}', { type: file.type || t('Unknown') }))
      return null
    }

    // Validate size (before compression)
    if (file.size > MAX_IMAGE_SIZE) {
      showError(t('Image too large ({{size}}), max 20MB', { size: formatFileSize(file.size) }))
      return null
    }

    try {
      // Use professional image processor for compression
      const processed = await processImage(file)

      return {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        mediaType: processed.mediaType,
        data: processed.data,
        name: file.name,
        size: processed.compressedSize
      }
    } catch (error) {
      console.error(`Failed to process image: ${file.name}`, error)
      showError(t('Failed to process image: {{name}}', { name: file.name }))
      return null
    }
  }

  // Add images (with limit check and loading state)
  const addImages = async (files: File[]) => {
    const remainingSlots = MAX_IMAGES - images.length
    if (remainingSlots <= 0) return

    const filesToProcess = files.slice(0, remainingSlots)

    // Show loading state during compression
    setIsProcessingImages(true)

    try {
      const newImages = await Promise.all(filesToProcess.map(processFileWithCompression))
      const validImages = newImages.filter((img): img is ImageAttachment => img !== null)

      if (validImages.length > 0) {
        setImages(prev => [...prev, ...validImages])
      }
    } finally {
      setIsProcessingImages(false)
    }
  }

  // Remove image
  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
  }

  // Handle paste event
  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          imageFiles.push(file)
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()  // Prevent default only if we're handling images
      await addImages(imageFiles)
    }
  }

  // Handle drag events
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter(file => isValidImageType(file))

    if (files.length > 0) {
      await addImages(files)
    }
  }

  // Handle file input change
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      await addImages(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle image button click (from attachment menu)
  const handleImageButtonClick = () => {
    setShowAttachMenu(false)
    fileInputRef.current?.click()
  }

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [displayContent])

  // Focus on mount
  useEffect(() => {
    if (!isGenerating && !isOnboardingSendStep) {
      textareaRef.current?.focus()
    }
  }, [isGenerating, isOnboardingSendStep])

  // Handle send
  const handleSend = () => {
    const textToSend = isOnboardingSendStep ? onboardingPrompt : content.trim()
    const hasContent = textToSend || images.length > 0

    if (hasContent && !isGenerating) {
      onSend(
        textToSend,
        images.length > 0 ? images : undefined,
        thinkingMode,
        effort !== 'high' ? effort : undefined  // Only pass if not default
      )

      if (!isOnboardingSendStep) {
        setContent('')
        setImages([])  // Clear images after send
        // Don't reset thinkingEnabled - user might want to keep it on
        // Reset height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
      }
    }
  }

  // Detect mobile device (touch + narrow screen)
  const isMobile = () => {
    return 'ontouchstart' in window && window.innerWidth < 768
  }

  // Handle key press
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Skill menu navigation
    if (showSkillMenu && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSkillMenuIdx(i => Math.min(i + 1, filteredSkills.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSkillMenuIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applySkill(filteredSkills[skillMenuIdx]); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowSkillMenu(false); return }
    }

    // Ignore key events during IME composition (Chinese/Japanese/Korean input)
    // This prevents Enter from sending the message while confirming IME candidates
    if (e.nativeEvent.isComposing) return

    // Mobile: Enter for newline, send via button only
    // PC: Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey && !isMobile()) {
      e.preventDefault()
      handleSend()
    }
    // Esc to stop
    if (e.key === 'Escape' && isGenerating) {
      e.preventDefault()
      onStop()
    }
  }

  // In onboarding mode, can always send (prefilled content)
  // Can send if has text OR has images (and not processing/generating)
  const canSend = isOnboardingSendStep || ((content.trim().length > 0 || images.length > 0) && !isGenerating && !isProcessingImages)
  const hasImages = images.length > 0

  return (
    <div className={`
      border-t border-border/50 bg-background/80 backdrop-blur-sm
      transition-[padding] duration-300 ease-out
      ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}
    `}>
      <div className={isCompact ? '' : 'max-w-3xl mx-auto'}>
        {/* Error toast notification */}
        {imageError && (
          <div className="mb-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20
            flex items-start gap-2 animate-fade-in">
            <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
            <span className="text-sm text-destructive flex-1">{imageError.message}</span>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Input container */}
        <div
          className={`
            relative flex flex-col rounded-2xl transition-all duration-200
            ${isFocused
              ? 'ring-1 ring-primary/30 bg-card shadow-sm'
              : 'bg-secondary/50 hover:bg-secondary/70'
            }
            ${isGenerating ? 'opacity-60' : ''}
            ${isDragOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Image preview area */}
          {hasImages && (
            <ImageAttachmentPreview
              images={images}
              onRemove={removeImage}
            />
          )}

          {/* Image processing indicator */}
          {isProcessingImages && (
            <div className="px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground border-b border-border/30">
              <Loader2 size={14} className="animate-spin" />
              <span>{t('Processing image...')}</span>
            </div>
          )}

          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center
              bg-primary/5 rounded-2xl border-2 border-dashed border-primary/30
              pointer-events-none z-10">
              <div className="flex flex-col items-center gap-2 text-primary/70">
                <ImagePlus size={24} />
                <span className="text-sm font-medium">{t('Drop to add images')}</span>
              </div>
            </div>
          )}

          {/* File Search Panel */}
          {showFileSearch && (
            <FileSearchPanel
              spaceId={spaceId}
              onInsert={(text) => setContent(prev => prev + (prev ? ' ' : '') + text)}
              onClose={() => setShowFileSearch(false)}
            />
          )}

          {/* Git Panel */}
          {showGitPanel && (
            <GitPanel
              spaceId={spaceId}
              onInsert={(text) => setContent(prev => prev + (prev ? '\n' : '') + text)}
              onClose={() => setShowGitPanel(false)}
            />
          )}

          {/* Skill slash command menu */}
          {showSkillMenu && filteredSkills.length > 0 && (
            <div ref={skillMenuRef} className="absolute bottom-full left-0 right-0 mb-1 mx-3 py-1
              bg-popover border border-border rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto">
              {filteredSkills.map((skill, i) => (
                <button
                  key={skill.name}
                  onMouseDown={(e) => { e.preventDefault(); applySkill(skill) }}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-left transition-colors
                    ${i === skillMenuIdx ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/50'}`}
                >
                  <Wand2 size={14} className="flex-shrink-0 text-muted-foreground" />
                  <span className="font-medium">/{skill.name}</span>
                  {skill.description && <span className="text-xs text-muted-foreground truncate">{skill.description}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Textarea area */}
          <div className="px-3 pt-3 pb-1">
            <textarea
              ref={textareaRef}
              value={displayContent}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder || t('Type a message, let Halo help you...')}
              disabled={isGenerating}
              readOnly={isOnboardingSendStep}
              rows={1}
              className={`w-full bg-transparent resize-none
                focus:outline-none text-foreground placeholder:text-muted-foreground/50
                disabled:cursor-not-allowed min-h-[24px]
                ${isOnboardingSendStep ? 'cursor-default' : ''}`}
              style={{ maxHeight: '200px' }}
            />
          </div>

          {/* Bottom toolbar - always visible, industry standard layout */}
          <InputToolbar
            isGenerating={isGenerating}
            isOnboarding={isOnboardingSendStep}
            isProcessingImages={isProcessingImages}
            thinkingMode={thinkingMode}
            onThinkingModeChange={(mode) => setThinkingMode(mode)}
            effort={effort}
            onEffortChange={(level) => { setEffort(level); setShowEffortMenu(false) }}
            showEffortMenu={showEffortMenu}
            onEffortMenuToggle={() => setShowEffortMenu(!showEffortMenu)}
            effortMenuRef={effortMenuRef}
            aiBrowserEnabled={aiBrowserEnabled}
            onAIBrowserToggle={() => setAIBrowserEnabled(!aiBrowserEnabled)}
            showAttachMenu={showAttachMenu}
            onAttachMenuToggle={() => setShowAttachMenu(!showAttachMenu)}
            onImageClick={handleImageButtonClick}
            imageCount={images.length}
            maxImages={MAX_IMAGES}
            attachMenuRef={attachMenuRef}
            subagentsActive={subagentsActive}
            subagentsMode={mode}
            subagentsCount={subagents.filter(a => a.enabled !== false).length}
            showSubagentsPanel={showSubagentsPanel}
            onSubagentsPanelToggle={() => setShowSubagentsPanel(!showSubagentsPanel)}
            subagentsPanelRef={subagentsPanelRef}
            spaceId={spaceId}
            showFileSearch={showFileSearch}
            onFileSearchToggle={() => setShowFileSearch(!showFileSearch)}
            showGitPanel={showGitPanel}
            onGitPanelToggle={() => setShowGitPanel(!showGitPanel)}
            canSend={canSend}
            onSend={handleSend}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Input Toolbar - Bottom action bar
 * Extracted as a separate component for maintainability and future extensibility
 *
 * Layout: [+attachment] ──────────────────── [⚛ thinking] [send]
 */
interface InputToolbarProps {
  isGenerating: boolean
  isOnboarding: boolean
  isProcessingImages: boolean
  thinkingMode: ThinkingMode
  onThinkingModeChange: (mode: ThinkingMode) => void
  effort: EffortLevel
  onEffortChange: (level: EffortLevel) => void
  showEffortMenu: boolean
  onEffortMenuToggle: () => void
  effortMenuRef: React.RefObject<HTMLDivElement | null>
  aiBrowserEnabled: boolean
  onAIBrowserToggle: () => void
  showAttachMenu: boolean
  onAttachMenuToggle: () => void
  onImageClick: () => void
  imageCount: number
  maxImages: number
  attachMenuRef: React.RefObject<HTMLDivElement | null>
  subagentsActive: boolean
  subagentsMode: SubagentsMode
  subagentsCount: number
  showSubagentsPanel: boolean
  onSubagentsPanelToggle: () => void
  subagentsPanelRef: React.RefObject<HTMLDivElement | null>
  spaceId: string
  showFileSearch: boolean
  onFileSearchToggle: () => void
  showGitPanel: boolean
  onGitPanelToggle: () => void
  canSend: boolean
  onSend: () => void
  onStop: () => void
}

function InputToolbar({
  isGenerating,
  isOnboarding,
  isProcessingImages,
  thinkingMode,
  onThinkingModeChange,
  effort,
  onEffortChange,
  showEffortMenu,
  onEffortMenuToggle,
  effortMenuRef,
  aiBrowserEnabled,
  onAIBrowserToggle,
  showAttachMenu,
  onAttachMenuToggle,
  onImageClick,
  imageCount,
  maxImages,
  attachMenuRef,
  subagentsActive,
  subagentsMode,
  subagentsCount,
  showSubagentsPanel,
  onSubagentsPanelToggle,
  subagentsPanelRef,
  spaceId,
  showFileSearch,
  onFileSearchToggle,
  showGitPanel,
  onGitPanelToggle,
  canSend,
  onSend,
  onStop
}: InputToolbarProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between px-2 pb-2 pt-1">
      {/* Left section: attachment button + thinking toggle */}
      <div className="flex items-center gap-1">
        {/* Attachment menu */}
        {!isGenerating && !isOnboarding && (
          <div className="relative" ref={attachMenuRef}>
            <button
              onClick={onAttachMenuToggle}
              disabled={isProcessingImages}
              className={`w-8 h-8 flex items-center justify-center rounded-lg
                transition-all duration-150
                ${showAttachMenu
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50'
                }
                ${isProcessingImages ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title={t('Add attachment')}
            >
              <Plus size={18} className={`transition-transform duration-200 ${showAttachMenu ? 'rotate-45' : ''}`} />
            </button>

            {/* Attachment menu dropdown */}
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 py-1.5 bg-popover border border-border
                rounded-xl shadow-lg min-w-[160px] z-20 animate-fade-in">
                <button
                  onClick={onImageClick}
                  disabled={imageCount >= maxImages}
                  className={`w-full px-3 py-2 flex items-center gap-3 text-sm
                    transition-colors duration-150
                    ${imageCount >= maxImages
                      ? 'text-muted-foreground/40 cursor-not-allowed'
                      : 'text-foreground hover:bg-muted/50'
                    }
                  `}
                >
                  <ImagePlus size={16} className="text-muted-foreground" />
                  <span>{t('Add image')}</span>
                  {imageCount > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {imageCount}/{maxImages}
                    </span>
                  )}
                </button>
                {/* Future extensibility: add more options here */}
              </div>
            )}
          </div>
        )}

        {/* AI Browser toggle */}
        {!isGenerating && !isOnboarding && (
          <button
            onClick={onAIBrowserToggle}
            className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg
              transition-colors duration-200 relative
              ${aiBrowserEnabled
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
              }
            `}
            title={aiBrowserEnabled ? t('AI Browser enabled (click to disable)') : t('Enable AI Browser')}
          >
            <Globe size={15} />
            <span className="text-xs">{t('Browser')}</span>
            {/* Active indicator dot */}
            {aiBrowserEnabled && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
            )}
          </button>
        )}

        {/* Thinking mode cycle: disabled -> enabled -> adaptive -> disabled */}
        {!isGenerating && !isOnboarding && (
          <button
            onClick={() => {
              const next: Record<ThinkingMode, ThinkingMode> = { disabled: 'enabled', enabled: 'adaptive', adaptive: 'disabled' }
              onThinkingModeChange(next[thinkingMode])
            }}
            className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg
              transition-colors duration-200
              ${thinkingMode !== 'disabled'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
              }
            `}
            title={thinkingMode === 'disabled' ? t('Enable Thinking') : thinkingMode === 'enabled' ? t('Switch to Adaptive') : t('Disable Thinking')}
          >
            <Atom size={15} />
            <span className="text-xs">
              {thinkingMode === 'disabled' ? t('Thinking') : thinkingMode === 'enabled' ? t('Thinking') : t('Adaptive')}
            </span>
            {thinkingMode !== 'disabled' && (
              <span className="text-[10px] opacity-70">
                {thinkingMode === 'enabled' ? 'ON' : 'AUTO'}
              </span>
            )}
          </button>
        )}

        {/* Effort level selector */}
        {!isGenerating && !isOnboarding && (
          <div className="relative" ref={effortMenuRef}>
            <button
              onClick={onEffortMenuToggle}
              className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg
                transition-colors duration-200
                ${effort !== 'high'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
                }
              `}
              title={t('Effort: {{level}}', { level: effort })}
            >
              <Gauge size={15} />
              <span className="text-xs capitalize">{effort}</span>
            </button>
            {showEffortMenu && (
              <div className="absolute bottom-full left-0 mb-2 py-1.5 bg-popover border border-border
                rounded-xl shadow-lg min-w-[140px] z-20 animate-fade-in">
                {(['low', 'medium', 'high', 'max'] as EffortLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => onEffortChange(level)}
                    className={`w-full px-3 py-1.5 flex items-center gap-2 text-sm transition-colors
                      ${effort === level ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/50'}
                    `}
                  >
                    <span className="capitalize">{level}</span>
                    {effort === level && <span className="ml-auto text-xs">&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subagents button */}
        {!isGenerating && !isOnboarding && (
          <div className="relative" ref={subagentsPanelRef}>
            <button
              onClick={onSubagentsPanelToggle}
              className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg transition-colors duration-200 relative
                ${subagentsActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
                }
              `}
              title={`${t('Subagents')} (${subagentsMode})`}
            >
              <Bot size={15} />
              <span className="text-xs">{t('Agents')}</span>
              {subagentsMode === 'manual' && subagentsCount > 0 && (
                <span className="text-[10px] opacity-70">{subagentsCount}</span>
              )}
              {subagentsMode === 'auto' && subagentsActive && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
              )}
              {subagentsMode === 'manual' && subagentsCount === 0 && subagentsActive && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-400 rounded-full" title={t('No agents defined')} />
              )}
            </button>
            {showSubagentsPanel && (
              <SubagentsPanel spaceId={spaceId} onClose={() => setShowSubagentsPanel(false)} />
            )}
          </div>
        )}

        {/* File search button */}
        {!isGenerating && !isOnboarding && (
          <button
            onClick={onFileSearchToggle}
            className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg transition-colors duration-200
              ${showFileSearch
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
              }
            `}
            title={t('Search files')}
          >
            <Search size={15} />
            <span className="text-xs">{t('Files')}</span>
          </button>
        )}

        {/* Git button */}
        {!isGenerating && !isOnboarding && (
          <button
            onClick={onGitPanelToggle}
            className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg transition-colors duration-200
              ${showGitPanel
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50'
              }
            `}
            title={t('Git')}
          >
            <GitBranch size={15} />
            <span className="text-xs">{t('Git')}</span>
          </button>
        )}
      </div>

      {/* Right section: action button only */}
      <div className="flex items-center">
        {isGenerating ? (
          <button
            onClick={onStop}
            className="w-8 h-8 flex items-center justify-center
              bg-destructive/10 text-destructive rounded-lg
              hover:bg-destructive/20 active:bg-destructive/30
              transition-all duration-150"
            title={t('Stop generation (Esc)')}
          >
            <div className="w-3 h-3 border-2 border-current rounded-sm" />
          </button>
        ) : (
          <button
            data-onboarding="send-button"
            onClick={onSend}
            disabled={!canSend}
            className={`
              w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200
              ${canSend
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
                : 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
              }
            `}
            title={thinkingMode !== 'disabled' ? t('Send (Thinking)') : t('Send')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
