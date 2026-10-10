# OpenCognit MCP Server

Connect any MCP-compatible editor to your OpenCognit agent team.

## What is this?

The **Model Context Protocol (MCP)** is an open standard that lets AI code editors (Cursor, Claude Code, Windsurf, Zed, etc.) connect to external services. This server exposes your OpenCognit tasks, agents, and knowledge base as MCP tools.

## Setup

### 1. Install

```bash
npm install -g @opencognit/mcp-server
```

Or use directly via npx:

```bash
npx -y @opencognit/mcp-server
```

### 2. Configure your editor

#### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "opencognit": {
      "command": "npx",
      "args": ["-y", "@opencognit/mcp-server"],
      "env": {
        "OPENCOGNIT_URL": "http://localhost:3201",
        "OPENCOGNIT_TOKEN": "your-jwt-token",
        "OPENCOGNIT_COMPANY_ID": "your-company-id"
      }
    }
  }
}
```

#### Claude Code

```bash
claude config set mcpServers.opencognit "{\"command\":\"npx\",\"args\":[\"-y\",\"@opencognit/mcp-server\"],\"env\":{\"OPENCOGNIT_URL\":\"http://localhost:3201\",\"OPENCOGNIT_TOKEN\":\"xxx\",\"OPENCOGNIT_COMPANY_ID\":\"yyy\"}}"
```

### 3. Get your token

Log in to OpenCognit and copy your JWT token from the browser's localStorage (`opencognit_token`).

## Available Tools

| Tool | Description |
|---|---|
| `list_tasks` | List all tasks with status, priority, assignee |
| `get_task` | Get detailed info about a specific task |
| `create_task` | Create and assign a new task (auto-wakes agent) |
| `list_agents` | List all agents with roles and status |
| `get_agent` | Get detailed agent info |
| `wake_agent` | Trigger an agent to process its inbox |
| `search_knowledge` | Search the company knowledge base |

## How it works in practice

In Cursor, you can now say:

> "Create a task for the frontend agent to build a login page with OAuth"

Cursor will call:
```json
{
  "tool": "create_task",
  "arguments": {
    "title": "Build login page with OAuth",
    "description": "Create a React login page with OAuth integration",
    "priority": "high",
    "assignedTo": "frontend-agent-id"
  }
}
```

The agent is automatically woken up and starts working.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENCOGNIT_URL` | No | API base URL (default: `http://localhost:3201`) |
| `OPENCOGNIT_TOKEN` | Yes* | JWT auth token |
| `OPENCOGNIT_COMPANY_ID` | No | Company ID (auto-detected if omitted) |

\* Required if your OpenCognit instance has auth enabled.

## License

AGPL-3.0 — same as OpenCognit.
