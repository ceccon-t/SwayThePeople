/**
 * Token budgeting. Models are assumed to have ~32K-token contexts; prompts
 * target ≤ ~12K input tokens. Estimation uses the chars/4 heuristic.
 */

export const INPUT_TOKEN_BUDGET = 12000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface PromptSection {
  text: string;
  /** Optional sections are dropped (last first) when over budget. */
  optional?: boolean;
}

/**
 * Join sections, dropping optional ones from the end until the estimate fits
 * the budget. Never drops required sections; if still over, returns anyway
 * (adapters/models truncate as a last resort) — callers keep required
 * content compact by construction.
 */
export function composeSections(sections: PromptSection[], budget = INPUT_TOKEN_BUDGET): string {
  const kept = [...sections];
  const render = (): string =>
    kept
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join('\n\n');
  let text = render();
  while (estimateTokens(text) > budget) {
    const lastOptional = [...kept].reverse().find((s) => s.optional);
    if (!lastOptional) break;
    kept.splice(kept.indexOf(lastOptional), 1);
    text = render();
  }
  return text;
}

/** Truncate a text block to roughly the given token count (word boundary). */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).replace(/\s+\S*$/, '')} …`;
}
