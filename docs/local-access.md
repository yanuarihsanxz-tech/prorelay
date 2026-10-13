# Local files for other LLM clients

ProRelay provides a **local stdio MCP server**. A compatible client starts the server as a child process and calls its tools. It can be an IDE agent, a desktop LLM client, or another host that actually supports local MCP.

The server has one explicitly chosen workspace root. This is distinct from sending selected context to a browser chat: a packet is a snapshot, while an MCP read accesses the current file.

## Launch

Install the locked dependencies in the ProRelay checkout with `npm ci --ignore-scripts`. Configure your client using its current local-MCP instructions. The shared command/args pattern is:

```json
{
  "mcpServers": {
    "prorelay": {
      "command": "node",
      "args": [
        "/absolute/path/to/prorelay/src/cli.js",
        "mcp",
        "--root",
        "/absolute/path/to/project"
      ]
    }
  }
}
```

This is an example for clients using an `mcpServers` JSON configuration. It is not a universal configuration filename. Replace the paths with real absolute paths; use an absolute Node executable path if a GUI client cannot find `node`. Codex may use its own CLI/TOML configuration; Claude Code, Antigravity, Cursor, and other hosts have their own configuration scopes and permission prompts.

For Codex installations with the documented local server command:

```bash
codex mcp add prorelay -- node /absolute/path/to/prorelay/src/cli.js \
  mcp --root /absolute/path/to/project
```

Verify that the host discovers the tools and can read a harmless file. A successful SDK reference-client test does not prove a specific desktop integration was configured.

## Tools

| Tool | Behavior |
|---|---|
| `local_list` | Lists immediate visible entries; no recursive repository dump |
| `local_read` | Reads a selected UTF-8 file and returns its SHA256 |
| `local_write` | Available only with `--allow-write`; requires a current hash or `NEW` |
| `relay_prepare`, `relay_get`, `relay_list` | Creates and inspects local handoffs |
| `relay_dispatch`, `relay_sent`, `relay_receive` | Records the exchange the host performs through its browser tools |
| `relay_check`, `relay_mark`, `relay_resume` | Checks source changes and records progress/resume |

To enable writes, append `--allow-write` to the server arguments. Read an existing file first and pass its returned hash to `local_write`. A stale hash or `NEW` against an existing file is rejected. New files require an existing parent directory. The server does not create arbitrary directory trees, execute commands, or delete files.

Read-only means source writes are disabled. Relay tools still create/update ignored `.prorelay` task state within the chosen project. The host still controls permissions to invoke tools.

## Browser-only LLMs

A browser-only chat that does not support a local MCP connection cannot use this server directly. Let the local coding agent select files and send their contents in a marked handoff. This gives the chat task context, not unrestricted live access to your disk.

ProRelay does not expose a web server, public tunnel, or credentials. A remote connector that requires HTTPS needs additional supported infrastructure; it cannot connect directly to stdio. Do not claim that pasting a GitHub link changes this.

## Boundaries

Common credential filenames and recognizable key patterns are rejected. Symlinks, traversal outside the root, binary files, and oversized inputs are excluded. Filters do not detect all private content. Read outputs may leave the computer when the connected client sends them to its model provider; choose the root and authorize that client accordingly.

Source-file updates use hash checks and per-file locks to prevent conflicting ProRelay writes. They are not a security boundary against a hostile local process changing paths during the operation. Use a trusted, dedicated project root. Filesystem permissions do not provide browser access or subscription benefits.
