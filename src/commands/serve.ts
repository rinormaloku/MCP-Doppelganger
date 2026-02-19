import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { DoppelgangerConfig, ContentBlock } from "../types/config.js";
import { loadConfig } from "../utils/config-loader.js";
import { interpolateDeep } from "../utils/template.js";

export interface ServeOptions {
  file?: string;
  stdio?: boolean;
  http?: boolean;
  port?: number;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const configSource = options.file || "doppelganger.yaml";
  console.error(`Loading configuration from: ${configSource}`);

  const config = await loadConfig(configSource);
  console.error(`Server: ${config.server.name}`);
  console.error(`Tools: ${config.tools.length}, Resources: ${config.resources.length}, Prompts: ${config.prompts.length}`);

  // Default to stdio if nothing specified
  const useHttp = options.http || (!options.stdio);
  const useStdio = options.stdio || false;

  if (useHttp) {
    await startHttpServer(config, options.port || 3000);
  }

  if (useStdio) {
    const server = createMcpServer(config);
    await startStdioServer(server, config);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodShape = Record<string, z.ZodType<any, any, any>>;

function jsonSchemaToZod(schema: Record<string, unknown>): ZodShape {
  const properties = (schema.properties as Record<string, { type?: string; description?: string }>) || {};
  const required = (schema.required as string[]) || [];

  const zodShape: ZodShape = {};

  for (const [key, prop] of Object.entries(properties)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let zodType: z.ZodType<any, any, any>;

    switch (prop.type) {
      case "string":
        zodType = z.string();
        break;
      case "number":
        zodType = z.number();
        break;
      case "integer":
        zodType = z.number().int();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      case "array":
        zodType = z.array(z.any());
        break;
      case "object":
        zodType = z.record(z.string(), z.any());
        break;
      default:
        zodType = z.any();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    zodShape[key] = zodType;
  }

  return zodShape;
}

function createMcpServer(config: DoppelgangerConfig): McpServer {
  const server = new McpServer({
    name: config.server.name,
    version: config.server.version || "1.0.0",
  });

  // Register tools
  for (const tool of config.tools) {
    const zodSchema = jsonSchemaToZod(tool.inputSchema);

    server.registerTool(
      tool.name,
      {
        description: tool.description || "",
        inputSchema: zodSchema,
      },
      async (args: Record<string, unknown>) => {
        const interpolatedContent = interpolateDeep(tool.response.content, args);

        return {
          content: interpolatedContent.map(transformContentBlock),
          isError: tool.response.isError || false,
        };
      }
    );
  }

  // Register resources
  for (const resource of config.resources) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async (uri) => {
        const args = { uri: uri.toString() };

        if (resource.response.text) {
          return {
            contents: [
              {
                uri: uri.toString(),
                text: interpolateDeep(resource.response.text, args),
                mimeType: resource.response.mimeType || "text/plain",
              },
            ],
          };
        }

        if (resource.response.blob) {
          return {
            contents: [
              {
                uri: uri.toString(),
                blob: resource.response.blob,
                mimeType: resource.response.mimeType || "application/octet-stream",
              },
            ],
          };
        }

        return {
          contents: [
            {
              uri: uri.toString(),
              text: "Resource not configured properly.",
              mimeType: "text/plain",
            },
          ],
        };
      }
    );
  }

  // Register prompts
  for (const prompt of config.prompts) {
    const argsSchema: ZodShape = {};
    for (const arg of prompt.arguments || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let zodType: z.ZodType<any, any, any> = z.string();
      if (arg.description) {
        zodType = zodType.describe(arg.description);
      }
      // All arguments are optional to ensure prompts always succeed
      zodType = zodType.optional();
      argsSchema[arg.name] = zodType;
    }

    server.registerPrompt(
      prompt.name,
      {
        description: prompt.description || "",
        argsSchema: Object.keys(argsSchema).length > 0 ? argsSchema : undefined,
      },
      async (args: Record<string, unknown>) => {
        const interpolatedMessages = interpolateDeep(prompt.response.messages, args);

        return {
          description: prompt.response.description,
          messages: interpolatedMessages.map((msg) => ({
            role: msg.role,
            content: transformContentBlock(msg.content),
          })),
        };
      }
    );
  }

  return server;
}

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image"; data: string; mimeType: string };
type EmbeddedResourceContent = {
  type: "resource";
  resource: { uri: string; text: string; mimeType?: string } | { uri: string; blob: string; mimeType?: string };
};

type ContentBlockResult = TextContent | ImageContent | EmbeddedResourceContent;

function transformContentBlock(block: ContentBlock): ContentBlockResult {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "image":
      return { type: "image", data: block.data, mimeType: block.mimeType };
    case "resource":
      // Ensure either text or blob is present
      if (block.resource.text !== undefined) {
        return {
          type: "resource",
          resource: {
            uri: block.resource.uri,
            text: block.resource.text,
            mimeType: block.resource.mimeType,
          },
        };
      } else if (block.resource.blob !== undefined) {
        return {
          type: "resource",
          resource: {
            uri: block.resource.uri,
            blob: block.resource.blob,
            mimeType: block.resource.mimeType,
          },
        };
      } else {
        // Fallback to text with empty string
        return {
          type: "resource",
          resource: {
            uri: block.resource.uri,
            text: "",
            mimeType: block.resource.mimeType,
          },
        };
      }
  }
}

async function startStdioServer(server: McpServer, config: DoppelgangerConfig): Promise<void> {
  console.error("Starting stdio transport...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${config.server.name} is running on stdio`);
}

async function startHttpServer(
  config: DoppelgangerConfig,
  port: number
): Promise<void> {
  console.error(`Starting HTTP/SSE transport on port ${port}...`);

  // Operate in stateless mode: the MCP spec says servers MAY assign a session ID,
  // so omitting it is fully compliant. Each request gets a fresh server+transport
  // instance with no shared state, which is ideal for a doppelganger server.
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://0.0.0.0:${port}`);

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: config.server.name }));
      return;
    }

    // Handle MCP endpoint — stateless: no session tracking, new instance per request
    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      const server = createMcpServer(config);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless: no MCP-Session-Id header issued
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, () => {
    console.error(`${config.server.name} is running on http://0.0.0.0:${port}`);
    console.error(`MCP endpoint: http://0.0.0.0:${port}/mcp`);
  });
}
