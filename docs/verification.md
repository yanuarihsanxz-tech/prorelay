# Verification report

Initial release validation: **14 October 2026**. This report records observed behavior and distinguishes it from documented integration targets.

## Automated core checks

`npm run check` passed **13 tests** on macOS with Node.js 26.8.1. The suite covers:

- CLI use across separate processes, local skill installation, and refusal to replace an existing skill.
- A real MCP SDK stdio client negotiating the protocol, discovering tools, and reading a local file.
- Opt-in MCP writes, rejection of stale hashes, and relay-tool state changes.
- Context preparation, linked revisions, dispatch/receive/apply/verify, and durable reads.
- Concurrent/duplicate dispatch, pause/resume, and incomplete or wrong-task responses.
- Changed/deleted source detection, Git exclusion of runtime state, and state symlink rejection.
- Scoped reads/writes, path traversal and symlink exclusion, oversized/binary/non-UTF-8 inputs, and recognizable credential patterns.

The skill passed the Codex Skill Creator frontmatter/name/scaffold validator. That validation alone is not proof of workflow behavior.

## Live provider exchange

**Executor:** Codex desktop, using its enabled native computer-use tools.  
**Target:** Gemini macOS app, with **Argon** visibly selected.  
**Context:** synthetic demo code and tests only, sent as text through the normal app composer.

The demo's preserved baseline produced **1 passing and 2 failing tests**. ProRelay prepared a task with the brief, selected source, selected tests, and file hashes. Dispatch was reserved before sending, and the app visibly showed the sent task.

Argon returned a complete replacement `range.js` with matching task markers. The executor captured the full response through the app's **Copy response** action, saved it through `receive`, confirmed the source snapshot was unchanged, reviewed the proposed code, and applied it locally.

`node --test range.test.js` in the scratch demo then produced **3 passing tests, 0 failures**. The same reviewed implementation is included in `examples/demo-project/range.js`; `npm run demo:test` also passed all three tests. No model API or undocumented endpoint was used.

The copied answer was briefly pasted into the unsent app composer to obtain complete accessibility text; that temporary draft was cleared without sending. The provider chat was retained. Runtime packets and replies are excluded from the public repository.

A second live handoff used the updated code and linked its checkpoint to the first task. Before dispatch, the executor paused and resumed that task as a recovery exercise; it returned to `prepared` without sending. Argon then returned a complete marked review with no findings within the stated contract. The executor captured it, checked the unchanged snapshot, and accepted the review. Both handoffs reached `verified`. No other host or provider was used for these live checks.

## Compatibility limits

The live result proves a small text-context coding handoff on this Codex desktop + Gemini macOS setup. It does not establish reliability for large file uploads, other operating systems, every Gemini account, long unattended runs, or other coding-agent/browser combinations.

Claude Code/Chrome and Antigravity/browser are documented adapters based on their official capabilities, not live-tested integrations in this release. Other MCP clients must be configured and verified in their own host. The MCP reference-client test validates the server, not those clients' UI/configuration.

GitHub CI passed on Linux with **Node.js 22 and 24** for the initial implementation commit `d8067b4`. Both jobs ran dependency installation, `npm run check`, and `npm run demo:test`. [Observed Actions run](https://github.com/yanuarihsanxz-tech/prorelay/actions/runs/38485535721). Refer to Actions for later commits; these results describe the observed run rather than a permanent guarantee.

Provider limits, login, CAPTCHA, host permissions, and inactive sessions can stop execution. The project provides checkpoint recovery; it does not bypass those conditions or supply a persistent background runner.
