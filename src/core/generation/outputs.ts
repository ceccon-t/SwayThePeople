/**
 * Zod schemas for structured LLM outputs, plus tolerant JSON extraction.
 * Schemas are deliberately lenient (coerced numbers, name-based references);
 * apply.ts maps names to entities and clamps every number.
 */
import { z } from 'zod';
import type { JobType } from './jobs';

/** Extract and parse the first JSON object from a raw model response. */
export function parseJsonLoose(text: string): unknown {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

const num = z.coerce.number();
// NOT z.coerce.string(): that would turn a missing field into "undefined".
const str = z.string();
/** Lenient for fields where models plausibly return numbers (party codes). */
const strOrNum = z.union([z.string(), z.number()]).transform(String);

const personShape = {
  name: str.min(1),
  age: num,
  gender: str,
  bio: str,
};

export const worldGenOutputSchema = z.object({
  nationName: str.min(1),
  nationDescription: str,
  states: z
    .array(
      z.object({
        name: str.min(1),
        description: str,
        cities: z.array(str).default([]),
        populationWeight: num,
        topicWeights: z.object({
          economy: num,
          security: num,
          health: num,
          education: num,
          culture: num,
          environment: num,
        }),
      }),
    )
    .min(3),
});

export const rivalGenOutputSchema = z.object({
  party: z.object({
    name: str.min(1),
    code: strOrNum,
    colors: z.object({ main: str, secondary: str }),
    publicAgenda: str.min(1),
    hiddenAgenda: str.min(1),
  }),
  candidate: z.object(personShape),
});

export const policiesOutputSchema = z.object({
  policies: z.array(z.object({ topic: str, title: str.min(1), summary: str.min(1) })).min(1),
});

export const opinionSeedOutputSchema = z.object({
  topicScores: z.object({
    economy: num,
    security: num,
    health: num,
    education: num,
    culture: num,
    environment: num,
  }),
  stateAffinities: z.array(z.object({ state: str, affinity: num })).default([]),
});

export const councilorPoolOutputSchema = z.object({
  candidates: z.array(z.object({ ...personShape, politicalViews: str, personality: str })).min(1),
});

export const councilorMatchOutputSchema = z.object({
  evaluations: z
    .array(
      z.object({
        name: str,
        publicScore: num,
        hiddenScore: num,
        commentary: str,
      }),
    )
    .min(1),
});

export const influencersOutputSchema = z.object({
  influencers: z
    .array(
      z.object({
        ...personShape,
        domain: str,
        audience: str,
        reach: num,
        partyAffinities: z.array(z.object({ party: str, affinity: num })).default([]),
      }),
    )
    .min(1),
});

export const eventGenOutputSchema = z.object({
  title: str.min(1),
  description: str.min(1),
  topic: str,
  state: str.nullish(),
  options: z.array(str.min(1)).min(2),
});

/** Impact as the LLM expresses it: names, not ids. */
export const rawImpactSchema = z.object({
  target: str.nullish(),
  deltas: z.array(z.object({ topic: str, delta: num })).min(1),
  statesEmphasis: z.array(z.object({ state: str, multiplier: num })).nullish(),
  rationale: str.default(''),
});
export type RawImpact = z.infer<typeof rawImpactSchema>;

export const eventEvalOutputSchema = z.object({
  impact: rawImpactSchema,
  commentary: str.default(''),
});

export const optionsOutputSchema = z.object({
  options: z.array(str.min(1)).min(2),
});

export const questionOutputSchema = z.object({ question: str.min(1) });
export const answerOutputSchema = z.object({ answer: str.min(1) });

export const debateEvalOutputSchema = z.object({
  impacts: z.array(rawImpactSchema).min(1),
  commentary: str.default(''),
});

export const rivalExchangeOutputSchema = z.object({
  question: str.min(1),
  answer: str.min(1),
  impacts: z.array(rawImpactSchema).min(1),
  commentary: str.default(''),
});

export const influencerContentOutputSchema = z.object({
  medium: str.min(1),
  text: str.min(1),
  impact: rawImpactSchema,
});

export const epilogueOutputSchema = z.object({
  advancementScore: num,
  justification: str.min(1),
  epilogue: str.min(1),
});

/** Jobs whose output is free prose rather than JSON. */
export const TEXT_OUTPUT_JOBS: ReadonlySet<JobType> = new Set(['day.report', 'chat.reply']);

const JSON_SCHEMAS: Partial<Record<JobType, z.ZodTypeAny>> = {
  'world.generate': worldGenOutputSchema,
  'rival.generate': rivalGenOutputSchema,
  'party.policies': policiesOutputSchema,
  'opinion.seed': opinionSeedOutputSchema,
  'councilor.pool': councilorPoolOutputSchema,
  'councilor.match': councilorMatchOutputSchema,
  'influencers.generate': influencersOutputSchema,
  'event.generate': eventGenOutputSchema,
  'event.evaluate': eventEvalOutputSchema,
  'influencer.content': influencerContentOutputSchema,
  'debate.playerQuestionOptions': optionsOutputSchema,
  'debate.rivalQuestion': questionOutputSchema,
  'debate.playerAnswerOptions': optionsOutputSchema,
  'debate.rivalAnswer': answerOutputSchema,
  'debate.evaluate': debateEvalOutputSchema,
  'debate.rivalExchange': rivalExchangeOutputSchema,
  'election.epilogue': epilogueOutputSchema,
};

/**
 * Parse a raw model response for the given job type. Throws with a
 * descriptive message on failure (used verbatim in the repair re-prompt).
 */
export function parseJobOutput(jobType: JobType, rawText: string): unknown {
  if (TEXT_OUTPUT_JOBS.has(jobType)) {
    const text = rawText.trim();
    if (!text) throw new Error('Empty response');
    return text;
  }
  const schema = JSON_SCHEMAS[jobType];
  if (!schema) throw new Error(`No output schema for job type ${jobType}`);
  const parsed = schema.safeParse(parseJsonLoose(rawText));
  if (!parsed.success) {
    throw new Error(`JSON does not match the expected shape: ${parsed.error.message}`);
  }
  return parsed.data;
}
