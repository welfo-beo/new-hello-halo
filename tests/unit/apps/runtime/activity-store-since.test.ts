/**
 * Unit tests for apps/runtime/store — getEntriesForApp since filtering
 *
 * Bugs covered:
 * - Bug 4: The 'since' option returns entries OLDER than the timestamp
 *          (SQL uses `ts < ?`) instead of entries NEWER than the timestamp.
 *          The name "since" implies "entries at/after this time".
 * - Bug 5: When both `type` and `since` options are provided, `since` is
 *          silently ignored (only the `type` branch is taken).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { createDatabaseManager } from '../../../../src/main/platform/store/database-manager'
import type { DatabaseManager } from '../../../../src/main/platform/store/types'
import { ActivityStore } from '../../../../src/main/apps/runtime/store'
import {
  MIGRATION_NAMESPACE as RUNTIME_MIGRATION_NS,
  migrations as runtimeMigrations,
} from '../../../../src/main/apps/runtime/migrations'
import {
  MIGRATION_NAMESPACE as MANAGER_MIGRATION_NS,
  migrations as managerMigrations,
} from '../../../../src/main/apps/manager/migrations'

describe('ActivityStore.getEntriesForApp(since)', () => {
  let dbManager: DatabaseManager
  let store: ActivityStore
  let appId: string
  let runId: string

  beforeEach(() => {
    dbManager = createDatabaseManager(':memory:')
    const db = dbManager.getAppDatabase()
    dbManager.runMigrations(db, MANAGER_MIGRATION_NS, managerMigrations)
    dbManager.runMigrations(db, RUNTIME_MIGRATION_NS, runtimeMigrations)
    store = new ActivityStore(db)

    appId = randomUUID()
    db.prepare(`
      INSERT INTO installed_apps (id, spec_id, space_id, spec_json, status, user_config_json, user_overrides_json, permissions_json, installed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(appId, 'test-app', 'space-001', '{}', 'active', '{}', '{}', '{"granted":[],"denied":[]}', Date.now())

    runId = randomUUID()
    store.insertRun({
      runId,
      appId,
      sessionKey: 'sess-001',
      status: 'ok',
      triggerType: 'manual',
      startedAt: Date.now(),
    })

    // Entries at t=100 (old), t=200, t=300 (new).
    for (const [ts, label] of [[100, 'old'], [200, 'middle'], [300, 'new']] as const) {
      store.insertEntry({
        id: randomUUID(),
        appId,
        runId,
        type: 'milestone',
        ts,
        content: { summary: label },
      })
    }
  })

  it('should return entries newer than `since` (BUG: returns older instead)', () => {
    // With since = 150, the caller expects entries at ts > 150 → [middle, new].
    const entries = store.getEntriesForApp(appId, { since: 150 })

    const summaries = entries.map((e) => e.content.summary)
    // BUG: current SQL `ts < ?` returns [old] (ts=100) instead of [new, middle].
    expect(summaries).toContain('new')
    expect(summaries).toContain('middle')
    expect(summaries).not.toContain('old')
  })

  it('should treat `since` as inclusive of exactly the boundary timestamp', () => {
    // since = 200 should include the entry at ts=200 (>= boundary).
    const entries = store.getEntriesForApp(appId, { since: 200 })
    const summaries = entries.map((e) => e.content.summary)
    expect(summaries).toContain('middle')
    expect(summaries).toContain('new')
    expect(summaries).not.toContain('old')
  })

  it('should combine `type` and `since` filters (BUG: since is ignored when type given)', () => {
    // Insert an escalation entry (different type) at ts=350.
    store.insertEntry({
      id: randomUUID(),
      appId,
      runId,
      type: 'escalation',
      ts: 350,
      content: { summary: 'escalation-new' },
    })

    // Query: milestone entries since ts=150 → should be [middle, new]
    // (the escalation entry is filtered out by type, the old entry by since).
    const entries = store.getEntriesForApp(appId, { type: 'milestone', since: 150 })

    const summaries = entries.map((e) => e.content.summary)
    // BUG: because only the `type` branch is taken, `since` is ignored and
    // the old (ts=100) milestone is included.
    expect(summaries).toEqual(['new', 'middle'])
  })
})