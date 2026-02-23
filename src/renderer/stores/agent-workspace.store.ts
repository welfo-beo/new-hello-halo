import { create } from 'zustand'

export interface WorkspaceTask {
  id: string
  title: string
  status: 'pending' | 'running' | 'done' | 'error'
  parentId?: string
  children: string[]
  tool?: string
  startTime: number
  endTime?: number
  parallelGroupId?: string
}

interface WorkspaceStore {
  isOpen: boolean
  tasks: Record<string, WorkspaceTask>
  rootIds: string[]
  setOpen: (open: boolean) => void
  onToolCall: (toolId: string, toolName: string, toolInput: Record<string, unknown>) => void
  onToolResult: (toolId: string, isError: boolean) => void
  onComplete: () => void
  clear: () => void
}

// Module-level parallel group tracking: tasks arriving within 200ms share a group
let _currentGroupId: string | null = null
let _groupTimer: ReturnType<typeof setTimeout> | null = null

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  isOpen: false,
  tasks: {},
  rootIds: [],

  setOpen: (open) => set({ isOpen: open }),

  onToolCall: (toolId, toolName, toolInput) => {
    if (toolName === 'Task') {
      // Assign parallel group: tasks within 200ms share a group ID
      if (!_currentGroupId) _currentGroupId = `g-${Date.now()}`
      if (_groupTimer) clearTimeout(_groupTimer)
      _groupTimer = setTimeout(() => { _currentGroupId = null }, 200)

      const raw = (toolInput.description as string) || (toolInput.prompt as string) || 'Task'
      const title = raw.length > 80 ? raw.slice(0, 80) + '…' : raw
      const task: WorkspaceTask = {
        id: toolId,
        title,
        status: 'running',
        children: [],
        startTime: Date.now(),
        parallelGroupId: _currentGroupId
      }
      set(s => ({
        isOpen: true,
        tasks: { ...s.tasks, [toolId]: task },
        rootIds: [...s.rootIds, toolId]
      }))
    } else {
      // Update most recent running task's current tool
      const running = Object.values(get().tasks).filter(t => t.status === 'running')
      if (running.length > 0) {
        const latest = running[running.length - 1]
        set(s => ({
          tasks: { ...s.tasks, [latest.id]: { ...s.tasks[latest.id], tool: toolName } }
        }))
      }
    }
  },

  onToolResult: (toolId, isError) => {
    set(s => {
      if (!s.tasks[toolId]) return s
      return {
        tasks: {
          ...s.tasks,
          [toolId]: { ...s.tasks[toolId], status: isError ? 'error' : 'done', endTime: Date.now(), tool: undefined }
        }
      }
    })
  },

  onComplete: () => {
    set(s => {
      const tasks = { ...s.tasks }
      for (const id of Object.keys(tasks)) {
        if (tasks[id].status === 'running') {
          tasks[id] = { ...tasks[id], status: 'done', endTime: Date.now(), tool: undefined }
        }
      }
      return { tasks }
    })
  },

  clear: () => {
    _currentGroupId = null
    if (_groupTimer) { clearTimeout(_groupTimer); _groupTimer = null }
    set({ tasks: {}, rootIds: [] })
  }
}))
