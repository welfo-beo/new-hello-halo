# AI Browser Workflow (Snapshot-First)

AI Browser tools in Halo are exposed through MCP server `ai-browser` with names:

- `mcp__ai-browser__browser_*`

Recommended execution loop:

1. `browser_new_page` or `browser_navigate`
2. Optional `browser_wait_for` for expected page text/state
3. `browser_snapshot` to fetch current a11y tree and `uid`s
4. Interaction tools (`browser_click`, `browser_fill`, `browser_press_key`, etc.)
5. `browser_snapshot` again to confirm post-action state

Notes:

- Always use the latest snapshot before interacting: element `uid`s can change.
- Prefer `browser_snapshot` for planning over screenshots.
- Use `browser_fill_form` for multi-field input to reduce round trips.
- `browser_network_request.reqid` and `browser_console_message.msgid` accept both prefixed and numeric forms (`req_1`/`1`, `msg_1`/`1`).
