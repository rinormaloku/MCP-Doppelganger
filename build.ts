import { write, file } from "bun";
import { chmodSync, statSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ENTRY_POINT = "./src/index.ts";
const DIST_DIR = "./dist";
const JS_NAME = "index.js";
const BINARY_NAME = "mcp-doppelganger";

const EXTERNALS = [
  "typeorm",
  "@nestjs/websockets/socket-module",
  "@nestjs/microservices",
  "@nestjs/microservices/microservices-module",
  "@nestjs/typeorm",
  "class-transformer",
  "class-validator",
];

// Clean and recreate dist/
rmSync(DIST_DIR, { recursive: true, force: true });
mkdirSync(DIST_DIR, { recursive: true });

console.log("🚀 Building...");

// Build 1: Node-compatible JS bundle (for npx / npm install)
const jsResult = await Bun.build({
  entrypoints: [ENTRY_POINT],
  outdir: DIST_DIR,
  target: "node",
  minify: true,
  external: EXTERNALS,
});

if (!jsResult.success) {
  console.error("❌ JS build failed:", jsResult.logs);
  process.exit(1);
}

// Replace Bun's shebang with a Node-compatible one so npx/node can execute it
const outPath = `${DIST_DIR}/${JS_NAME}`;
const content = await file(outPath).text();
const fixed = content.startsWith("#!")
  ? content.replace(/^#!.*\n/, "#!/usr/bin/env node\n")
  : `#!/usr/bin/env node\n${content}`;
await write(outPath, fixed);
chmodSync(outPath, 0o755);

// Build 2: Self-contained binary (for container images / direct installs)
// Uses Bun.spawnSync (not the $ template) to avoid subprocess hanging issues
const binaryOut = resolve(`${DIST_DIR}/${BINARY_NAME}`);
const binProc = Bun.spawnSync([
  "bun", "build", "--compile", "--minify",
  ...EXTERNALS.flatMap(e => ["--external", e]),
  ENTRY_POINT, "--outfile", binaryOut,
], { stdout: "inherit", stderr: "inherit" });

const binResult = { success: binProc.exitCode === 0 };

if (!binResult.success) {
  console.error("❌ Binary build failed:", binResult.logs);
  process.exit(1);
}

const jsSize = (statSync(outPath).size / 1024).toFixed(2);
const binSize = (statSync(`${DIST_DIR}/${BINARY_NAME}`).size / (1024 * 1024)).toFixed(2);
console.log(`
✨ Build Successful!
📦 NPX script: ${DIST_DIR}/${JS_NAME} (${jsSize} KB)
🤖 Binary:     ${DIST_DIR}/${BINARY_NAME} (${binSize} MB)
`);