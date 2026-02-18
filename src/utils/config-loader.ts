import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { DoppelgangerConfigSchema, type DoppelgangerConfig } from "../types/config.js";

/**
 * Loads and validates a doppelganger configuration from a file path or URL
 */
export async function loadConfig(source: string): Promise<DoppelgangerConfig> {
  let content: string;

  if (isUrl(source)) {
    content = await fetchRemoteConfig(source);
  } else {
    content = await loadLocalConfig(source);
  }

  const parsed = parseConfigContent(content, source);
  return validateConfig(parsed);
}

function isUrl(source: string): boolean {
  return source.startsWith("http://") || source.startsWith("https://");
}

async function fetchRemoteConfig(url: string): Promise<string> {
  console.error(`Fetching remote config from: ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch remote config: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

async function loadLocalConfig(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }

  return readFile(filePath, "utf-8");
}

function parseConfigContent(
  content: string,
  source: string
): Record<string, unknown> {
  const isJson = source.endsWith(".json") || content.trim().startsWith("{");

  if (isJson) {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  try {
    return parseYaml(content);
  } catch (error) {
    throw new Error(
      `Failed to parse YAML config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function validateConfig(data: Record<string, unknown>): DoppelgangerConfig {
  const result = DoppelgangerConfigSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  return result.data;
}
