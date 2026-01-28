import type { MrBeanBotPluginApi } from "../../src/plugins/types.js";

import { createLlmTaskTool } from "./src/llm-task-tool.js";

export default function register(api: MrBeanBotPluginApi) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
