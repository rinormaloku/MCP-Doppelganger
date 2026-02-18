import { z } from "zod";

export const ContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    data: z.string(),
    mimeType: z.string(),
  }),
  z.object({
    type: z.literal("resource"),
    resource: z.object({
      uri: z.string(),
      text: z.string().optional(),
      blob: z.string().optional(),
      mimeType: z.string().optional(),
    }),
  }),
]);

export const ToolResponseSchema = z.object({
  isError: z.boolean().optional().default(false),
  content: z.array(ContentBlockSchema),
});

export const ToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.any()).optional().default({
    type: "object",
    properties: {},
  }),
  response: ToolResponseSchema,
});

export const ResourceResponseSchema = z.object({
  text: z.string().optional(),
  blob: z.string().optional(),
  mimeType: z.string().optional(),
});

export const ResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  response: ResourceResponseSchema,
});

export const ResourceTemplateSchema = z.object({
  uriTemplate: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  response: ResourceResponseSchema,
});

export const PromptArgumentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional().default(false),
});

export const PromptMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: ContentBlockSchema,
});

export const PromptResponseSchema = z.object({
  description: z.string().optional(),
  messages: z.array(PromptMessageSchema),
});

export const PromptSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  arguments: z.array(PromptArgumentSchema).optional().default([]),
  response: PromptResponseSchema,
});

export const ServerConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional().default("1.0.0"),
});

export const DoppelgangerConfigSchema = z.object({
  version: z.string().default("2025-11-25"),
  server: ServerConfigSchema,
  tools: z.array(ToolSchema).optional().default([]),
  resources: z.array(ResourceSchema).optional().default([]),
  resourceTemplates: z.array(ResourceTemplateSchema).optional().default([]),
  prompts: z.array(PromptSchema).optional().default([]),
});

export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type ToolResponse = z.infer<typeof ToolResponseSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type ResourceResponse = z.infer<typeof ResourceResponseSchema>;
export type Resource = z.infer<typeof ResourceSchema>;
export type ResourceTemplate = z.infer<typeof ResourceTemplateSchema>;
export type PromptArgument = z.infer<typeof PromptArgumentSchema>;
export type PromptMessage = z.infer<typeof PromptMessageSchema>;
export type PromptResponse = z.infer<typeof PromptResponseSchema>;
export type Prompt = z.infer<typeof PromptSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type DoppelgangerConfig = z.infer<typeof DoppelgangerConfigSchema>;
