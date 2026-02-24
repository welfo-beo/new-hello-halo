# CLAUDE.md — Subagent Library-Driven Workflow

## Core Rule

**NEVER auto-generate subagents. ALWAYS select from `.claude/agents/` (130 agents).** When handling any non-trivial task, dispatch to the appropriate agent(s) via the Task tool. Run independent agents in parallel.

## Project: Halo Desktop AI Assistant

Electron 33 + React 18 + TypeScript 5.3 + Vite + Tailwind CSS 3.4 + Zustand + Claude Agent SDK + Express 5 + WebSocket

## Agent Selection by Task Domain

### Electron / Main Process
| Scenario | Agent(s) |
|----------|----------|
| Main process lifecycle, BrowserWindow, IPC handlers | `electron-pro` |
| Controllers, services, business logic | `backend-developer` |
| Express HTTP server, REST routes | `backend-developer` |
| WebSocket (ws) real-time events | `websocket-engineer` |
| OpenAI compat router / API bridge | `api-designer` + `backend-developer` |
| Agent SDK integration | `ai-engineer` |
| MCP server integration | `backend-developer` |

### React / Renderer
| Scenario | Agent(s) |
|----------|----------|
| UI components (chat, canvas, artifact) | `react-specialist` |
| Page layout, responsive design | `react-specialist` + `ui-designer` |
| Zustand stores (8 stores) | `frontend-developer` |
| Hooks (useCanvasLifecycle, useSmartScroll, etc.) | `react-specialist` |
| Tailwind styling, theme system (CSS variables) | `ui-designer` |
| CodeMirror / Markdown rendering | `frontend-developer` |
| i18n (i18next) | `frontend-developer` |

### Shared / Cross-Layer
| Scenario | Agent(s) |
|----------|----------|
| Type definitions (src/shared/) | `typescript-pro` |
| IPC channel design (preload ↔ main ↔ renderer) | `electron-pro` + `typescript-pro` |
| API adapter pattern (IPC vs HTTP transport) | `api-designer` |
| Full feature spanning all layers | `fullstack-developer` |

### Infrastructure / Build
| Scenario | Agent(s) |
|----------|----------|
| electron-vite config, build pipeline | `build-engineer` |
| electron-builder packaging (Mac/Win/Linux) | `build-engineer` |
| CI/CD (GitHub Actions) | `devops-engineer` |
| Docker containerization | `docker-expert` |
| Dependencies, patch-package | `dependency-manager` |

### Quality / Security
| Scenario | Agent(s) |
|----------|----------|
| Code review | `code-reviewer` |
| Security audit (API keys, auth, CSP) | `security-auditor` |
| Bug investigation | `debugger` + `error-detective` |
| Performance (memory leaks, render perf) | `performance-engineer` |
| Unit tests (Vitest) | `qa-expert` |
| E2E tests (Playwright) | `test-automator` |
| Accessibility | `accessibility-tester` |
| Architecture review | `architect-reviewer` |

### Specialized
| Scenario | Agent(s) |
|----------|----------|
| Git workflow, commits | `git-workflow-manager` |
| Refactoring | `refactoring-specialist` |
| Documentation | `documentation-engineer` |
| CLI tooling / scripts | `cli-developer` |
| Complex multi-agent coordination | `multi-agent-coordinator` |
| Parallel task decomposition & execution | `/parallel-task` skill → auto-selects agents |

## Directory → Agent Mapping

```
src/main/index.ts              → electron-pro
src/main/bootstrap/            → electron-pro
src/main/controllers/          → backend-developer
src/main/http/                 → backend-developer, websocket-engineer
src/main/ipc/                  → electron-pro
src/main/openai-compat-router/ → api-designer, backend-developer
src/main/services/agent/       → ai-engineer, backend-developer
src/main/services/ai-browser/  → electron-pro, backend-developer
src/main/services/ai-sources/  → backend-developer
src/main/services/*.service.ts → backend-developer
src/preload/                   → electron-pro, typescript-pro
src/renderer/components/       → react-specialist, ui-designer
src/renderer/pages/            → react-specialist
src/renderer/stores/           → frontend-developer
src/renderer/hooks/            → react-specialist
src/renderer/api/              → api-designer, typescript-pro
src/renderer/types/            → typescript-pro
src/renderer/assets/styles/    → ui-designer
src/renderer/i18n/             → frontend-developer
src/shared/                    → typescript-pro
src/worker/                    → backend-developer
tests/                         → qa-expert, test-automator
scripts/                       → build-engineer, cli-developer
patches/                       → dependency-manager
```

## Workflow Patterns

### 1. New Feature (cross-layer)
```
Round 1: fullstack-developer — analyze requirements, design approach
Round 2 (parallel):
  - electron-pro — main process / IPC changes
  - react-specialist — UI components
  - typescript-pro — shared types in src/shared/
Round 3: code-reviewer — review all changes
```

### 2. Bug Fix
```
Round 1 (parallel): debugger + error-detective — investigate root cause
Round 2: route to domain agent based on findings (e.g. electron-pro for main process bugs)
Round 3: code-reviewer — verify fix
```

### 3. Code Review
```
Round 1 (parallel):
  - code-reviewer — quality + patterns
  - security-auditor — security scan
  - performance-engineer — perf analysis
Round 2: synthesize into unified report
```

### 4. UI Feature
```
Round 1 (parallel):
  - react-specialist — component implementation
  - ui-designer — styling + responsive design
Round 2: frontend-developer — state management + i18n
Round 3: code-reviewer — review
```

### 5. Refactoring
```
Round 1: architect-reviewer — assess current architecture
Round 2: refactoring-specialist — execute changes
Round 3: code-reviewer — validate
```

### 6. IPC Channel Addition
```
Round 1: electron-pro — implement handler in src/main/ipc/ + preload
Round 2: typescript-pro — types in src/shared/ + renderer types
Round 3: react-specialist — wire up in renderer api adapter
```

## Selection Rules

1. **Single-domain task** → dispatch to 1 agent directly
2. **Cross-domain task** → use workflow pattern above, run independent agents in parallel
3. **Ambiguous task** → start with `fullstack-developer` for analysis, then route to specialists
4. **Complex orchestration** → use `multi-agent-coordinator`
5. **Always finish with `code-reviewer`** for any implementation task
6. **Pass full file paths + project context** to each agent (they have independent context windows)
7. **Refer agents to `.claude/skills/halo-dev/`** for project-specific context (CONTEXT.md, ARCHITECTURE.md, CHANGELOG.md)
