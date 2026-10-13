# ProRelay repository

ProRelay provides selected-context handoffs, local checkpoint state, an optional scoped stdio MCP bridge, and a portable skill that uses the host's existing browser tools. Keep that distinction clear in code and copy.

Read `README.md` and the relevant source before changing behavior. Run `npm run check` for code changes and the demo test when editing the demo. Update the verification report only with observed results. Do not label a host compatible merely because it supports MCP or skills.

Keep runtime packets, replies, browser sessions, account identifiers, credentials, and private source out of commits. `.prorelay` is runtime state. The repo has no model API key, entitlement unlock, generic shell tool, automatic code execution, or persistent background runner.

For a ProRelay user task, read `skills/prorelay/SKILL.md` and use its install/runtime routing. Preserve existing project instructions when installing; do not replace `AGENTS.md` or `CLAUDE.md` in a target project.
