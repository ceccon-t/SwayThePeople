/**
 * Generation-job vocabulary. Every piece of LLM-generated content in the game
 * corresponds to exactly one job type; jobs are derived from campaign state
 * (see needs.ts), queued in the main process, and applied back through the
 * command reducer.
 */
import type { CouncilorPositionId } from '../model/schemas';

export const JOB_TYPES = [
  'world.generate',
  'rival.generate',
  'party.policies',
  'opinion.seed',
  'councilor.pool',
  'councilor.match',
  'influencers.generate',
  'event.generate',
  'event.evaluate',
  'day.report',
  'chat.reply',
  'influencer.content',
  'debate.playerQuestionOptions',
  'debate.rivalQuestion',
  'debate.playerAnswerOptions',
  'debate.rivalAnswer',
  'debate.evaluate',
  'debate.rivalExchange',
  'election.epilogue',
] as const;
export type JobType = (typeof JOB_TYPES)[number];

/** interactive: the player is waiting on it right now; high: gates progress
 *  soon; background: quality-of-life prefetch. */
export type JobPriority = 'interactive' | 'high' | 'background';

interface DebateJobPayload {
  debateId: string;
  exchangeId: string;
}

export interface JobPayloads {
  'world.generate': Record<string, never>;
  'rival.generate': { index: number };
  'party.policies': { partyId: string };
  'opinion.seed': { candidateId: string };
  'councilor.pool': { positionId: CouncilorPositionId; count: number };
  'councilor.match': { positionId: CouncilorPositionId; councilorIds: string[] };
  'influencers.generate': { count: number };
  'event.generate': { day: number };
  'event.evaluate': { eventId: string };
  'day.report': { day: number };
  'chat.reply': { councilorId: string; messageCount: number };
  'influencer.content': { influencerId: string; day: number };
  'debate.playerQuestionOptions': DebateJobPayload;
  'debate.rivalQuestion': DebateJobPayload;
  'debate.playerAnswerOptions': DebateJobPayload;
  'debate.rivalAnswer': DebateJobPayload;
  'debate.evaluate': DebateJobPayload;
  'debate.rivalExchange': DebateJobPayload;
  'election.epilogue': Record<string, never>;
}

export interface JobRequest<T extends JobType = JobType> {
  /** Stable identity for deduplication; derived from type + payload. */
  key: string;
  type: T;
  priority: JobPriority;
  payload: JobPayloads[T];
}

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface JobSnapshot {
  key: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  error?: string;
  /** Short human label for UI ("Generating rival candidate 2/3…"). */
  label: string;
}
