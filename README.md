# MCP Doppelganger

<div align="center">
  <img src="https://github.com/rinormaloku/MCP-Doppelganger/blob/main/imgs/logo.png" height="200">
</div>

**Every MCP server has a doppelganger!**

A doppelganger is a mock [MCP](https://modelcontextprotocol.io/) server created from a simple config file. Use it to test AI agents, migrate away from a deprecated service, or simulate any MCP server locally. You can clone an existing server, modify the config to customize responses, and serve it.

## Quick Start

Start a mock MCP server using the [`doppelganger.yaml`](doppelganger.yaml) config included in this repo:

```bash
npx -y mcp-doppelganger serve -f https://raw.githubusercontent.com/rinormaloku/mcp-doppelganger/main/doppelganger.yaml
```

That's it. Test it immediately with [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
# List all tools
npx -y @modelcontextprotocol/inspector \
  --cli "http://localhost:3000/mcp" --transport http --method tools/list

# Call a tool
npx -y @modelcontextprotocol/inspector \
  --cli "http://localhost:3000/mcp" --transport http --method tools/call  --tool-name "hello_user" --tool-arg "username=user-42"
```

The server responds with whatever you defined in the config. No real backend required.

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
npx -y mcp-doppelganger serve -f doppelganger.yaml
```


## Configuration Reference

### Full example

See [examples/complete.yaml](examples/complete.yaml) for a complete config file you can use as a starting point.

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
          text: "Notifications tool moved to the new Messaging MCP. CANNOT notify {{args.userId}}: '{{args.message}}'"

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
            text: "Reports moved to https://analytics.example.com."
```

### Transport options

```bash
# stdio (default) — for use with AI agents and MCP clients
npx -y mcp-doppelganger serve --stdio -f doppelganger.yaml

# HTTP — for browser or REST-based access
npx -y mcp-doppelganger serve --http -p 3000 -f doppelganger.yaml

# Both at the same time
npx -y mcp-doppelganger serve --stdio --http -f doppelganger.yaml
```

## Docker

```bash
# Build
docker build -t mcp-doppelganger .

# Run with a local config file
docker run -v $(pwd):/config mcp-doppelganger serve -f /config/doppelganger.yaml

# Run with a remote config file
docker run mcp-doppelganger serve -f https://example.com/doppelganger.yaml
```

## CLI Command Reference

### `mcp-doppelganger clone`

Connects to a live MCP server and "studies" its schema to generate a configuration file.

| Option | Shorthand | Description | Default |
| --- | --- | --- | --- |
| `--transport` | `-t` | Transport type: `stdio` or `http` | `stdio` |
| `--output` | `-o` | Output file path | `doppelganger.yaml` |
| `--format` | `-f` | Output format: `yaml` or `json` | `yaml` |
| `--header` | `-H` | HTTP headers (repeatable for multiple) | `[]` |
| `--response` | `-r` | Default response text for all captured entities | `None` |

### `mcp-doppelganger serve`

Starts the doppelganger server to host your mock interface.

| Option | Shorthand | Description | Default |
| --- | --- | --- | --- |
| `--file` | `-f` | Path or URL to your configuration file | `doppelganger.yaml` |
| `--stdio` |  | Enable `stdio` transport (for local agent use) | `false` |
| `--http` |  | Enable HTTP transport (for browser/remote use) | `false` |
| `--port` | `-p` | Port used when HTTP transport is enabled | `3000` |


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
