import { writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { stringify as stringifyYaml } from "yaml";
import type { DoppelgangerConfig, Tool, Resource, ResourceTemplate, Prompt } from "../types/config.js";

export interface CloneOptions {
  transport: "stdio" | "http";
  output?: string;
  format?: "yaml" | "json";
  headers?: string[];
  response?: string;
}

/**
 * Parse header strings in format "Name: Value" or "Name=Value"
 */
function parseHeaders(headerStrings: string[]): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const header of headerStrings) {
    // Support both "Name: Value" and "Name=Value" formats
    const colonIndex = header.indexOf(":");
    const equalsIndex = header.indexOf("=");

    let separator: number;
    if (colonIndex === -1 && equalsIndex === -1) {
      console.error(`Warning: Invalid header format "${header}", skipping`);
      continue;
    } else if (colonIndex === -1) {
      separator = equalsIndex;
    } else if (equalsIndex === -1) {
      separator = colonIndex;
    } else {
      // Use whichever comes first
      separator = Math.min(colonIndex, equalsIndex);
    }

    const name = header.substring(0, separator).trim();
    const value = header.substring(separator + 1).trim();

    if (name && value) {
      headers[name] = value;
    }
  }

  return headers;
}

export async function cloneCommand(
  target: string,
  options: CloneOptions
): Promise<void> {
  console.error(`Cloning MCP server: ${target}`);
  console.error(`Transport: ${options.transport}`);

  const client = new Client(
    {
      name: "mcp-doppelganger",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  let transport: StdioClientTransport | StreamableHTTPClientTransport;

  if (options.transport === "http") {
    const customHeaders = options.headers ? parseHeaders(options.headers) : {};

    if (Object.keys(customHeaders).length > 0) {
      console.error(`Using custom headers: ${Object.keys(customHeaders).join(", ")}`);
    }

    transport = new StreamableHTTPClientTransport(new URL(target), {
      requestInit: {
        headers: customHeaders,
      },
    });
  } else {
    const args = target.split(" ");
    const command = args[0];
    const commandArgs = args.slice(1);

    transport = new StdioClientTransport({
      command,
      args: commandArgs,
    });
  }

  try {
    await client.connect(transport);
    console.error("Connected to MCP server");

    const serverInfo = client.getServerVersion();
    console.error(`Server: ${serverInfo?.name || "unknown"} v${serverInfo?.version || "unknown"}`);

    const config = await extractServerSchema(client, serverInfo, options.response);
    const output = formatOutput(config, options.format || "yaml");

    const outputFile = options.output || "doppelganger.yaml";
    await writeFile(outputFile, output, "utf-8");
    console.error(`\nConfiguration written to: ${outputFile}`);

    await client.close();
  } catch (error) {
    console.error("Error cloning server:", error);
    throw error;
  }
}

const DEFAULT_RESPONSE = "Text placeholder, change with the desired message. Or use --response to set the same response for all tools.";

async function extractServerSchema(
  client: Client,
  serverInfo: { name?: string; version?: string } | undefined,
  customResponse?: string
): Promise<DoppelgangerConfig> {
  const responseText = customResponse || DEFAULT_RESPONSE;
  const tools: Tool[] = [];
  const resources: Resource[] = [];
  const resourceTemplates: ResourceTemplate[] = [];
  const prompts: Prompt[] = [];

  // Fetch tools
  try {
    const toolsResult = await client.listTools();
    console.error(`Found ${toolsResult.tools.length} tools`);

    for (const tool of toolsResult.tools) {
      // Remove required, $schema, and additionalProperties from inputSchema
      const inputSchema = { ...(tool.inputSchema as Record<string, unknown>) };
      delete inputSchema.required;
      delete inputSchema.$schema;
      delete inputSchema.additionalProperties;

      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema,
        response: {
          isError: true,
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        },
      });
    }
  } catch (error) {
    console.error("Could not fetch tools (server may not support them)");
  }

  // Fetch resources
  try {
    const resourcesResult = await client.listResources();
    console.error(`Found ${resourcesResult.resources.length} resources`);

    for (const resource of resourcesResult.resources) {
      resources.push({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        response: {
          text: responseText,
          mimeType: resource.mimeType || "text/plain",
        },
      });
    }
  } catch (error) {
    console.error("Could not fetch resources (server may not support them)");
  }

  // Fetch resource templates
  try {
    const templatesResult = await client.listResourceTemplates();
    console.error(`Found ${templatesResult.resourceTemplates.length} resource templates`);

    for (const template of templatesResult.resourceTemplates) {
      resourceTemplates.push({
        uriTemplate: template.uriTemplate,
        name: template.name,
        description: template.description,
        mimeType: template.mimeType,
        response: {
          text: responseText,
          mimeType: template.mimeType || "text/plain",
        },
      });
    }
  } catch (error) {
    console.error("Could not fetch resource templates (server may not support them)");
  }

  // Fetch prompts
  try {
    const promptsResult = await client.listPrompts();
    console.error(`Found ${promptsResult.prompts.length} prompts`);

    for (const prompt of promptsResult.prompts) {
      prompts.push({
        name: prompt.name,
        description: prompt.description,
        // All arguments are optional - no required field
        arguments: prompt.arguments?.map((arg) => ({
          name: arg.name,
          description: arg.description,
        })) || [],
        response: {
          description: prompt.description,
          messages: [
            {
              role: "assistant",
              content: {
                type: "text",
                text: responseText,
              },
            },
          ],
        },
      });
    }
  } catch (error) {
    console.error("Could not fetch prompts (server may not support them)");
  }

  return {
    version: "2025-11-25",
    server: {
      name: serverInfo?.name ? `${serverInfo.name}-doppelganger` : "doppelganger",
      description: `Shadowed clone of ${serverInfo?.name || "MCP server"}`,
      version: serverInfo?.version || "1.0.0",
    },
    tools,
    resources,
    resourceTemplates,
    prompts,
  };
}

function formatOutput(config: DoppelgangerConfig, format: "yaml" | "json"): string {
  if (format === "json") {
    return JSON.stringify(config, null, 2);
  }

  return stringifyYaml(config, {
    indent: 2,
    lineWidth: 120,
  });
}
