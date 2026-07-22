/**
 * Commands are the only way campaign state changes. Player commands arrive
 * over IPC (validated with these schemas); applyJobResult is internal, issued
 * by the generation queue when a job's output is ready.
 */
import { z } from 'zod';
import { missionAssignmentSchema } from '../model/schemas';
import type { JobType } from '../generation/jobs';

export const playerCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startCampaign') }),
  z.object({
    type: z.literal('hireCouncilor'),
    positionId: z.string(),
    councilorId: z.string(),
  }),
  z.object({ type: z.literal('fireCouncilor'), positionId: z.string() }),
  z.object({
    type: z.literal('assignMission'),
    positionId: z.string(),
    assignment: missionAssignmentSchema.nullable(),
  }),
  z.object({ type: z.literal('endDay') }),
  z.object({
    type: z.literal('respondEvent'),
    eventId: z.string(),
    text: z.string().min(1),
    custom: z.boolean(),
  }),
  z.object({ type: z.literal('debateChooseTarget'), targetId: z.string() }),
  z.object({
    type: z.literal('debateSubmitQuestion'),
    text: z.string().min(1),
    custom: z.boolean(),
  }),
  z.object({ type: z.literal('debateSubmitAnswer'), text: z.string().min(1), custom: z.boolean() }),
  z.object({ type: z.literal('chatSend'), councilorId: z.string(), text: z.string().min(1) }),
]);
export type PlayerCommand = z.infer<typeof playerCommandSchema>;

export interface ApplyJobResultCommand {
  type: 'applyJobResult';
  jobType: JobType;
  payload: unknown;
  output: unknown;
}

export type Command = PlayerCommand | ApplyJobResultCommand;

/** Raised by reducers on invalid commands; surfaced to the UI as a friendly error. */
export class CommandError extends Error {}
