import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { McpServerConfig } from '../../types'

const MCP_TEMPLATES = [
  { name: 'filesystem', label: 'Filesystem', description: 'Read/write local files', config: { type: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'] } },
  { name: 'github', label: 'GitHub', description: 'GitHub repos, issues, PRs', config: { type: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' } } },
  { name: 'memory', label: 'Memory', description: 'Persistent key-value memory', config: { type: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] } },
  { name: 'fetch', label: 'Fetch', description: 'HTTP fetch web content', config: { type: 'stdio' as const, command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] } },
]

export function McpTemplates({ onAdd, t }: { onAdd: (name: string, config: McpServerConfig) => void; t: (k: string) => string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t border-border/50 pt-3">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
        {t('Templates')}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {MCP_TEMPLATES.map(tpl => (
            <button key={tpl.name} onClick={() => onAdd(tpl.name, tpl.config as McpServerConfig)}
              className="flex flex-col items-start gap-0.5 px-3 py-2 text-left border border-border rounded-lg hover:bg-muted/50 transition-colors">
              <span className="text-xs font-medium">{tpl.label}</span>
              <span className="text-[11px] text-muted-foreground">{tpl.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
