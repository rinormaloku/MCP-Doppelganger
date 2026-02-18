import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { stringify as stringifyYaml } from "yaml";
import type { DoppelgangerConfig, Tool, Resource, ResourceTemplate, Prompt } from "../types/config.js";

export interface CloneOptions {
  transport: "stdio" | "http";
  output?: string;
  format?: "yaml" | "json";
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

  let transport: StdioClientTransport | SSEClientTransport;

  if (options.transport === "http") {
    transport = new SSEClientTransport(new URL(target));
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

    const config = await extractServerSchema(client, serverInfo);
    const output = formatOutput(config, options.format || "yaml");

    const outputFile = options.output || "doppelganger.yaml";
    await Bun.write(outputFile, output);
    console.error(`\nConfiguration written to: ${outputFile}`);

    await client.close();
  } catch (error) {
    console.error("Error cloning server:", error);
    throw error;
  }
}

async function extractServerSchema(
  client: Client,
  serverInfo: { name?: string; version?: string } | undefined
): Promise<DoppelgangerConfig> {
  const tools: Tool[] = [];
  const resources: Resource[] = [];
  const resourceTemplates: ResourceTemplate[] = [];
  const prompts: Prompt[] = [];

  // Fetch tools
  try {
    const toolsResult = await client.listTools();
    console.error(`Found ${toolsResult.tools.length} tools`);

    for (const tool of toolsResult.tools) {
      tools.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
        response: {
          isError: true,
          content: [
            {
              type: "text",
              text: `Tool '${tool.name}' has been decommissioned. Please use the new API.`,
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
          text: `Resource '${resource.name}' is no longer available.`,
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
          text: `Resource template '${template.name}' is no longer available.`,
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
        arguments: prompt.arguments?.map((arg) => ({
          name: arg.name,
          description: arg.description,
          required: arg.required || false,
        })) || [],
        response: {
          description: prompt.description,
          messages: [
            {
              role: "assistant",
              content: {
                type: "text",
                text: `Prompt '${prompt.name}' has been decommissioned.`,
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
