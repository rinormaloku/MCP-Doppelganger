import "reflect-metadata";
import { Module, Injectable, Inject, type OnModuleInit } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { McpModule, McpRegistryService, McpTransportType } from "@rekog/mcp-nest";
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

const CONFIG_TOKEN = "DOPPELGANGER_CONFIG";

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

@Injectable()
class DoppelgangerService implements OnModuleInit {
  constructor(
    private readonly registry: McpRegistryService,
    @Inject(CONFIG_TOKEN) private readonly config: DoppelgangerConfig,
  ) {}

  onModuleInit() {
    this.registerTools();
    this.registerResources();
    this.registerPrompts();
  }

  private registerTools() {
    for (const tool of this.config.tools) {
      const zodShape = jsonSchemaToZod(tool.inputSchema);

      this.registry.registerTool({
        name: tool.name,
        description: tool.description || "",
        parameters: z.object(zodShape),
        handler: async (args: Record<string, unknown>) => {
          const interpolatedContent = interpolateDeep(tool.response.content, args);
          return {
            content: interpolatedContent.map(transformContentBlock),
            isError: tool.response.isError || false,
          };
        },
      });
    }
  }

  private registerResources() {
    for (const resource of this.config.resources) {
      this.registry.registerResource({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        handler: async () => {
          const args = { uri: resource.uri };

          if (resource.response.text) {
            return {
              contents: [
                {
                  uri: resource.uri,
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
                  uri: resource.uri,
                  blob: resource.response.blob,
                  mimeType: resource.response.mimeType || "application/octet-stream",
                },
              ],
            };
          }

          return {
            contents: [
              {
                uri: resource.uri,
                text: "Resource not configured properly.",
                mimeType: "text/plain",
              },
            ],
          };
        },
      });
    }
  }

  private registerPrompts() {
    for (const prompt of this.config.prompts) {
      const argsShape: ZodShape = {};

      for (const arg of prompt.arguments || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let zodType: z.ZodType<any, any, any> = z.string();
        if (arg.description) {
          zodType = zodType.describe(arg.description);
        }
        // All arguments are optional to ensure prompts always succeed
        argsShape[arg.name] = zodType.optional();
      }

      this.registry.registerPrompt({
        name: prompt.name,
        description: prompt.description || "",
        parameters: z.object(argsShape),
        handler: async (args: Record<string, string> | undefined) => {
          const interpolatedMessages = interpolateDeep(prompt.response.messages, args ?? {});
          return {
            description: prompt.response.description,
            messages: interpolatedMessages.map((msg) => ({
              role: msg.role,
              content: transformContentBlock(msg.content),
            })),
          };
        },
      });
    }
  }
}

function buildAppModule(config: DoppelgangerConfig, transportTypes: McpTransportType[]) {
  @Module({
    imports: [
      McpModule.forRoot({
        name: config.server.name,
        version: config.server.version || "1.0.0",
        transport: transportTypes,
        streamableHttp: {
          // Stateless: no session tracking, ideal for a doppelganger server
          statelessMode: true,
        },
      }),
    ],
    providers: [
      { provide: CONFIG_TOKEN, useValue: config },
      DoppelgangerService,
    ],
  })
  class AppModule {}

  return AppModule;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const configSource = options.file || "doppelganger.yaml";
  console.error(`Loading configuration from: ${configSource}`);

  const config = await loadConfig(configSource);
  console.error(`Server: ${config.server.name}`);
  console.error(`Tools: ${config.tools.length}, Resources: ${config.resources.length}, Prompts: ${config.prompts.length}`);

  // Default to HTTP if nothing specified
  const useHttp = options.http || !options.stdio;
  const useStdio = options.stdio || false;

  const transportTypes: McpTransportType[] = [];
  if (useHttp) transportTypes.push(McpTransportType.STREAMABLE_HTTP);
  if (useStdio) transportTypes.push(McpTransportType.STDIO);

  const port = options.port || 3000;
  const AppModule = buildAppModule(config, transportTypes);

  const app = await NestFactory.create(AppModule, { logger: ["error", "warn"] });

  if (useHttp) {
    await app.listen(port);
    console.error(`${config.server.name} is running on http://0.0.0.0:${port}`);
    console.error(`MCP endpoint: http://0.0.0.0:${port}/mcp`);
  } else {
    // STDIO-only: initialise NestJS without starting an HTTP server
    await app.init();
    console.error(`${config.server.name} is running on stdio`);
  }
}
