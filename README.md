# mcp-doppelganger

CLI utility to clone and shadow MCP (Model Context Protocol) server interfaces. Capture tool, resource, and prompt definitions from any MCP server, then serve a shadowed version with static, templated, or error responses - perfect for decommissioning or mocking.

## Installation

```bash
# Using bun
bun install

# Build the binary
bun run build:binary
```

## Usage

### Clone an MCP Server

Clone a server's interface to generate a doppelganger configuration:

```bash
# Clone via stdio transport
mcp-doppelganger clone "npx -y @modelcontextprotocol/server-everything" --transport stdio

# Clone via HTTP transport
mcp-doppelganger clone "http://localhost:3000/mcp" --transport http

# Output as JSON instead of YAML
mcp-doppelganger clone "npx -y @modelcontextprotocol/server-everything" --format json
```

### Serve a Doppelganger

Start a doppelganger MCP server from a configuration file:

```bash
# Serve with default config (doppelganger.yaml)
mcp-doppelganger serve

# Serve with specific config file
mcp-doppelganger serve -f my-config.yaml

# Serve from remote URL
mcp-doppelganger serve -f https://example.com/config.yaml

# Serve with HTTP transport
mcp-doppelganger serve --http -p 3000

# Serve with both stdio and HTTP
mcp-doppelganger serve --stdio --http
```

## Configuration

### Example `doppelganger.yaml`

```yaml
version: "2025-11-25"
server:
  name: "legacy-api-clone"
  description: "Shadowing the old Legacy API for migration."

tools:
  - name: "get_user_data"
    description: "Fetches user data by ID (DEPRECATED)"
    inputSchema:
      type: "object"
      properties:
        id:
          type: "string"
          description: "User ID"
      required:
        - "id"
    response:
      isError: true
      content:
        - type: "text"
          text: "Tool 'get_user_data' is gone. User {{args.id}} is now in the New Portal."

resources:
  - uri: "memories://current"
    name: "Short term memory"
    response:
      text: "Memory access is disabled on this legacy node."

prompts:
  - name: "generate_report"
    description: "Generate a report (DEPRECATED)"
    arguments:
      - name: "reportType"
        required: true
    response:
      messages:
        - role: "assistant"
          content:
            type: "text"
            text: "Reports are now at https://analytics.example.com for {{args.reportType}}."
```

### Template Variables

Use `{{args.propertyName}}` to inject incoming arguments into responses:

```yaml
text: "Hello {{args.name}}, your ID is {{args.id}}"
```

### Content Types

Supported content types in responses:
- `text` - Plain text content
- `image` - Base64 encoded image with mimeType
- `resource` - Embedded resource reference

## Docker

```bash
# Build the image
docker build -t mcp-doppelganger .

# Run with local config
docker run -v $(pwd)/config:/config mcp-doppelganger

# Run with remote config
docker run mcp-doppelganger serve -f https://example.com/config.yaml
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Type check
bun run typecheck

# Build
bun run build
bun run build:binary
```

## License

MIT
