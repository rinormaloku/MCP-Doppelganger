import { test, expect } from "bun:test";

const CLI = ["bun", "run", `${import.meta.dir}/../src/index.ts`];
const CONFIG = `server: {name: t, version: "1.0.0", instructions: "hello instr"}
tools:
  - name: echo
    response: {content: [{type: text, text: hi}]}
`;

async function initialize(port: number) {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
    }),
  });
  const body = await res.text();
  const data = body.match(/^data:\s*(.+)$/m)?.[1] ?? body;
  return JSON.parse(data);
}

test("config from stdin, default command, server.instructions in initialize", async () => {
  const port = 38000 + Math.floor(Math.random() * 1000);
  const proc = Bun.spawn([...CLI, "-p", String(port)], { stdin: new Blob([CONFIG]), stderr: "pipe" });
  try {
    for (let i = 0; i < 100; i++) {
      try {
        const msg = await initialize(port);
        expect(msg.result.instructions).toBe("hello instr");
        return;
      } catch (e) {
        if (i === 99) throw e;
        await Bun.sleep(100);
      }
    }
  } finally {
    proc.kill();
  }
});

test("stdin config with --stdio is rejected", async () => {
  const proc = Bun.spawn([...CLI, "serve", "--stdio", "-f", "-"], { stdin: new Blob([CONFIG]), stderr: "pipe" });
  expect(await proc.exited).toBe(1);
  expect(await new Response(proc.stderr).text()).toContain("cannot be combined with --stdio");
});

test("empty stdin without -f is a clear error", async () => {
  const proc = Bun.spawn([...CLI, "serve"], { stdin: new Blob([""]), stderr: "pipe", cwd: import.meta.dir });
  expect(await proc.exited).toBe(1);
  expect(await new Response(proc.stderr).text()).toContain("No config on stdin");
});
