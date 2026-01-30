/**
 * Session compaction (message history summarization) settings.
 */
export type CompactionConfig = {
  /** Enable automatic compaction when context grows large. Default: true. */
  enabled?: boolean;
  /** Context token threshold to trigger compaction. Default: 80% of model context. */
  threshold?: number;
};
