#!/usr/bin/env node
// OpenCognit MCP Server
// Connects any MCP-compatible editor (Cursor, Claude Code, Windsurf, Codex) to your agent team
//
// Usage:
//   OPENCOGNIT_TOKEN=xxx OPENCOGNIT_COMPANY_ID=yyy npx @opencognit/mcp-server
//
// Cursor Config (~/.cursor/mcp.json):
//   {
//     "mcpServers": {
//       "opencognit": {
//         "command": "npx",
//         "args": ["-y", "@opencognit/mcp-server"],
//         "env": {
//           "OPENCOGNIT_URL": "http://localhost:3201",
//           "OPENCOGNIT_TOKEN": "your-jwt-token"
//         }
//       }
//     }
//   }

import { startMcpServer } from './server.js';

startMcpServer().catch((err) => {
  console.error('[opencognit-mcp] Fatal error:', err);
  process.exit(1);
});
