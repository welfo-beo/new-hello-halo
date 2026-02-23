import { useState, useEffect } from 'react'
import { api } from '../../api'

export function MemorySection({ spaceDir }: { spaceDir?: string }) {
  const [scope, setScope] = useState<'global' | 'space'>('global')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.memoryRead(scope, spaceDir).then(r => {
      if (r.success) setContent(r.data as string || '')
    })
  }, [scope, spaceDir])

  const handleSave = async () => {
    setSaving(true)
    await api.memoryWrite(scope, content, spaceDir)
    setSaving(false)
  }

  return (
    <section id="memory" className="bg-card rounded-xl border border-border p-6">
      <h2 className="text-lg font-medium mb-4">Memory (CLAUDE.md)</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Instructions automatically injected into every conversation's system prompt.
      </p>
      <div className="flex gap-2 mb-3">
        {(['global', 'space'] as const).map(s => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-3 py-1 rounded text-sm ${scope === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
          >
            {s === 'global' ? 'Global (~/.halo/CLAUDE.md)' : 'Space (.halo/CLAUDE.md)'}
          </button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        className="w-full h-48 p-3 rounded-lg border border-border bg-background text-sm font-mono resize-y"
        placeholder="# Memory\n\nAdd instructions here..."
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </section>
  )
}
