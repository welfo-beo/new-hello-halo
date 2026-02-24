import { useState, useEffect, useCallback } from 'react'
import {
  Server,
  ChevronDown,
  ChevronRight,
  Trash2,
  Terminal,
  Globe,
  Radio,
  Check,
  X,
  Code,
  Settings2,
  AlertCircle,
  Loader2,
  Power,
  PowerOff,
  CircleDot,
  Circle,
  AlertTriangle,
  Clock,
  Plus
} from 'lucide-react'
import type { McpServerConfig, McpServerStatus } from '../../types'
import { validateMcpServerConfig } from '../../utils/mcpValidation'
import { useTranslation } from '../../i18n'

type EditMode = 'visual' | 'json'

function StatusIndicator({ status, t }: { status: McpServerStatus['status'] | null; t: (key: string) => string }) {
  if (!status) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground" title={t('Status unknown - available after starting conversation')}>
        <Circle className="w-3 h-3" />
      </span>
    )
  }

  switch (status) {
    case 'connected':
      return (
        <span className="flex items-center gap-1 text-xs text-green-500" title={t('Connected')}>
          <CircleDot className="w-3 h-3" />
        </span>
      )
    case 'failed':
      return (
        <span className="flex items-center gap-1 text-xs text-red-500" title={t('Connection failed')}>
          <AlertTriangle className="w-3 h-3" />
        </span>
      )
    case 'needs-auth':
      return (
        <span className="flex items-center gap-1 text-xs text-amber-500" title={t('Authentication required')}>
          <AlertCircle className="w-3 h-3" />
        </span>
      )
    case 'pending':
      return (
        <span className="flex items-center gap-1 text-xs text-blue-500" title={t('Connecting...')}>
          <Clock className="w-3 h-3" />
        </span>
      )
    default:
      return null
  }
}

function getServerTypeIcon(config: McpServerConfig) {
  const type = config.type || 'stdio'
  switch (type) {
    case 'stdio':
      return <Terminal className="w-4 h-4" />
    case 'http':
      return <Globe className="w-4 h-4" />
    case 'sse':
      return <Radio className="w-4 h-4" />
    default:
      return <Server className="w-4 h-4" />
  }
}

function getServerTypeLabelKey(config: McpServerConfig): string {
  const type = config.type || 'stdio'
  switch (type) {
    case 'stdio':
      return 'Command line'
    case 'http':
      return 'HTTP'
    case 'sse':
      return 'SSE'
    default:
      return type
  }
}

