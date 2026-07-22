/**
 * Zod schemas are the single source of truth for the domain model: every
 * entity type is inferred from its schema. The campaign schema doubles as the
 * save-file validator.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Fixed vocabularies
// ---------------------------------------------------------------------------

export const TOPIC_AREA_IDS = [
  'economy',
  'security',
  'health',
  'education',
  'culture',
  'environment',
] as const;
export const topicAreaIdSchema = z.enum(TOPIC_AREA_IDS);
export type TopicAreaId = z.infer<typeof topicAreaIdSchema>;

export const COUNCILOR_POSITION_IDS = [
  'campaignManager',
  'communicationsChief',
  'policyAdvisor',
] as const;
export const councilorPositionIdSchema = z.enum(COUNCILOR_POSITION_IDS);
export type CouncilorPositionId = z.infer<typeof councilorPositionIdSchema>;

/** Exhaustive per-topic numeric map (e.g. state topic weights). */
export const topicNumbersSchema = z.object({
  economy: z.number(),
  security: z.number(),
  health: z.number(),
  education: z.number(),
  culture: z.number(),
  environment: z.number(),
});
export type TopicNumbers = z.infer<typeof topicNumbersSchema>;

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const personFields = {
  id: z.string(),
  name: z.string(),
  age: z.number().int().min(18).max(99),
  gender: z.string(),
  bio: z.string(),
};

export const candidateSchema = z.object({
  ...personFields,
  partyId: z.string(),
});
export type Candidate = z.infer<typeof candidateSchema>;

export const agendaMatchSchema = z.object({
  publicScore: z.number().min(0).max(100),
  hiddenScore: z.number().min(0).max(100),
  commentary: z.string(),
});
export type AgendaMatch = z.infer<typeof agendaMatchSchema>;

export const councilorSchema = z.object({
  ...personFields,
  politicalViews: z.string(),
  personality: z.string(),
  positionId: councilorPositionIdSchema,
  agendaMatch: agendaMatchSchema.optional(),
});
export type Councilor = z.infer<typeof councilorSchema>;

export const councilorStateSchema = z.object({
  hired: z.record(z.string(), councilorSchema.nullable()),
  pool: z.record(z.string(), z.array(councilorSchema)),
});
export type CouncilorState = z.infer<typeof councilorStateSchema>;

export const influencerContentSchema = z.object({
  id: z.string(),
  day: z.number().int(),
  medium: z.string(),
  text: z.string(),
});
export type InfluencerContent = z.infer<typeof influencerContentSchema>;

export const influencerSchema = z.object({
  ...personFields,
  domain: z.string(),
  audience: z.string(),
  reach: z.number().min(1).max(100),
  /**
   * partyId → affinity 0–100; courting nudges this upward on failure. For an
   * influencer endorsing the player it doubles as their commitment level,
   * which further courting keeps deepening toward 100.
   */
  partyAffinity: z.record(z.string(), z.number()),
  endorsement: z
    .object({
      candidateId: z.string(),
      kind: z.literal('earned'),
      sinceDay: z.number().int(),
    })
    .optional(),
  /** Next day this endorsed influencer should produce content. */
  nextContentDay: z.number().int().optional(),
  /** Seeded roll outcome: the next content item hints at the hidden agenda. */
  nextContentHintsHidden: z.boolean().optional(),
  contentLog: z.array(influencerContentSchema),
});
export type Influencer = z.infer<typeof influencerSchema>;

// ---------------------------------------------------------------------------
// Party & nation
// ---------------------------------------------------------------------------

export const policySchema = z.object({
  topicAreaId: topicAreaIdSchema,
  title: z.string(),
  summary: z.string(),
});
export type Policy = z.infer<typeof policySchema>;

export const partySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().regex(/^\d{2}$/),
  colors: z.object({ main: z.string(), secondary: z.string() }),
  publicAgenda: z.string(),
  hiddenAgenda: z.string(),
  policies: z.array(policySchema),
});
export type Party = z.infer<typeof partySchema>;

export const nationStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cities: z.array(z.string()),
  /** Share of the national electorate; all states sum to 1. */
  populationWeight: z.number().min(0).max(1),
  /** How much this state cares about each topic; sums to 1. */
  topicWeights: topicNumbersSchema,
});
export type NationState = z.infer<typeof nationStateSchema>;

export const nationSchema = z.object({
  name: z.string(),
  description: z.string(),
  states: z.array(nationStateSchema),
});
export type Nation = z.infer<typeof nationSchema>;

// ---------------------------------------------------------------------------
// Opinion, impacts, surveys
// ---------------------------------------------------------------------------

/** approval[stateId][topicAreaId][candidateId] = 0..100 */
export const opinionStateSchema = z.object({
  approval: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.number()))),
});
export type OpinionState = z.infer<typeof opinionStateSchema>;

export const opinionImpactSchema = z.object({
  targetCandidateId: z.string(),
  deltas: z.array(z.object({ topicAreaId: topicAreaIdSchema, delta: z.number() })),
  regionalEmphasis: z.array(z.object({ stateId: z.string(), multiplier: z.number() })).optional(),
  rationale: z.string(),
});
export type OpinionImpact = z.infer<typeof opinionImpactSchema>;

