import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../../api'
import { useTranslation } from '../../i18n'
import type { HooksConfig, HookEntry } from '../../types'

const EVENTS = ['PreToolUse', 'PostToolUse', 'Stop', 'Notification', 'SubagentStop'] as const
type HookEvent = typeof EVENTS[number]

export function HooksSection() {
  const { t } = useTranslation()
  const [hooks, setHooks] = useState<HooksConfig>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    api.hooksGet().then(r => { if (r.success) setHooks(r.data as HooksConfig || {}) })
  }, [])

  const addHook = (event: HookEvent) => {
    const updated = { ...hooks }
    if (!updated[event]) updated[event] = []
    updated[event] = [...updated[event]!, { matcher: '.*', hooks: [{ type: 'command' as const, command: '', timeout: 30 }] }]
    setHooks(updated)
  }

  const removeEntry = (event: HookEvent, idx: number) => {
    const updated = { ...hooks }
    updated[event] = updated[event]!.filter((_, i) => i !== idx)
    setHooks(updated)
  }

  const updateEntry = (event: HookEvent, idx: number, field: string, value: string) => {
    const updated = { ...hooks }
    const entries = [...(updated[event] || [])]
    if (field === 'matcher') {
      entries[idx] = { ...entries[idx], matcher: value }
    } else if (field === 'command') {
      const hooksCopy = [...entries[idx].hooks]
      hooksCopy[0] = { ...hooksCopy[0], command: value }
      entries[idx] = { ...entries[idx], hooks: hooksCopy }
    }
    updated[event] = entries
    setHooks(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const r = await api.hooksSet(hooks)
      setSaveMsg(r.success ? { ok: true, text: t('Saved') } : { ok: false, text: r.error || t('Save failed') })
    } catch (err) {
      console.error('[Hooks] Save failed:', err)
      setSaveMsg({ ok: false, text: t('Save failed') })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  return (
    <section id="hooks" className="bg-card rounded-xl border border-border p-6">
      <h2 className="text-lg font-medium mb-4">{t('Hooks')}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {t('Shell commands executed on agent tool events.')}
      </p>
      <div className="space-y-4">
        {EVENTS.map(event => (
          <div key={event}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{event}</span>
              <button onClick={() => addHook(event)} className="p-1 hover:bg-secondary rounded">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {(hooks[event] || []).map((entry, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center">
                <input
                  value={entry.matcher}
                  onChange={e => updateEntry(event, idx, 'matcher', e.target.value)}
                  placeholder={t('Tool matcher (regex)')}
                  className="w-32 px-2 py-1 text-xs border border-border rounded bg-background"
                />
                <input
                  value={entry.hooks[0]?.command || ''}
                  onChange={e => updateEntry(event, idx, 'command', e.target.value)}
                  placeholder={t('Shell command')}
                  className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
                />
                <button onClick={() => removeEntry(event, idx)} className="p-1 hover:bg-secondary rounded text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50"
        >
          {saving ? t('Saving...') : t('Save')}
        </button>
        {saveMsg && (
          <span className={`text-xs ${saveMsg.ok ? 'text-green-500' : 'text-destructive'}`}>
            {saveMsg.text}
          </span>
        )}
      </div>
    </section>
  )
}
