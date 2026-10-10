import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  listTasks,
  getTask,
  createTask,
  listAgents,
  getAgent,
  wakeAgent,
  searchKnowledge,
  getCompanies,
} from './client.js';

export async function startMcpServer() {
  const companyId = process.env.OPENCOGNIT_COMPANY_ID;

  // Resolve company if not provided
  let activeCompanyId = companyId;
  if (!activeCompanyId) {
    try {
      const companies = await getCompanies();
      const first = companies?.[0];
      if (first?.id) {
        activeCompanyId = first.id;
        console.error(`[opencognit-mcp] Auto-selected company: ${first.name} (${first.id})`);
      }
    } catch {
      console.error('[opencognit-mcp] Warning: Could not auto-select company. Set OPENCOGNIT_COMPANY_ID.');
    }
  }

  const server = new Server(
    {
      name: 'opencognit-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // ── Tools ──────────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_tasks',
          description: 'List all tasks in the OpenCognit project. Returns task ID, title, status, priority, and assigned agent.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_task',
          description: 'Get detailed information about a specific task by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'The task ID' },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'create_task',
          description: 'Create a new task and assign it to an agent. The agent will be woken up automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title' },
              description: { type: 'string', description: 'Detailed task description' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Task priority' },
              assignedTo: { type: 'string', description: 'Agent ID to assign the task to' },
            },
            required: ['title'],
          },
        },
        {
          name: 'list_agents',
          description: 'List all agents in the team. Returns agent ID, name, role, status, and connection type.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_agent',
          description: 'Get detailed information about a specific agent.',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'The agent ID' },
            },
            required: ['agentId'],
          },
        },
        {
          name: 'wake_agent',
          description: 'Trigger an agent to wake up and process its inbox immediately.',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'The agent ID to wake up' },
            },
            required: ['agentId'],
          },
        },
        {
          name: 'search_knowledge',
          description: 'Search the company knowledge base for relevant information.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!activeCompanyId) {
      throw new Error('No company configured. Set OPENCOGNIT_COMPANY_ID or ensure at least one company exists.');
    }

    const { name, arguments: args } = request.params;
    const a = args || {};

    switch (name) {
      case 'list_tasks': {
        const tasks = await listTasks(activeCompanyId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      }

      case 'get_task': {
        const task = await getTask(a.taskId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task, null, 2),
            },
          ],
        };
      }

      case 'create_task': {
        const result = await createTask(activeCompanyId, {
          title: a.title as string,
          description: (a.description as string) || '',
          priority: (a.priority as string) || 'medium',
          assignedTo: (a.assignedTo as string) || undefined,
        });
        // Wake the assigned agent if specified
        if (a.assignedTo) {
          try {
            await wakeAgent(a.assignedTo as string);
          } catch {
            // ignore wake errors
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: `Task created successfully:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'list_agents': {
        const agents = await listAgents(activeCompanyId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(agents, null, 2),
            },
          ],
        };
      }

      case 'get_agent': {
        const agent = await getAgent(a.agentId as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(agent, null, 2),
            },
          ],
        };
      }

      case 'wake_agent': {
        const result = await wakeAgent(a.agentId as string);
        return {
          content: [
            {
              type: 'text',
              text: `Agent woken up: ${JSON.stringify(result)}`,
            },
          ],
        };
      }

      case 'search_knowledge': {
        const results = await searchKnowledge(activeCompanyId, a.query as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // ── Resources ──────────────────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    if (!activeCompanyId) return { resources: [] };
    const agents = await listAgents(activeCompanyId);
    const tasks = await listTasks(activeCompanyId);

    return {
      resources: [
        ...agents.map((a: any) => ({
          uri: `opencognit://agents/${a.id}`,
          mimeType: 'application/json',
          name: a.name,
          description: `${a.role || a.rolle} — ${a.status}`,
        })),
        ...tasks.map((t: any) => ({
          uri: `opencognit://tasks/${t.id}`,
          mimeType: 'application/json',
          name: t.title || t.titel,
          description: `${t.status} — ${t.priority || t.prioritaet || 'normal'}`,
        })),
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = uri.match(/^opencognit:\/\/(agents|tasks)\/(.+)$/);
    if (!match) throw new Error(`Unknown resource URI: ${uri}`);

    const [, type, id] = match;
    const data = type === 'agents' ? await getAgent(id) : await getTask(id);

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  });

  // ── Start ──────────────────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[opencognit-mcp] Server running on stdio');
  console.error(`[opencognit-mcp] Connected to: ${process.env.OPENCOGNIT_URL || 'http://localhost:3201'}`);
  console.error(`[opencognit-mcp] Company: ${activeCompanyId || 'NOT SET'}`);
}