export const surveySchema = z.object({
  id: z.string(),
  day: z.number().int(),
  /** candidateId → national voting-intention share (0–1). */
  national: z.record(z.string(), z.number()),
  /** stateId → candidateId → share (0–1). */
  byState: z.record(z.string(), z.record(z.string(), z.number())),
  /** topicAreaId → candidateId → national approval (0–100). */
  topicApproval: z.record(z.string(), z.record(z.string(), z.number())),
});
export type Survey = z.infer<typeof surveySchema>;

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const campaignEventSchema = z.object({
  id: z.string(),
  day: z.number().int(),
  title: z.string(),
  description: z.string(),
  topicAreaId: topicAreaIdSchema,
  stateId: z.string().optional(),
  options: z.array(z.string()),
  response: z.object({ text: z.string(), custom: z.boolean() }).optional(),
  evaluation: z.object({ impact: opinionImpactSchema, commentary: z.string() }).optional(),
});
export type CampaignEvent = z.infer<typeof campaignEventSchema>;

// ---------------------------------------------------------------------------
// Debates
// ---------------------------------------------------------------------------

export const debateExchangeSchema = z.object({
  id: z.string(),
  round: z.number().int(),
  topicAreaId: topicAreaIdSchema,
  questionerId: z.string(),
  targetId: z.string(),
  questionOptions: z.array(z.string()).optional(),
  question: z.string().optional(),
  answerOptions: z.array(z.string()).optional(),
  answer: z.string().optional(),
  evaluation: z
    .object({ impacts: z.array(opinionImpactSchema), commentary: z.string() })
    .optional(),
});
export type DebateExchange = z.infer<typeof debateExchangeSchema>;

export const debateSchema = z.object({
  id: z.string(),
  day: z.number().int(),
  rounds: z.number().int(),
  /** Questioner candidate ids, one entry per exchange, in speaking order. */
  order: z.array(z.string()),
  exchanges: z.array(debateExchangeSchema),
  status: z.enum(['active', 'finished']),
});
export type Debate = z.infer<typeof debateSchema>;

// ---------------------------------------------------------------------------
// Missions & days
// ---------------------------------------------------------------------------

export const missionAssignmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('campaignState'), stateId: z.string() }),
  z.object({ type: z.literal('promoteTopic'), topicAreaId: topicAreaIdSchema }),
  z.object({ type: z.literal('courtInfluencer'), influencerId: z.string() }),
  z.object({ type: z.literal('debatePrep') }),
]);
export type MissionAssignment = z.infer<typeof missionAssignmentSchema>;

export const missionStateSchema = z.object({
  /** positionId → today's assignment (only hired councilors act). */
  assignments: z.record(z.string(), missionAssignmentSchema.nullable()),
  /** Accumulated debate-prep bonus, consumed by the next debate. */
  debatePrepBonus: z.number().int(),
});
export type MissionState = z.infer<typeof missionStateSchema>;

export const dayRecordSchema = z.object({
  day: z.number().int(),
  eventPlanned: z.boolean(),
  eventId: z.string().optional(),
  debateId: z.string().optional(),
  surveyId: z.string().optional(),
  /** In-fiction narration of the day, generated after the day ends. */
  reportText: z.string().optional(),
  /** Plain factual outcome lines (missions, rival moves) feeding the report. */
  outcomes: z.array(z.string()),
});
export type DayRecord = z.infer<typeof dayRecordSchema>;

// ---------------------------------------------------------------------------
// Chat, log, results
// ---------------------------------------------------------------------------

export const chatMessageSchema = z.object({
  role: z.enum(['player', 'councilor']),
  text: z.string(),
  day: z.number().int(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatThreadSchema = z.object({
  councilorId: z.string(),
  messages: z.array(chatMessageSchema),
  pendingReply: z.boolean(),
});
export type ChatThread = z.infer<typeof chatThreadSchema>;

export const logEntrySchema = z.object({
  id: z.string(),
  day: z.number().int(),
  kind: z.enum(['debate', 'event', 'mission', 'influencer', 'rival', 'survey', 'system']),
  text: z.string(),
  topicAreaId: topicAreaIdSchema.optional(),
  candidateId: z.string().optional(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

export const electionResultSchema = z.object({
  /** stateId → candidateId → share (0–1). */
  stateResults: z.record(z.string(), z.record(z.string(), z.number())),
  national: z.record(z.string(), z.number()),
  ordering: z.array(z.string()),
  winnerId: z.string(),
  epilogue: z
    .object({
      advancementScore: z.number().min(0).max(100),
      justification: z.string(),
      text: z.string(),
    })
    .optional(),
});
export type ElectionResult = z.infer<typeof electionResultSchema>;

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export const campaignSettingsSchema = z.object({
  totalDays: z.number().int(),
  debateDays: z.array(z.number().int()),
  surveyInterval: z.number().int(),
  rivalCount: z.number().int(),
  stateCount: z.number().int(),
  councilorPoolSize: z.number().int(),
  influencerCount: z.number().int(),
  debateRounds: z.number().int(),
  eventChance: z.number(),
});
export type CampaignSettings = z.infer<typeof campaignSettingsSchema>;

export const campaignPhaseSchema = z.enum(['setup', 'running', 'finished']);
export type CampaignPhase = z.infer<typeof campaignPhaseSchema>;

export const campaignSchema = z.object({
  id: z.string(),
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  settings: campaignSettingsSchema,
  phase: campaignPhaseSchema,
  day: z.number().int(),
  rngState: z.number(),
  nation: nationSchema.nullable(),
  parties: z.array(partySchema),
  candidates: z.array(candidateSchema),
  playerPartyId: z.string(),
  playerCandidateId: z.string(),
  councilors: councilorStateSchema,
  influencers: z.array(influencerSchema),
  opinion: opinionStateSchema,
  surveys: z.array(surveySchema),
  events: z.array(campaignEventSchema),
  debates: z.array(debateSchema),
  chats: z.record(z.string(), chatThreadSchema),
  missions: missionStateSchema,
  days: z.array(dayRecordSchema),
  log: z.array(logEntrySchema),
  result: electionResultSchema.optional(),
});
export type Campaign = z.infer<typeof campaignSchema>;
