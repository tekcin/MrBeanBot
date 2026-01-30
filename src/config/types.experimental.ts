/**
 * Experimental feature flags.
 * These may change or be removed in future versions.
 */
export type ExperimentalConfig = {
  /** Enable the batch tool for parallel tool execution. */
  batchTool?: boolean;
  /** Continue the LLM loop after a permission deny (instead of stopping). */
  continueLoopOnDeny?: boolean;
  /** Enable OpenTelemetry integration. */
  openTelemetry?: boolean;
  /** Override max output tokens for LLM responses. */
  outputTokenMax?: number;
};