export function ServerItem({
  name,
  config,
  status,
  isExpanded,
  onToggleExpand,
  onToggleDisabled,
  onDelete,
  onSave
}: {
  name: string
  config: McpServerConfig
  status: McpServerStatus['status'] | null
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleDisabled: () => void
  onDelete: () => void
  onSave: (newName: string, newConfig: McpServerConfig) => Promise<void>
}) {
  const { t } = useTranslation()
  const [editMode, setEditMode] = useState<EditMode>('visual')
  const [editingName, setEditingName] = useState(name)
  const [editingConfig, setEditingConfig] = useState<McpServerConfig>(config)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (isExpanded) {
      setEditingName(name)
      setEditingConfig(config)
      setJsonText(JSON.stringify(config, null, 2))
      setJsonError(null)
      setHasChanges(false)
    }
  }, [isExpanded, name, config])

  const updateVisualField = useCallback((field: string, value: unknown) => {
    setEditingConfig(prev => {
      const updated = { ...prev, [field]: value }
      setHasChanges(true)
      setJsonText(JSON.stringify(updated, null, 2))
      return updated
    })
  }, [])

  const updateArgs = useCallback((index: number, value: string) => {
    setEditingConfig(prev => {
      if (!('command' in prev)) return prev
      const args = [...(prev.args || [])]
      args[index] = value
      const updated = { ...prev, args }
      setHasChanges(true)
      setJsonText(JSON.stringify(updated, null, 2))
      return updated
    })
  }, [])

  const addArg = useCallback(() => {
    setEditingConfig(prev => {
      if (!('command' in prev)) return prev
      const args = [...(prev.args || []), '']
      const updated = { ...prev, args }
      setHasChanges(true)
      setJsonText(JSON.stringify(updated, null, 2))
      return updated
    })
  }, [])

  const removeArg = useCallback((index: number) => {
    setEditingConfig(prev => {
      if (!('command' in prev)) return prev
      const args = (prev.args || []).filter((_, i) => i !== index)
      const updated = { ...prev, args }
      setHasChanges(true)
      setJsonText(JSON.stringify(updated, null, 2))
      return updated
    })
  }, [])

  const handleJsonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setJsonText(text)
    setHasChanges(true)
    try {
      const parsed = JSON.parse(text)
      const validationError = validateMcpServerConfig(parsed)
      if (validationError) {
        setJsonError(validationError)
      } else {
        setEditingConfig(parsed)
        setJsonError(null)
      }
    } catch (err) {
      setJsonError((err as Error).message)
    }
  }, [])

  const handleNameChange = useCallback((value: string) => {
    setEditingName(value)
    setHasChanges(true)
  }, [])

  const handleSave = async () => {
    if (jsonError) return
    const validationError = validateMcpServerConfig(editingConfig)
    if (validationError) {
      setJsonError(validationError)
      return
    }
    setIsSaving(true)
    try {
      await onSave(editingName, editingConfig)
      setHasChanges(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingName(name)
    setEditingConfig(config)
    setJsonText(JSON.stringify(config, null, 2))
    setJsonError(null)
    setHasChanges(false)
    onToggleExpand()
  }

  const serverType = editingConfig.type || 'stdio'
  const isDisabled = config.disabled === true

  return (
    <div className={`border rounded-lg overflow-hidden transition-opacity ${
      isDisabled ? 'border-border/50 opacity-60' : 'border-border'
    }`}>
      {/* Header row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
          isDisabled ? 'bg-muted/30 hover:bg-muted/50' : 'bg-secondary/50 hover:bg-secondary'
        }`}
        onClick={onToggleExpand}
      >
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!isDisabled && (
              <StatusIndicator status={status} t={t} />
            )}
            <span className={`font-medium truncate ${isDisabled ? 'text-muted-foreground' : 'text-foreground'}`}>
              {name}
            </span>
            {isDisabled && (
              <span className="text-xs font-normal text-muted-foreground/70 flex-shrink-0">{t('Disabled')}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 pl-5">
            {t(getServerTypeLabelKey(config))}
            {config.type !== 'stdio' && 'url' in config && (
              <span className="ml-1.5 opacity-70">• {config.url}</span>
            )}
            {(!config.type || config.type === 'stdio') && 'command' in config && (
              <span className="ml-1.5 opacity-70">• {config.command}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onToggleDisabled}
            className={`p-1.5 rounded transition-colors ${
              isDisabled
                ? 'text-muted-foreground hover:text-green-500 hover:bg-green-500/10'
                : 'text-green-500 hover:text-muted-foreground hover:bg-muted'
            }`}
            title={isDisabled ? t('Enable') : t('Disable')}
          >
            {isDisabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
            title={t('Delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded edit area */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* Mode toggle */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
            <div className="flex items-center gap-1 p-0.5 bg-secondary rounded-lg">
              <button
                onClick={() => setEditMode('visual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  editMode === 'visual'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                {t('Visual')}
              </button>
              <button
                onClick={() => setEditMode('json')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                  editMode === 'json'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>

            {hasChanges && (
              <span className="text-xs text-amber-500">
                {t('Unsaved changes')}
              </span>
            )}
          </div>

          {/* Edit content */}
          <div className="p-4">
            {editMode === 'visual' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    {t('Server name')}
                  </label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => handleNameChange(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                    placeholder="my-mcp-server"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    {t('Type')}
                  </label>
                  <select
                    value={serverType}
                    onChange={e => {
                      const newType = e.target.value as 'stdio' | 'http' | 'sse'
                      let newConfig: McpServerConfig
                      if (newType === 'stdio') {
                        newConfig = { type: 'stdio', command: '' }
                      } else if (newType === 'http') {
                        newConfig = { type: 'http', url: '' }
                      } else {
                        newConfig = { type: 'sse', url: '' }
                      }
                      setEditingConfig(newConfig)
                      setHasChanges(true)
                      setJsonText(JSON.stringify(newConfig, null, 2))
                    }}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                  >
                    <option value="stdio">{t('Command line (stdio)')}</option>
                    <option value="http">HTTP</option>
                    <option value="sse">SSE (Server-Sent Events)</option>
                  </select>
                </div>

                {serverType === 'stdio' && 'command' in editingConfig && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        {t('Command')}
                      </label>
                      <input
                        type="text"
                        value={(editingConfig as { command: string }).command}
                        onChange={e => updateVisualField('command', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm transition-colors"
                        placeholder="npx"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-1">
                        {t('Arguments')}
                      </label>
                      <div className="space-y-2">
                        {((editingConfig as { args?: string[] }).args || []).map((arg, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={arg}
                              onChange={e => updateArgs(index, e.target.value)}
                              className="flex-1 px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm transition-colors"
                              placeholder={t('Argument value')}
                            />
                            <button
                              onClick={() => removeArg(index)}
                              className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addArg}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          {t('Add argument')}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {(serverType === 'http' || serverType === 'sse') && 'url' in editingConfig && (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      URL
                    </label>
                    <input
                      type="text"
                      value={(editingConfig as { url: string }).url}
                      onChange={e => updateVisualField('url', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm transition-colors"
                      placeholder="https://api.example.com/mcp"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* JSON mode */
              <div>
                <textarea
                  value={jsonText}
                  onChange={handleJsonChange}
                  spellCheck={false}
                  className="w-full h-48 px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm resize-none transition-colors"
                  placeholder='{ "command": "npx", "args": ["-y", "@example/mcp"] }'
                />
                {jsonError && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="w-4 h-4" />
                    {jsonError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              {t('Cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!!jsonError || isSaving || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-lg transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('Saving...')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t('Save')}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
