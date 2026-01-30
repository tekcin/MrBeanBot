/**
 * Tool system entry point.
 * Re-exports the Tool namespace, registry, truncation, and built-in tools.
 */
export { Tool } from "./tool.js";
export { Truncate } from "./truncation.js";
export { ToolRegistry, type ToolDefinition } from "./registry.js";
export * from "./builtin/index.js";
