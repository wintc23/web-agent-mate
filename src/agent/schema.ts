import { z } from "zod";
import type { ToolDefinition } from "./protocol";

const schemas = new WeakMap<ToolDefinition, z.ZodObject>();
export function toolSchema(definition: ToolDefinition): z.ZodObject {
  let schema = schemas.get(definition);
  if (!schema) {
    const converted = z.fromJSONSchema(definition.parameters);
    if (!(converted instanceof z.ZodObject)) throw new Error("Tool schema must describe an object");
    schema = converted;
    schemas.set(definition, schema);
  }
  return schema;
}
export function validateToolArguments(tools: ToolDefinition[], name: string, args: unknown): void {
  const definition = tools.find(tool => tool.name === name);
  if (!definition) throw new Error("Unknown or unavailable tool");
  const result = toolSchema(definition).safeParse(args);
  if (!result.success) throw new Error(`Invalid tool arguments: ${result.error.issues.map(issue => `${issue.path.join(".") || "arguments"}: ${issue.message}`).join("; ")}`);
}
