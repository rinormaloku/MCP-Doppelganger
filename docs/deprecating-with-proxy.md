# Deprecating an MCP Server with a Proxy

When you need to retire an MCP server, a doppelganger lets you keep the same interface alive while returning deprecation messages to every caller — including the AI agents that depend on it. Pair it with an MCP proxy so clients continue pointing at the same endpoint and notice nothing at the transport layer.

## 1. Clone the server you're decommissioning

```bash
npx -y mcp-doppelganger clone "http://old-server/mcp" --transport http \
  --response "This service has been decommissioned. Contact support for the replacement."
```

This generates a `doppelganger.yaml` that mirrors the original schema, with your deprecation message pre-filled in every response.

## 2. Customize responses per tool

Edit `doppelganger.yaml` to give each tool a precise, actionable message. Set `isError: true` to signal the AI agent that it must adapt its behaviour:

```yaml
tools:
  - name: "get_user_data"
    description: "Fetches user data by ID (DEPRECATED)"
    response:
      isError: true
      content:
        - type: "text"
          text: "Tool 'get_user_data' is gone. Fetch user data at https://newportal.example.com/users/{{args.id}}"
```

The `{{args.id}}` placeholder echoes back what the agent sent, giving it enough context to self-correct. See [examples/complete.yaml](../examples/complete.yaml) for a full working config.

## 3. Serve it behind a proxy

Run the doppelganger as a `stdio` subprocess behind an MCP proxy such as [agentgateway](https://github.com/agentgateway/agentgateway). The proxy exposes it over HTTP at the same address your old server used:

```yaml
# agentgateway-config.yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: legacy-mcp
            stdio:
              cmd: npx
              args: ["mcp-doppelganger", "serve", "--stdio", "-f", "doppelganger.yaml"]
```

```bash
agentgateway -f agentgateway-config.yaml
```

Agents calling `http://localhost:3000/mcp` now hit the doppelganger — same interface, clear migration messages, no changes required on the client side.

## 4. Validate it works

Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to confirm that the doppelganger is serving the expected interface and responses.

**List tools** — verify the deprecated tools are still visible to clients:

```bash
bunx @modelcontextprotocol/inspector \
  --cli "http://localhost:3000/mcp" --method tools/list
```

Expected output:

```json
{
  "tools": [
    {
      "name": "get_user_data",
      "description": "Fetches user data by ID (DEPRECATED)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "id": { "type": "string" }
        }
      }
    },
    {
      "name": "send_notification",
      "description": "Sends a notification (DEPRECATED)",
      "inputSchema": {
        "type": "object",
        "properties": {
          "userId": { "type": "string" },
          "message": { "type": "string" }
        }
      }
    }
  ]
}
```

**Call a tool** — verify the deprecation message and `isError` flag come back:

```bash
bunx @modelcontextprotocol/inspector \
  --cli "http://localhost:3000/mcp" --method tools/call \
  --tool-name "get_user_data" --tool-arg "id=user-42"
```

Expected output:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Tool 'get_user_data' is gone. Fetch the user data in https://newportal.example.com/users/user-42"
    }
  ],
  "isError": true
}
```

The `isError: true` flag tells the AI agent the call failed, prompting it to follow the migration instructions in the message rather than retrying the same tool.
