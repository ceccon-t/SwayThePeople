/** Budget-capped prompt history drawn from public records and campaign logs. */
import type { Campaign, DebateExchange, LogEntry, TopicAreaId } from '../model/schemas';
import { estimateTokens, truncateToTokens } from './budget';

function renderEntries(entries: Pick<LogEntry, 'day' | 'text'>[], maxTokens: number): string {
  const lines = entries.map((e) => `Day ${e.day}: ${e.text}`);
  return truncateToTokens(lines.join('\n'), maxTokens);
}

/** Last `count` log entries (all kinds), oldest→newest for readability. */
export function recentLog(campaign: Campaign, count: number, maxTokens = 600): string {
  return renderEntries(campaign.log.slice(-count), maxTokens);
}

/**
 * Actual public responses, with their question or event title for context.
 * Verdicts and unchosen suggestions are not statements. Debate attribution
 * remains answerer-only; matching topics come first, newest within each group.
 */
export function candidateStatements(
  campaign: Campaign,
  candidateId: string,
  topicAreaId: TopicAreaId,
  count: number,
  maxTokens = 700,
): string {
  const entries: { day: number; topicAreaId: TopicAreaId; text: string }[] = [];
  for (const debate of campaign.debates) {
    for (const exchange of debate.exchanges) {
      // Previously logged only after evaluation: do not present the current
      // answer to its evaluator as an earlier commitment.
      if (
        exchange.targetId !== candidateId ||
        !exchange.evaluation ||
        !exchange.question ||
        !exchange.answer
      ) {
        continue;
      }
      entries.push({
        day: debate.day,
        topicAreaId: exchange.topicAreaId,
        text: renderExchange(campaign, exchange),
      });
    }
  }
  if (candidateId === campaign.playerCandidateId) {
    for (const event of campaign.events) {
      if (!event.response) continue;
      entries.push({
        day: event.day,
        topicAreaId: event.topicAreaId,
        text: `Responding to “${event.title}”: ${event.response.text}`,
      });
    }
  }
  // Events and debates occur on separate days. Stable sorting after reversal
  // also keeps later exchanges first within a debate, without changing state.
  entries.reverse().sort((left, right) => right.day - left.day);
  const matching = entries.filter((entry) => entry.topicAreaId === topicAreaId);
  const other = entries.filter((entry) => entry.topicAreaId !== topicAreaId);
  return renderEntries([...matching, ...other].slice(0, count), maxTokens);
}

function renderExchange(campaign: Campaign, exchange: DebateExchange): string {
  const questioner = campaign.candidates.find(
    (candidate) => candidate.id === exchange.questionerId,
  );
  const target = campaign.candidates.find((candidate) => candidate.id === exchange.targetId);
  return `${questioner?.name ?? '?'} asked ${target?.name ?? '?'}: "${exchange.question}" — ${target?.name ?? '?'}: "${exchange.answer}"`;
}

/** Prefer recent whole exchanges, displayed oldest→newest for readability. */
export function debateTranscript(campaign: Campaign, debateId: string, maxTokens = 900): string {
  const debate = campaign.debates.find((d) => d.id === debateId);
  if (!debate) return '';
  let transcript = '';
  for (const exchange of [...debate.exchanges].reverse()) {
    if (!exchange.question || !exchange.answer) continue;
    const line = renderExchange(campaign, exchange);
    const nextTranscript = transcript ? `${line}\n${transcript}` : line;
    // Skip exchanges that do not fit rather than separating a question from
    // its answer. Older, shorter exchanges may still fit the remaining space.
    if (estimateTokens(nextTranscript) > maxTokens) continue;
    transcript = nextTranscript;
  }
  return transcript;
}
