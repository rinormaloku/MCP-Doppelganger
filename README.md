# MCP Doppelganger

<div align="center">
  <img src="https://github.com/rinormaloku/MCP-Doppelganger/blob/main/imgs/logo.png" height="200">

[![NPM Version][npm-version-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
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
  instructions: "Returned as `instructions` in the MCP initialize result (optional)"

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
# HTTP (default) — for browser or REST-based access, endpoint http://localhost:3000/mcp
npx -y mcp-doppelganger serve --http -p 3000 -f doppelganger.yaml

# stdio — for use with AI agents and MCP clients
npx -y mcp-doppelganger serve --stdio -f doppelganger.yaml

# Both at the same time
npx -y mcp-doppelganger serve --stdio --http -f doppelganger.yaml
```

### Config from stdin

With no `-f` and a piped stdin, the config is read from stdin (`-f -` does the same explicitly), and `serve` is the default command. That gives one-command mock servers without fixture files, e.g. two servers for a repro:

```bash
npx -y mcp-doppelganger --http -p 3301 <<'EOF' &
server: {name: public, version: "1.0.0", instructions: "public instr"}
tools:
  - name: echo
    description: echo
    response: {content: [{type: text, text: hi}]}
EOF
npx -y mcp-doppelganger --http -p 3302 <<'EOF' &
server: {name: internal, version: "1.0.0", instructions: "internal secret instr"}
tools:
  - name: echo
    description: echo
    response: {content: [{type: text, text: hi}]}
EOF
```

The stdio transport uses stdin for the MCP protocol, so a stdin config cannot be combined with `--stdio`: it serves HTTP, and `--stdio` with `-f -` is an error. `--stdio` without `-f` still reads `doppelganger.yaml`.

Stop them with `kill %1 %2`: killing the PID from `$!` stops only the `npx` wrapper and leaves the server running.

## Example use case: Deprecating an MCP Server with a Proxy

A use case that inspired this package was to deprecate an existing MCP server and to inform AI agents using it about the deprecation and direct them to the new server or alternative solutions.

With this package all you need to do is clone the old server, customize deprecation messages per tool, and serve the doppelganger behind an MCP proxy. Clients keep hitting the same endpoint — the AI agents get clear instructions on where to migrate.

See the full walkthrough (including validation commands) in [docs/deprecating-with-proxy.md](docs/deprecating-with-proxy.md).

## Docker

```bash
docker build -t mcp-doppelganger .

# Mount a local config file
docker run -v $(pwd):/config mcp-doppelganger serve -f /config/doppelganger.yaml

# Pull config from a URL
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

Starts the doppelganger server to host your mock interface. `serve` is the default command, so `mcp-doppelganger --http -p 3000` works too.

| Option | Shorthand | Description | Default |
| --- | --- | --- | --- |
| `--file` | `-f` | Path or URL to your configuration file, or `-` for stdin | stdin when piped, else `doppelganger.yaml` |
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

<!-- Badges -->
[npm-version-image]: https://img.shields.io/npm/v/mcp-doppelganger
[npm-downloads-image]: https://img.shields.io/npm/dw/mcp-doppelganger
[npm-url]: https://www.npmjs.com/package/mcp-doppelganger
