/** Windowed history slices for prompts — newest first, budget-capped. */
import type { Campaign, LogEntry } from '../model/schemas';
import { truncateToTokens } from './budget';

function renderEntries(entries: LogEntry[], maxTokens: number): string {
  const lines = entries.map((e) => `Day ${e.day}: ${e.text}`);
  return truncateToTokens(lines.join('\n'), maxTokens);
}

/** Last `count` log entries (all kinds), oldest→newest for readability. */
export function recentLog(campaign: Campaign, count: number, maxTokens = 600): string {
  return renderEntries(campaign.log.slice(-count), maxTokens);
}

/**
 * Public statements involving a candidate (debate exchanges, event responses)
 * — what opponents can quote back at them.
 */
export function candidateStatements(
  campaign: Campaign,
  candidateId: string,
  count: number,
  maxTokens = 700,
): string {
  const entries = campaign.log
    .filter((e) => e.candidateId === candidateId && (e.kind === 'debate' || e.kind === 'event'))
    .slice(-count);
  return renderEntries(entries, maxTokens);
}

/** Transcript of the current debate's completed exchanges. */
export function debateTranscript(campaign: Campaign, debateId: string, maxTokens = 900): string {
  const debate = campaign.debates.find((d) => d.id === debateId);
  if (!debate) return '';
  const lines: string[] = [];
  for (const exchange of debate.exchanges) {
    if (!exchange.question || !exchange.answer) continue;
    const questioner = campaign.candidates.find((c) => c.id === exchange.questionerId)?.name ?? '?';
    const target = campaign.candidates.find((c) => c.id === exchange.targetId)?.name ?? '?';
    lines.push(
      `${questioner} asked ${target}: "${exchange.question}" — ${target}: "${exchange.answer}"`,
    );
  }
  return truncateToTokens(lines.join('\n'), maxTokens);
}
