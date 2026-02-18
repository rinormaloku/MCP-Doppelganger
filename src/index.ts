#!/usr/bin/env bun
import { Command } from "commander";
import { cloneCommand } from "./commands/clone.js";
import { serveCommand } from "./commands/serve.js";

const program = new Command();

program
  .name("mcp-doppelganger")
  .description("Clone and shadow MCP server interfaces")
  .version("1.0.0");

// Collect multiple --header options into an array
function collectHeaders(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

// Clone command
program
  .command("clone <target>")
  .description("Clone an MCP server's interface")
  .option("-t, --transport <type>", "Transport type (stdio or http)", "stdio")
  .option("-o, --output <file>", "Output file path", "doppelganger.yaml")
  .option("-f, --format <format>", "Output format (yaml or json)", "yaml")
  .option("-H, --header <header>", "HTTP header (can be repeated, e.g., -H \"Authorization: Bearer $TOKEN\")", collectHeaders, [])
  .option("-r, --response <text>", "Default response text for all tools, resources, and prompts")
  .action(async (target: string, options) => {
    try {
      await cloneCommand(target, {
        transport: options.transport as "stdio" | "http",
        output: options.output,
        format: options.format as "yaml" | "json",
        headers: options.header,
        response: options.response,
      });
    } catch (error) {
      console.error("Clone failed:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Serve command
program
  .command("serve")
  .description("Start a doppelganger MCP server")
  .option("-f, --file <path>", "Configuration file path or URL", "doppelganger.yaml")
  .option("--stdio", "Enable stdio transport")
  .option("--http", "Enable HTTP transport")
  .option("-p, --port <number>", "HTTP port", "3000")
  .action(async (options) => {
    try {
      await serveCommand({
        file: options.file,
        stdio: options.stdio,
        http: options.http,
        port: parseInt(options.port, 10),
      });
    } catch (error) {
      console.error("Serve failed:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Default command (serve with defaults)
program.action(async () => {
  try {
    await serveCommand({});
  } catch (error) {
    console.error("Serve failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
});

program.parse();
