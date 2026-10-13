# Host adapters

These adapters are workflows using each host's existing tools, not hidden APIs or replacement model runtimes. Host versions, enabled extensions, and permissions determine available capabilities.

## Codex

Install into the target project's `.agents/skills/prorelay` using `install-skill --host codex`. Ask Codex to use the `prorelay` skill. In Codex desktop with computer-use enabled, inspect available surfaces, select Gemini or the intended browser tab, and follow the returned control API documentation. Some sessions do not have those tools. Codex CLI or an IDE extension needs an enabled browser/computer MCP integration for an automatic web exchange.

Use the CLI through the native shell tool, or configure ProRelay's stdio MCP bridge. Read `runtime.json` for the real paths; do not assume this repository is the target project. The Codex desktop + Gemini macOS path is the initial live-validation target. Check the repository's verification report for observed results.

## Claude Code

Install with `--host claude` into `.claude/skills/prorelay`. Invoke `/prorelay` where supported. Claude Code's Chrome integration requires its browser extension and connection; inspect `/chrome` and the host's available tools before choosing this route. Existing sign-in can be used through that integration. A login page or CAPTCHA needs the user's intervention.

For CLI filesystem/terminal work, use native tools or ProRelay MCP. ProRelay does not enable bypass-permissions mode. Documentation: https://code.claude.com/docs/en/chrome and https://code.claude.com/docs/en/skills.

## Antigravity

Install with `--host antigravity` into `.agents/skills/prorelay`. Use the browser tools exposed by the current app/IDE when enabled; confirm their profile, login, URL permissions, and task surface. Antigravity's browser can use an isolated profile, so sign-in in a separate personal browser may not carry over.

Use native project tools for code and tests, and the CLI or configured MCP for handoff state. ProRelay does not change subscription eligibility or permission presets. Documentation: https://antigravity.google/docs/skills and https://antigravity.google/docs/ide/browser.

## Cursor, VS Code agents, Windsurf, Cline, and other LLM clients

If the installed client supports a local stdio MCP server, it can connect to ProRelay's scoped file and handoff tools. Native workspace access can also be used directly. Configure the server using the command/args pattern in the repository's local-access guide; verify the exact configuration syntax in the host's documentation.

Use `--host generic` for the portable skill files only when the host discovers that location, or explicitly ask it to read the skill. Browser control is a separate requirement. Treat untested clients as integration targets, not confirmed compatibility.

## Gemini and other browser-only chats

A chat receives selected file contents through the packet. This does not give it live local filesystem access. If that product supports a local MCP connection, a user can configure ProRelay's stdio server according to that product's current documentation. A public HTTPS connector cannot reach this stdio server without additional supported infrastructure; ProRelay supplies no public tunnel or unauthenticated web server.

For non-Gemini chats, set `--provider other` and inspect their real UI with the host's tools. Matching response markers and local verification still apply. No other provider's automated exchange is claimed as tested by this release.
