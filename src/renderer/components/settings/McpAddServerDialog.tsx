import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  X,
  Settings2,
  Code,
  AlertCircle
} from 'lucide-react'
import type { McpServerConfig } from '../../types'
import { validateMcpServerConfig } from '../../utils/mcpValidation'
import { useTranslation } from '../../i18n'

type EditMode = 'visual' | 'json'

export function AddServerDialog({
  onAdd,
  onCancel
}: {
  onAdd: (name: string, config: McpServerConfig) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [editMode, setEditMode] = useState<EditMode>('visual')
  const [name, setName] = useState('')
  const [serverType, setServerType] = useState<'stdio' | 'http' | 'sse'>('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState<string[]>([])
  const [url, setUrl] = useState('')
  const [jsonText, setJsonText] = useState('{\n  "command": "npx",\n  "args": ["-y", "@example/mcp-server"]\n}')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const buildConfigFromVisual = useCallback((): McpServerConfig => {
    if (serverType === 'stdio') {
      return { command, args: args.filter(a => a.trim()) }
    } else if (serverType === 'http') {
      return { type: 'http', url }
    } else {
      return { type: 'sse', url }
    }
  }, [serverType, command, args, url])

  useEffect(() => {
    if (editMode === 'visual') {
      const config = buildConfigFromVisual()
      setJsonText(JSON.stringify(config, null, 2))
    }
  }, [editMode, buildConfigFromVisual])

  const handleJsonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setJsonText(text)
    try {
      const parsed = JSON.parse(text)
      const validationError = validateMcpServerConfig(parsed)
      if (validationError) {
        setJsonError(validationError)
      } else {
        if ('command' in parsed) {
          setServerType('stdio')
          setCommand(parsed.command || '')
          setArgs(parsed.args || [])
        } else if (parsed.type === 'http') {
          setServerType('http')
          setUrl(parsed.url || '')
        } else if (parsed.type === 'sse') {
          setServerType('sse')
          setUrl(parsed.url || '')
        }
        setJsonError(null)
      }
    } catch (err) {
      setJsonError((err as Error).message)
    }
  }, [])

  const handleSubmit = () => {
    if (!name.trim()) return
    if (editMode === 'json') {
      try {
        const parsed = JSON.parse(jsonText)
        const validationError = validateMcpServerConfig(parsed)
        if (validationError) {
          setJsonError(validationError)
          return
        }
        onAdd(name.trim(), parsed)
      } catch (err) {
        setJsonError((err as Error).message)
        return
      }
    } else {
      onAdd(name.trim(), buildConfigFromVisual())
    }
  }

  const addArg = () => setArgs([...args, ''])
  const updateArg = (index: number, value: string) => {
    const newArgs = [...args]
    newArgs[index] = value
    setArgs(newArgs)
  }
  const removeArg = (index: number) => setArgs(args.filter((_, i) => i !== index))

  const isValidVisual = name.trim() && (
    (serverType === 'stdio' && command.trim()) ||
    ((serverType === 'http' || serverType === 'sse') && url.trim())
  )
  const isValidJson = name.trim() && !jsonError && jsonText.trim()
  const isValid = editMode === 'visual' ? isValidVisual : isValidJson

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Mode toggle */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <h4 className="font-medium text-foreground text-sm">
          {t('Add new server')}
        </h4>
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
      </div>

      <div className="p-4">
        {editMode === 'visual' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('Server name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                placeholder="my-mcp-server"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('Type')}
              </label>
              <select
                value={serverType}
                onChange={e => setServerType(e.target.value as 'stdio' | 'http' | 'sse')}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
              >
                <option value="stdio">{t('Command line (stdio)')}</option>
                <option value="http">HTTP</option>
                <option value="sse">SSE (Server-Sent Events)</option>
              </select>
            </div>

            {serverType === 'stdio' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    {t('Command')}
                  </label>
                  <input
                    type="text"
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm transition-colors"
                    placeholder="npx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    {t('Arguments')}
                  </label>
                  <div className="space-y-2">
                    {args.map((arg, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={arg}
                          onChange={e => updateArg(index, e.target.value)}
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

            {(serverType === 'http' || serverType === 'sse') && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm transition-colors"
                  placeholder="https://api.example.com/mcp"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('Server name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                placeholder="my-mcp-server"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('Configuration (JSON)')}
              </label>
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
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
        >
          {t('Cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('Add')}
        </button>
      </div>
    </div>
  )
}
