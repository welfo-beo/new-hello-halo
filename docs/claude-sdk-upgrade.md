# Claude SDK Upgrade Guide

This project depends on a patched `@anthropic-ai/claude-agent-sdk` runtime.
Do not upgrade SDK packages without re-validating patch compatibility.

## Scope

- `@anthropic-ai/claude-agent-sdk` (patched)
- `@anthropic-ai/claude-code` (pinned)
- `@anthropic-ai/sdk` (pinned)

## Upgrade Steps

1. Update versions in `package.json`.
2. Run `npm install` to refresh lockfile and dependencies.
3. Rebase or regenerate `patches/@anthropic-ai+claude-agent-sdk+0.1.76.patch` against the new SDK version.
4. Validate required patch behavior in `node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs`:
   - V2 session option pass-through (including `mcpServers`, `includePartialMessages`, `resume`)
   - exposed `pid` for process health tracking
   - Query init path preserving custom system prompt and SDK MCP instances
5. Run patch guard:
   - `npm run test:check:patch`
6. Run regression checks:
   - `npm run test:check`
   - `npm run test:unit`
   - `npm run test:e2e:ci-smoke`
7. If any step fails, do not merge the SDK version bump.

## Why this is required

The app relies on patched unstable V2 session behavior for:

- session resume handling
- token-level streaming
- MCP server wiring in session mode
- process health observability

Without these patch points, runtime behavior may regress silently.
