---
name: prorelay
description: Coordinate a user's authorized Gemini or other web-chat handoff with a local coding agent, including selected file context, response capture, implementation, verification, and checkpoint resume. Use when the user asks to use ProRelay or exchange work with another LLM through an available browser or app.
---

# ProRelay

Keep the user's conversation, decisions, and local project connected to the external model. Use the external model for the task the user chose: design, implementation, diagnosis, or review. Preserve the full agreed scope when summarizing; distinguish settled decisions from open questions.

## Runtime and access

When installed, read `runtime.json` for the CLI and workspace paths. In the source repository, the CLI is `src/cli.js` relative to the repository root. Use the host's normal shell tool or the matching `relay_*` MCP tools; see [host adapters](references/hosts.md) for routing.

Inspect the host's actual tools before claiming browser, file, or execution access. Run `doctor` for local runtime checks. Browser/account results remain unknown until verified through the host tools. Filesystem full access does not provide browser tools or a model entitlement.

Choose the user's authorized target chat and inspect its current state. Confirm the selected model and sign-in. Ask the user to handle missing login, CAPTCHA, or account access. Do not change the requested model silently. Follow the host's real permissions and the provider's normal access limits.

## Handoff loop

1. Prepare a complete brief: desired result, accepted constraints, relevant decisions, observable completion criteria, and any unresolved choice. Select the files needed for this task; do not upload a whole repository reflexively. `prepare --brief-file brief.md --file source.js` or `relay_prepare` creates the packet and task ID without transmitting it.
2. Read the packet and confirm that sending this selected context to the chosen provider is covered by the user's request and host permissions. Explicitly authorize the transfer if either is missing. Never send credentials. Path and content filters are heuristics, not a guarantee that all sensitive material is detected.
3. Reserve dispatch with `dispatch ID` or `relay_dispatch` BEFORE sending. Use the host's browser/app tools to paste the packet or upload a supported text file containing it. Inspect the destination afterward. Record `sent ID --conversation "Chat URL or title"` only when the message visibly appears.
4. Wait using the host's supported bounded wait mechanism. Capture the complete final response once generation finishes. Both task markers must appear in the captured answer; record it with `receive ID --response-file reply.txt` or `relay_receive`. Never fill in a missing marker yourself or substitute an answer from another task.
5. Run `check ID` before applying the proposal. If source files changed, reconcile the current files with the sent snapshot and update the brief as needed. Review returned code as a proposal. Use the local agent's file/edit and execution tools to implement the appropriate result, then run the actual user-path checks. The bridge does not execute returned code.
6. Mark `applied` with a concrete note and `verified` with the exact check and observed result. These are executor reports, not automatically proven test results. For another exchange, prepare a new task with `--parent ID`, current files, and the new findings. Do not replay an old packet against changed code.

## Interruptions and review

Use `list` and `show ID` to recover the latest checkpoint. A `dispatching` task may already have been sent: inspect the target chat and collect any answer before considering another attempt. There is no automatic resend after an uncertain delivery.

For a requested pause use `mark ID --status paused --note "Reason"`; `resume ID` returns to the preceding state without sending. For a user decision use `needs_review` and provide the concrete artifact and unresolved choice. Continue independent authorized work while input is pending. A normal technical review by the other model can remain inside the active execution loop.

Quota exhaustion, unavailable browser tools, and expired sessions are concrete blockers. Preserve the checkpoint and report the smallest missing capability. If the user opts for manual transfer, prepare and collect the same marked packet; identify the mode as assisted. Do not claim unattended execution when the host session has stopped.
