import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SubagentsMode = 'off' | 'manual' | 'auto'

export interface SubagentDef {
  id: string
  name: string
  description: string
  prompt: string
  tools?: string[]
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit'
  skills?: string[]
  enabled?: boolean  // undefined = enabled (default)
}

type SpaceConfig = { mode: SubagentsMode; subagents: SubagentDef[] }
const DEFAULT_CONFIG: SpaceConfig = { mode: 'off', subagents: [] }

interface SubagentsState {
  spaces: Record<string, SpaceConfig>
  setMode: (spaceId: string, mode: SubagentsMode) => void
  addSubagent: (spaceId: string, agent: Omit<SubagentDef, 'id'>) => void
  updateSubagent: (spaceId: string, id: string, agent: Omit<SubagentDef, 'id'>) => void
  removeSubagent: (spaceId: string, id: string) => void
  toggleSubagent: (spaceId: string, id: string) => void
  duplicateSubagent: (spaceId: string, id: string) => void
  reorderSubagents: (spaceId: string, fromIndex: number, toIndex: number) => void
  copySubagentsToSpace: (fromSpaceId: string, toSpaceId: string, agentIds: string[]) => void
  clearSpace: (spaceId: string) => void
}

export const useSubagentsStore = create<SubagentsState>()(
  persist(
    (set) => ({
      spaces: {},
      setMode: (spaceId, mode) => {
        if (!spaceId) return
        set((s) => ({
          spaces: { ...s.spaces, [spaceId]: { ...(s.spaces[spaceId] ?? DEFAULT_CONFIG), mode } }
        }))
      },
      addSubagent: (spaceId, agent) => {
        if (!spaceId) return
        set((s) => {
          const cfg = s.spaces[spaceId] ?? DEFAULT_CONFIG
          return { spaces: { ...s.spaces, [spaceId]: { ...cfg, subagents: [...cfg.subagents, { ...agent, id: crypto.randomUUID() }] } } }
        })
      },
      updateSubagent: (spaceId, id, agent) => {
        if (!spaceId) return
        set((s) => {
          const cfg = s.spaces[spaceId] ?? DEFAULT_CONFIG
          return { spaces: { ...s.spaces, [spaceId]: { ...cfg, subagents: cfg.subagents.map(a => a.id === id ? { ...agent, id } : a) } } }
        })
      },
      removeSubagent: (spaceId, id) => {
        if (!spaceId) return
        set((s) => {
          const cfg = s.spaces[spaceId] ?? DEFAULT_CONFIG
          return { spaces: { ...s.spaces, [spaceId]: { ...cfg, subagents: cfg.subagents.filter(a => a.id !== id) } } }
        })
      },
      toggleSubagent: (spaceId, id) => {
        if (!spaceId) return
        set((s) => {
          const cfg = s.spaces[spaceId] ?? DEFAULT_CONFIG
          return { spaces: { ...s.spaces, [spaceId]: { ...cfg, subagents: cfg.subagents.map(a => a.id === id ? { ...a, enabled: a.enabled === false ? undefined : false } : a) } } }
        })
      },
      duplicateSubagent: (spaceId, id) => {
        if (!spaceId) return
        set((s) => {
          const cfg = s.spaces[spaceId] ?? DEFAULT_CONFIG
          const src = cfg.subagents.find(a => a.id === id)
          if (!src) return s
          const existingNames = new Set(cfg.subagents.map(a => a.name))
          let newName = `${src.name}-copy`
          let i = 2
          while (existingNames.has(newName)) newName = `${src.name}-copy-${i++}`
          const dup = { ...src, id: crypto.randomUUID(), name: newName, enabled: undefined }
          const idx = cfg.subagents.findIndex(a => a.id === id)
          const arr = [...cfg.subagents]
          arr.splice(idx + 1, 0, dup)
          return { spaces: { ...s.spaces, [spaceId]: { ...cfg, subagents: arr } } }
        })
      },
      reorderSubagents: (spaceId, fromIndex, toIndex) => {
        if (!spaceId) return
        set((s) => {
          const cfg = s.spaces[spaceId] ?? DEFAULT_CONFIG
          const arr = [...cfg.subagents]
          const [item] = arr.splice(fromIndex, 1)
          arr.splice(toIndex, 0, item)
          return { spaces: { ...s.spaces, [spaceId]: { ...cfg, subagents: arr } } }
        })
      },
      copySubagentsToSpace: (fromSpaceId, toSpaceId, agentIds) => {
        if (!fromSpaceId || !toSpaceId) return
        set((s) => {
          const src = s.spaces[fromSpaceId] ?? DEFAULT_CONFIG
          const dst = s.spaces[toSpaceId] ?? DEFAULT_CONFIG
          const toCopy = src.subagents.filter(a => agentIds.includes(a.id))
          const existingNames = new Set(dst.subagents.map(a => a.name))
          const newAgents = toCopy
            .filter(a => !existingNames.has(a.name))
            .map(a => ({ ...a, id: crypto.randomUUID() }))
          return { spaces: { ...s.spaces, [toSpaceId]: { ...dst, subagents: [...dst.subagents, ...newAgents] } } }
        })
      },
      clearSpace: (spaceId) => set((s) => {
        const { [spaceId]: _, ...rest } = s.spaces
        return { spaces: rest }
      }),
    }),
    {
      name: 'halo-subagents',
      version: 1,
      migrate: (state: any, version: number) => {
        if (version === 0) {
          const spaces = state.spaces as Record<string, any>
          for (const spaceId of Object.keys(spaces)) {
            spaces[spaceId].subagents = (spaces[spaceId].subagents ?? []).map((a: any) =>
              a.id ? a : { ...a, id: crypto.randomUUID() }
            )
          }
        }
        return state
      }
    }
  )
)
