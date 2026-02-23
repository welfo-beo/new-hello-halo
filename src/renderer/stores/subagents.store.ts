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
}

type SpaceConfig = { mode: SubagentsMode; subagents: SubagentDef[] }
const DEFAULT_CONFIG: SpaceConfig = { mode: 'off', subagents: [] }

interface SubagentsState {
  spaces: Record<string, SpaceConfig>
  setMode: (spaceId: string, mode: SubagentsMode) => void
  addSubagent: (spaceId: string, agent: Omit<SubagentDef, 'id'>) => void
  updateSubagent: (spaceId: string, id: string, agent: Omit<SubagentDef, 'id'>) => void
  removeSubagent: (spaceId: string, id: string) => void
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
          // Assign stable ids to agents that were persisted before id field was added
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
