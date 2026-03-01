# MCP Server Setup

MCP (Model Context Protocol) servers extend Claude Code's capabilities during development sessions. Harness uses four servers configured in `.mcp.json` at the project root.

---

## Configuration File

`.mcp.json` is the Claude Code MCP configuration. It is checked in to the repository so every developer gets the same server definitions. Secrets (API keys, tokens) are **not** in this file — they are resolved from environment variables at startup.

---

## Serena

**Purpose:** Semantic code analysis. Provides symbol-level tools for navigating the codebase — find definitions, find references, rename symbols, get file overviews — without reading entire files.

**Installation:**

```bash
pipx install serena
# or
pip install serena
```

The binary must be at `~/.local/bin/serena-mcp-server`. If `pipx` installs it elsewhere, symlink or adjust the `command` path in `.mcp.json`.

**Config in `.mcp.json`:**

```json
"serena": {
  "command": "/home/your-username/.local/bin/serena-mcp-server",
  "args": [
    "--project", "/path/to/harness",
    "--context", "claude-code",
    "--enable-web-dashboard", "false",
    "--open-web-dashboard", "false"
  ]
}
```

Update `--project` to your local clone path and adjust `command` to match your install location. No API key required.

**Verify:** Run `/home/your-username/.local/bin/serena-mcp-server --help`. If it prints usage info, the install succeeded.

---

## Context7

**Purpose:** Live documentation lookup. Resolves library names to Context7 IDs and retrieves up-to-date code examples and API docs for any npm/PyPI package — useful for Next.js, Prisma, Radix UI, etc.

**API Key:**

Sign up at [context7.com](https://context7.com) and generate an API key from your account settings.

Add it to your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
export CONTEXT7_API_KEY="your-key-here"
```

Reload the shell (`source ~/.bashrc`) before starting Claude Code.

**Config in `.mcp.json`:**

```json
"context7": {
  "command": "bash",
  "args": ["-c", ". ~/.bashrc; exec npx -y @upstash/context7-mcp@latest --api-key $CONTEXT7_API_KEY"],
  "env": {}
}
```

The `bash -c ". ~/.bashrc; exec ...` wrapper sources your profile so `$CONTEXT7_API_KEY` is available even when Claude Code does not inherit your full shell environment.

**Verify:** In a Claude Code session, ask it to look up docs for any library (e.g. "show me how to use Prisma's `findMany`"). If Context7 resolves a library ID and returns docs, it is working.

---

## Playwright

**Purpose:** Browser automation and end-to-end testing. Lets Claude Code open pages, click elements, fill forms, take screenshots, and assert on DOM state — useful when debugging UI issues that are hard to reproduce from code alone.

**Installation:**

No package install required — `npx` fetches it on first use. However, Playwright needs its browser binaries:

```bash
npx playwright install
```

Install only the browsers you need (saves ~500 MB per browser):

```bash
npx playwright install chromium
```

**Config in `.mcp.json`:**

```json
"playwright": {
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"],
  "env": {}
}
```

No API key required.

**Verify:** Start the dev server (`pnpm dev`), then ask Claude Code to navigate to `http://localhost:4000` and describe what it sees.

---

## GitHub

**Purpose:** GitHub API access. Lets Claude Code view issues, pull requests, checks, and releases without leaving the editor — useful for reviewing PR comments or triaging issues.

**Personal Access Token:**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate a **classic token** (or fine-grained token scoped to this repo) with at minimum: `repo`, `read:org`
3. Add it to your shell profile:

```bash
export GITHUB_TOKEN="ghp_your-token-here"
```

Or add it to your `.env` file (it is already in `.gitignore`):

```
GITHUB_TOKEN=ghp_your-token-here
```

**Config in `.mcp.json`:**

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

`${GITHUB_TOKEN}` is resolved from the environment at startup.

**Verify:** Ask Claude Code to list recent issues or show the latest PR for this repository. If it returns data, the token is valid.

---

## Adding a New MCP Server

1. Add an entry to `.mcp.json` under `mcpServers`
2. If it requires secrets, expose them as environment variables — never hardcode them in `.mcp.json`
3. Restart Claude Code to pick up the new config
4. Add setup instructions to this file so other developers can replicate your environment
