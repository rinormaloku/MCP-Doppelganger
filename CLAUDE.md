# CLAUDE.md

## Project Overview

`mcp-doppelganger` is a CLI utility that clones and shadows MCP (Model Context Protocol) server interfaces. It captures tool, resource, and prompt definitions from any MCP server and allows serving a shadowed version with static, templated, or error responses - useful for decommissioning legacy APIs or creating mocks.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.26.0
- **CLI Framework**: Commander.js ^14.0.3
- **Validation**: Zod ^4.3.6
- **Config Parsing**: yaml ^2.8.2

## Project Structure

```
src/
├── index.ts              # CLI entry point with Commander.js setup
├── commands/
│   ├── clone.ts          # Clone command - captures MCP server schema
│   └── serve.ts          # Serve command - runs doppelganger MCP server
├── types/
│   └── config.ts         # Zod schemas for doppelganger.yaml validation
└── utils/
    ├── config-loader.ts  # Loads local/remote YAML/JSON configs
    └── template.ts       # {{args.x}} template interpolation
```

## Common Commands

```bash
# Install dependencies
bun install

# Type check
bun run typecheck

# Run in development
bun run dev

# Build to dist/
bun run build

# Build standalone binary
bun run build:binary

# Run directly
bun run src/index.ts <command>
```

## CLI Usage

### Clone Command
Connects to an MCP server and extracts its schema into a `doppelganger.yaml` file:

```bash
# Stdio transport (default)
mcp-doppelganger clone "npx -y @modelcontextprotocol/server-everything"

# HTTP transport with JWT auth
mcp-doppelganger clone "http://localhost:3000/mcp" -t http -H "Authorization: Bearer $TOKEN"

# Custom default response for all tools/resources/prompts
mcp-doppelganger clone "npx -y @modelcontextprotocol/server-everything" \
  --response "This service has been deprecated."
```

### Serve Command
Starts an MCP server from a configuration file:

```bash
# HTTP transport (default)
mcp-doppelganger serve -f doppelganger.yaml

# Stdio transport
mcp-doppelganger serve --stdio

# Both transports
mcp-doppelganger serve --stdio --http -p 3000
```

## Configuration Schema

The `doppelganger.yaml` configuration follows this structure:

```yaml
version: "2025-11-25"
server:
  name: "server-name"
  description: "optional description"
  version: "1.0.0"

tools:
  - name: "tool_name"
    description: "Tool description"
    inputSchema:
      type: "object"
      properties:
        param: { type: "string" }
    response:
      isError: true  # triggers LLM error-handling
      content:
        - type: "text"
          text: "Response with {{args.param}} interpolation"

resources:
  - uri: "resource://uri"
    name: "Resource Name"
    response:
      text: "Static response"
      mimeType: "text/plain"

prompts:
  - name: "prompt_name"
    arguments:
      - name: "arg1"
    response:
      messages:
        - role: "assistant"
          content:
            type: "text"
            text: "Response with {{args.arg1}}"
```

**Important:** All tool parameters and prompt arguments are optional. The `required` field is intentionally not used - this ensures tool calls always succeed and return the configured response rather than failing validation.

## Key Implementation Details

### Template Interpolation
The `{{args.propertyName}}` syntax in response texts gets replaced with actual argument values at runtime. Supports nested paths like `{{args.user.id}}`.

### Transport Support
- **Serve**: Uses `WebStandardStreamableHTTPServerTransport` for HTTP and `StdioServerTransport` for stdio
- **Clone**: Uses `StreamableHTTPClientTransport` for HTTP (not SSE) and `StdioClientTransport` for stdio

### Remote Config
The serve command supports loading configs from URLs:
```bash
mcp-doppelganger serve -f https://example.com/config.yaml
```

### Zod v4 Compatibility
The project uses Zod v4 which has breaking changes from v3:
- `z.record()` requires two arguments: `z.record(z.string(), z.any())`
- Error access uses `.issues` not `.errors`
- Type inference works the same with `z.infer<typeof Schema>`

### MCP SDK Zod Compatibility
The MCP SDK supports both Zod v3 and v4. When creating schemas for `registerTool` or `registerPrompt`, use `z.ZodType<any, any, any>` for type annotations to ensure compatibility.

## Docker

```bash
# Build
docker build -t mcp-doppelganger .

# Run with config volume
docker run -v $(pwd)/config:/config mcp-doppelganger serve -f /config/doppelganger.yaml
```

## Default Behaviors

- **Clone output**: `doppelganger.yaml` (use `-o` to change)
- **Clone format**: YAML (use `-f json` for JSON)
- **Clone transport**: stdio (use `-t http` for HTTP)
- **Clone response**: Placeholder text (use `-r/--response` to customize)
- **Serve config**: `doppelganger.yaml` (use `-f` to change)
- **Serve transport**: HTTP on port 3000 (use `--stdio` for stdio only)
- **Serve port**: 3000 (use `-p` to change)
- **Serve idle timeout**: 255 seconds (maximum allowed by Bun)

## Content Block Types

Supported in tool and prompt responses:
- `text`: `{ type: "text", text: "content" }`
- `image`: `{ type: "image", data: "base64", mimeType: "image/png" }`
- `resource`: `{ type: "resource", resource: { uri: "...", text: "..." } }`

## Error Responses

Set `isError: true` in tool responses to signal to LLMs that the tool call failed, triggering their error-handling/self-correction behavior. This is useful for deprecation messages.
