# Installation, Build, and Serving Guide

This document covers installing GitNexus from npm, building it from source, publishing a release, and running the various server modes.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Install from npm (end-user)](#install-from-npm-end-user)
3. [Build from Source](#build-from-source)
4. [Verify the Build](#verify-the-build)
5. [Local Pack and Test](#local-pack-and-test)
6. [Publishing](#publishing)
7. [Serving](#serving)

---

## Prerequisites

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| **Node.js** | 22.0.0 | The CLI and MCP server require Node ≥ 22. The web UI requires `^20.19.0 \|\| >=22.12.0`. |
| **npm** | 10+ | Used for `npm install`, `npm run build`, `npm pack`, `npm publish`. |
| **Python 3** | Any modern | Required only when building native tree-sitter grammars from source (`make`). |
| **C++ build tools** | `make`, `g++` / MSVC | Required only for optional grammar natives (`tree-sitter-dart`, `-proto`, `-swift`). |
| **Git** | Any | Required at runtime for `gitnexus analyze` (git history capture) and `git_show` (live commit detail). |

> **Skip native grammars (faster install):** set `GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1` before
> `npm install` to skip the materialization/build steps for optional grammars. Dart, Proto, and
> Swift files will not be parsed, but the install completes in seconds without a C++ toolchain.

---

## Install from npm (end-user)

```bash
# Global install — fastest startup, bypasses npx cold-cache delay
npm install -g gitnexus

# One-time MCP + editor config (Claude Code, Cursor, Codex, Windsurf, OpenCode)
gitnexus setup

# Index your repo
cd /path/to/your/repo
gitnexus analyze
```

To use a specific version:

```bash
npm install -g gitnexus@1.6.5
```

To use without installing globally (cold-cache adds ~30s on first run):

```bash
npx gitnexus@latest analyze
```

---

## Build from Source

The monorepo has three packages that must be built in order:

```
gitnexus-shared/   ← types and constants used by both CLI and web
gitnexus/          ← CLI, MCP server, HTTP API  (builds shared inline)
gitnexus-web/      ← React web UI               (bundled into gitnexus/web/)
```

### Step 1 — Clone

```bash
git clone https://github.com/abhigyanpatwari/GitNexus.git
cd GitNexus
```

### Step 2 — Install dependencies

Install dependencies for each package independently (no workspace hoisting):

```bash
# Shared types package
cd gitnexus-shared && npm install && cd ..

# CLI / MCP server
cd gitnexus && npm install && cd ..

# Web UI
cd gitnexus-web && npm install && cd ..
```

> The `postinstall` script in `gitnexus/` materializes vendored grammars and
> builds native add-ons automatically after `npm install`. It requires Python 3
> and C++ build tools unless `GITNEXUS_SKIP_OPTIONAL_GRAMMARS=1` is set.

### Step 3 — Build

The single build command in `gitnexus/` drives the entire pipeline:

```bash
cd gitnexus
npm run build
```

What `npm run build` does (see `gitnexus/scripts/build.js`):

1. Compiles `gitnexus-shared` (TypeScript → `gitnexus-shared/dist/`)
2. Compiles `gitnexus` CLI and server (TypeScript → `gitnexus/dist/`)
3. Copies `gitnexus-shared/dist/` → `gitnexus/dist/_shared/` (inline bundling)
4. Rewrites all `import 'gitnexus-shared'` specifiers to relative paths
5. Marks `gitnexus/dist/cli/index.js` executable (`chmod 755`)
6. Builds `gitnexus-web` (`tsc -b && vite build`) → copies output to `gitnexus/web/`

The final artifact is entirely self-contained in `gitnexus/dist/` and `gitnexus/web/`.

To build with a custom timeout (default 5 minutes):

```bash
GITNEXUS_BUILD_TIMEOUT_MS=600000 npm run build
```

### Step 4 — Typecheck (without emitting)

```bash
# CLI / server
cd gitnexus && npx tsc --noEmit

# Web UI
cd gitnexus-web && npx tsc -b --noEmit
```

---

## Verify the Build

Run the test suites to confirm the build is sound:

```bash
# CLI / Core — full suite (~2 000 tests)
cd gitnexus && npm test

# Unit tests only
cd gitnexus && npm run test:unit

# Integration tests (requires a compiled dist/ — build first)
cd gitnexus && npm run test:integration

# Web UI unit tests (~200 tests)
cd gitnexus-web && npm test

# Web UI E2E (requires gitnexus serve + gitnexus-web dev server running)
cd gitnexus-web && npm run test:e2e
```

---

## Local Pack and Test

To test the full npm tarball before publishing:

```bash
cd gitnexus

# Create a tarball (triggers prepack → build)
npm pack

# Inspect contents
tar -tzf gitnexus-*.tgz | head -40

# Install the tarball globally for manual smoke-testing
npm install -g gitnexus-*.tgz
gitnexus --version
gitnexus analyze /path/to/a/test/repo
```

---

## Publishing

Publishing is automated via GitHub Actions. Manual publishing is a fallback for emergencies.

### Automated (recommended)

Two publish modes are supported by `.github/workflows/publish.yml`:

| Mode | Trigger | npm dist-tag | Notes |
|------|---------|--------------|-------|
| **Release candidate (RC)** | Push to `main` or `workflow_dispatch` | `rc` | Version `X.Y.Z-rc.N`, GitHub prerelease, Docker RC images |
| **Stable release** | Push a `vX.Y.Z` tag (no `-rc.*` suffix) | `latest` | Full GitHub release with changelog |

**Cutting a stable release:**

```bash
# Ensure main is clean and tests pass
git checkout main && git pull

# Tag the release
git tag v1.6.5
git push origin v1.6.5
```

The workflow picks up the tag, runs `npm publish --tag latest`, and creates a GitHub release.

**Triggering a manual RC:**

```bash
gh workflow run publish.yml --ref main
# or with an explicit bump
gh workflow run publish.yml --ref main -f bump=minor
```

**Verify published dist-tags:**

```bash
npm view gitnexus dist-tags
```

### Manual publish (emergency fallback)

```bash
cd gitnexus

# Build first
npm run build

# Publish stable
npm publish --access public

# Publish as RC
npm publish --tag rc --access public
```

> You must be logged in (`npm login`) and have publish rights on the `gitnexus` package.

---

## Serving

GitNexus has three server modes. Pick the one that fits your use case.

### 1. MCP stdio server (AI agents)

Starts the Model Context Protocol server on stdin/stdout. This is what Claude Code, Cursor, Codex, and other editors connect to.

```bash
# Using the global install
gitnexus mcp

# Using npx (no install required)
npx gitnexus@latest mcp

# From a local build (after npm run build in gitnexus/)
node gitnexus/dist/cli/index.js mcp
```

**Editor MCP configuration:**

*Claude Code:*
```bash
# macOS / Linux
claude mcp add gitnexus -- npx -y gitnexus@latest mcp

# Windows
claude mcp add gitnexus -- cmd /c npx -y gitnexus@latest mcp

# Fastest (global install, no npx delay)
claude mcp add gitnexus -- gitnexus mcp
```

*Cursor (`~/.cursor/mcp.json`):*
```json
{
  "mcpServers": {
    "gitnexus": {
      "command": "npx",
      "args": ["-y", "gitnexus@latest", "mcp"]
    }
  }
}
```

*Codex (`~/.codex/config.toml`):*
```toml
[mcp_servers.gitnexus]
command = "npx"
args = ["-y", "gitnexus@latest", "mcp"]
```

*OpenCode (`~/.config/opencode/config.json`):*
```json
{
  "mcp": {
    "gitnexus": {
      "type": "local",
      "command": ["gitnexus", "mcp"]
    }
  }
}
```

Run `gitnexus setup` to auto-detect and configure all editors in one step.

---

### 2. HTTP API server (web UI + REST clients)

Starts a local HTTP server on port **4747**. The web UI auto-connects to it, and REST clients can query the API directly.

```bash
# From an indexed repo directory
gitnexus serve

# Specify a different port
gitnexus serve --port 8080

# From a local build
node gitnexus/dist/cli/index.js serve
```

Key API endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/repos` | List all indexed repositories |
| `GET /api/repo` | Current repo metadata |
| `GET /api/git-log` | Paginated commit history (`limit`, `offset`, `author`, `since`, `until`, `search`, `summary_only`) |
| `GET /api/git-show` | Single commit detail (`commit`, `include_diff`) |
| `GET /api/graph` | Full knowledge graph (nodes + relationships) |
| `POST /api/query` | Execute a Cypher query |
| `POST /api/analyze` | Start an indexing job |
| `GET /api/heartbeat` | SSE heartbeat for web UI connection status |

---

### 3. Web UI dev server (development only)

Runs the React app on Vite's dev server (port **5173**) with hot module replacement. Requires `gitnexus serve` to be running on port 4747 at the same time.

```bash
# Terminal 1 — HTTP API
gitnexus serve

# Terminal 2 — web UI dev server
cd gitnexus-web && npm run dev
```

Open `http://localhost:5173` in a browser. The web UI auto-connects to `http://localhost:4747`.

To preview the production build of the web UI:

```bash
cd gitnexus-web
npm run build
npm run preview   # serves the built dist/ on port 4173
```

---

### 4. Docker

A Docker image is built and published on every RC. Images are pushed to both GHCR and Docker Hub.

```bash
# Pull and run the CLI image
docker pull ghcr.io/abhigyanpatwari/gitnexus:latest
docker run --rm -v "$(pwd):/repo" ghcr.io/abhigyanpatwari/gitnexus:latest analyze /repo

# Run the HTTP API server (exposes port 4747)
docker run --rm -p 4747:4747 \
  -v "$(pwd):/repo" \
  ghcr.io/abhigyanpatwari/gitnexus:latest serve /repo

# Use a specific RC version
docker pull ghcr.io/abhigyanpatwari/gitnexus:1.6.5-rc.1
```

See `docker-compose.yaml` in the repo root for a full stack setup (CLI + web UI together).

---

## Quick Reference

```bash
# Build from source
cd gitnexus-shared && npm install && cd ..
cd gitnexus && npm install && npm run build && cd ..
cd gitnexus-web && npm install && cd ..

# Verify
cd gitnexus && npm test
cd gitnexus-web && npm test

# Run locally
gitnexus serve                        # HTTP API on :4747
cd gitnexus-web && npm run dev        # Web UI on :5173 (dev)

# MCP for AI agents
gitnexus setup                        # auto-configure all editors
gitnexus mcp                          # or start the MCP server directly
```
