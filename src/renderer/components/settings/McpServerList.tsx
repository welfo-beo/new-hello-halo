/**
 * MCP Server List Component
 * Displays list of configured MCP servers with expand/collapse editing
 */

import { useState, useEffect } from 'react'
import {
  Server,
  Plus,
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react'
import type { McpServerConfig, McpServersConfig } from '../../types'
import { useAppStore } from '../../stores/app.store'
import { api } from '../../api'
import { useTranslation } from '../../i18n'
import { ServerItem } from './McpServerItem'
import { AddServerDialog } from './McpAddServerDialog'
import { McpTemplates } from './McpTemplates'

interface McpServerListProps {
  servers: McpServersConfig
  onSave: (servers: McpServersConfig) => Promise<void>
}

export function McpServerList({ servers, onSave }: McpServerListProps) {
  const { t } = useTranslation()
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [localServers, setLocalServers] = useState<McpServersConfig>(servers)
  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  const { mcpStatus, mcpStatusTimestamp } = useAppStore()
  const statusMap = new Map(mcpStatus.map(s => [s.name, s.status]))

  useEffect(() => {
    setLocalServers(servers)
  }, [servers])

  const serverNames = Object.keys(localServers)
  const enabledCount = serverNames.filter(name => !localServers[name].disabled).length
  const connectedCount = serverNames.filter(name =>
    !localServers[name].disabled && statusMap.get(name) === 'connected'
  ).length

  const handleTestConnections = async () => {
    setIsTesting(true)
    setTestError(null)
    try {
      const result = await api.testMcpConnections()
      if (!result.success && result.error) {
        setTestError(result.error)
      }
    } catch (err) {
      setTestError((err as Error).message)
    } finally {
      setIsTesting(false)
    }
  }

  const handleToggleExpand = (name: string) => {
    if (isAddingNew) setIsAddingNew(false)
    setExpandedServer(prev => prev === name ? null : name)
  }

  const handleToggleDisabled = async (name: string) => {
    const config = localServers[name]
    const newConfig = { ...config, disabled: !config.disabled }
    const newServers = { ...localServers, [name]: newConfig }
    setLocalServers(newServers)
    await onSave(newServers)
  }

  const handleDelete = async (name: string) => {
    const { [name]: _, ...rest } = localServers
    setLocalServers(rest)
    await onSave(rest)
    if (expandedServer === name) {
      setExpandedServer(null)
    }
  }

  const handleSaveServer = async (oldName: string, newName: string, config: McpServerConfig) => {
    let newServers: McpServersConfig
    if (oldName !== newName) {
      const { [oldName]: _, ...rest } = localServers
      newServers = { ...rest, [newName]: config }
    } else {
      newServers = { ...localServers, [newName]: config }
    }
    setLocalServers(newServers)
    await onSave(newServers)
    if (oldName !== newName) {
      setExpandedServer(newName)
    }
  }

  const handleAddServer = async (name: string, config: McpServerConfig) => {
    const newServers = { ...localServers, [name]: config }
    setLocalServers(newServers)
    await onSave(newServers)
    setIsAddingNew(false)
    setExpandedServer(name)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-primary" />
          <h3 className="font-medium text-foreground">
            {t('MCP Servers')}
          </h3>
          {serverNames.length > 0 && (
            <>
              <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {enabledCount}/{serverNames.length}
              </span>
              {mcpStatusTimestamp && enabledCount > 0 && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  connectedCount === enabledCount
                    ? 'bg-green-500/10 text-green-500'
                    : connectedCount > 0
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  {connectedCount}/{enabledCount} {t('connected')}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {enabledCount > 0 && (
            <button
              onClick={handleTestConnections}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
              title={t('Test all MCP server connections')}
            >
              <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? t('Testing...') : t('Test connections')}
            </button>
          )}

          <button
            onClick={() => {
              setExpandedServer(null)
              setIsAddingNew(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Add')}
          </button>
        </div>
      </div>

      {/* Test error message */}
      {testError && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 bg-red-500/10 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{testError}</span>
          <button
            onClick={() => setTestError(null)}
            className="ml-auto p-0.5 hover:bg-red-500/20 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Description */}
      <p className="text-sm text-muted-foreground">
        {t('Configure MCP (Model Context Protocol) servers to extend AI capabilities. Format compatible with Cursor / Claude Desktop.')}
      </p>

      {/* Server list */}
      {serverNames.length === 0 && !isAddingNew ? (
        <div className="py-8 text-center">
          <Server className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">
            {t('No MCP servers configured yet')}
          </p>
          <button
            onClick={() => setIsAddingNew(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('Add first server')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {serverNames.map(name => (
            <ServerItem
              key={name}
              name={name}
              config={localServers[name]}
              status={statusMap.get(name) || null}
              isExpanded={expandedServer === name}
              onToggleExpand={() => handleToggleExpand(name)}
              onToggleDisabled={() => handleToggleDisabled(name)}
              onDelete={() => handleDelete(name)}
              onSave={(newName, config) => handleSaveServer(name, newName, config)}
            />
          ))}

          {isAddingNew && (
            <AddServerDialog
              onAdd={handleAddServer}
              onCancel={() => setIsAddingNew(false)}
            />
          )}
        </div>
      )}

      {/* MCP Templates */}
      <McpTemplates onAdd={handleAddServer} t={t} />
    </div>
  )
}
