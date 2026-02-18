# MCP Doppelganger

<div align="center">
  <img src="https://raw.githubusercontent.com/rinormaloku/mcp-doppelganger/imgs/logo.png" height="200">
</div>

**Every MCP server can have a doppelganger.**

A doppelganger is a mock [Model Context Protocol](https://modelcontextprotocol.io/) server created from a simple config file. Use it to test AI agents, migrate away from a deprecated service, or simulate any MCP server locally. You can clone an existing server, modify the config to customize responses, and serve it, no coding or real backend required.

---

## Quick Start

Start a mock MCP server using the [example config](examples/doppelganger.yaml) included in this repo:

```bash
npx -y mcp-doppelganger serve --stdio -f https://raw.githubusercontent.com/rinor/mcp-doppelganger/main/examples/doppelganger.yaml
```

That's it. Test it immediately with [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
# List all tools
npx -y @modelcontextprotocol/inspector --cli \
  --transport stdio \
  'npx -y mcp-doppelganger serve --stdio -f https://raw.githubusercontent.com/rinor/mcp-doppelganger/main/examples/doppelganger.yaml' \
  --method "tools/list"

# Call a tool
npx -y @modelcontextprotocol/inspector --cli \
  --transport stdio \
  'npx -y mcp-doppelganger serve --stdio -f https://raw.githubusercontent.com/rinor/mcp-doppelganger/main/examples/doppelganger.yaml' \
  --method "tools/call" \
  --tool-name "get_user_data" \
  --tool-arg "id=user-42"
```

The server responds with whatever you defined in the config — no real backend required.

---

## Clone an Existing MCP Server

Want to create a fake version of a real server? Use the `clone` command. It connects to the real server, reads all its tools, resources, and prompts, and writes a `doppelganger.yaml` for you.

```bash
# Clone a server running via stdio
npx -y mcp-doppelganger clone "npx -y @modelcontextprotocol/server-everything"

# Clone a server running over HTTP
npx -y mcp-doppelganger clone "http://localhost:3000/mcp" --transport http

# Clone with authentication
npx -y mcp-doppelganger clone "http://localhost:3000/mcp" --transport http \
  -H "Authorization: Bearer $TOKEN"

# Set a default response message for every tool, resource, and prompt
npx -y mcp-doppelganger clone "npx -y @modelcontextprotocol/server-everything" \
  --response "This service has been decommissioned. Please contact support."
```

Edit the generated file to customize responses, then serve it:

```bash
npx -y mcp-doppelganger serve --stdio -f doppelganger.yaml
```

---

## Configuration Reference

### Full example

See [examples/doppelganger.yaml](examples/doppelganger.yaml) for a complete config file you can use as a starting point.

```yaml
version: "2025-11-25"
server:
  name: "my-fake-server"
  description: "Description shown to the AI agent"
  version: "1.0.0"

tools:
  - name: "send_notification"
    description: "Sends a notification (DEPRECATED)"
    inputSchema:
      type: "object"
      properties:
        userId:
          type: "string"
        message:
          type: "string"
    response:
      isError: true
      content:
        - type: "text"
          text: "Notifications moved to the new Messaging Service. Tried to notify {{args.userId}}: '{{args.message}}'"

resources:
  - uri: "config://app"
    name: "Application Config"
    mimeType: "application/json"
    response:
      text: '{"status": "deprecated", "migration": "Use environment variables instead"}'
      mimeType: "application/json"

prompts:
  - name: "generate_report"
    description: "Generate a report (DEPRECATED)"
    arguments:
      - name: "reportType"
      - name: "dateRange"
    response:
      messages:
        - role: "assistant"
          content:
            type: "text"
            text: "Reports moved to https://analytics.example.com. Requested: {{args.reportType}}"
```

### Template variables

Use `{{args.paramName}}` anywhere in a response to include the value sent by the caller:

```yaml
text: "Hello {{args.name}}, your account ID is {{args.id}}"
```

> **Note:** All parameters are treated as optional. This ensures the server always returns a response instead of failing with a validation error.

### Transport options

```bash
# stdio (default) — for use with AI agents and MCP clients
npx -y mcp-doppelganger serve --stdio -f doppelganger.yaml

# HTTP — for browser or REST-based access
npx -y mcp-doppelganger serve --http -p 3000 -f doppelganger.yaml

# Both at the same time
npx -y mcp-doppelganger serve --stdio --http -f doppelganger.yaml
```

---

## Docker

```bash
# Build
docker build -t mcp-doppelganger .

# Run with a local config file
docker run -v $(pwd):/config mcp-doppelganger serve -f /config/doppelganger.yaml

# Run with a remote config file
docker run mcp-doppelganger serve -f https://example.com/doppelganger.yaml
```

---

## Development

```bash
# Install dependencies
bun install

# Run locally
bun run dev

# Type check
bun run typecheck

# Build
bun run build
```

---

## License

MIT
