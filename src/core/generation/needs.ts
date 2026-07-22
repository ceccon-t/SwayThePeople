/**
 * Needs derivation: the generation queue's contents are DERIVED from campaign
 * state, never stored. After every state change the host reconciles the queue
 * against this list; on load the same derivation resumes pending work. Job
 * keys are stable for a given need, so reconciliation is idempotent.
 *
 * During setup the derivation is deliberately sequential: it yields at most
 * ONE world-building job at a time, in a fixed narrative order (nation →
 * councilor options role by role → rivals → initial opinion → extras). Local
 * engines are slow; a single-job chain keeps them from being buried in queued
 * work and lets the player read each result while the next one generates.
 */
import { COUNCILOR_POSITION_BY_ID } from '../model/constants';
import type { Campaign, CouncilorPositionId } from '../model/schemas';
import { COUNCILOR_POSITION_IDS } from '../model/schemas';
import { isCandidateSeeded } from '../sim/opinion';
import { activeDebate, currentExchange } from '../sim/debates';
import type { JobPayloads, JobRequest, JobType } from './jobs';

function job<T extends JobType>(
  type: T,
  keySuffix: string,
  priority: JobRequest['priority'],
  payload: JobPayloads[T],
): JobRequest<T> {
  return { key: keySuffix ? `${type}:${keySuffix}` : type, type, priority, payload };
}

export function deriveNeededJobs(campaign: Campaign): JobRequest[] {
  if (campaign.phase === 'setup') {
    const jobs: JobRequest[] = [];
    const next = nextSetupJob(campaign);
    if (next) jobs.push(next);
    // The player may hire and chat during setup; replies stay interactive.
    pushChatJobs(campaign, jobs);
    return jobs;
  }
  return deriveOngoingJobs(campaign);
}

/** The single next step of the progressive world build-up (null = done). */
function nextSetupJob(campaign: Campaign): JobRequest | null {
  const settings = campaign.settings;

  // 1. The nation — everything else depends on it.
  if (!campaign.nation) return job('world.generate', '', 'high', {});

  // 2. Councilor options, one position at a time, so the player can read and
  //    choose applicants while the next batch is being written.
  for (const positionId of COUNCILOR_POSITION_IDS) {
    if (campaign.councilors.hired[positionId]) continue;
    const pool = campaign.councilors.pool[positionId] ?? [];
    if (pool.length < settings.councilorPoolSize) {
      return job('councilor.pool', `${positionId}:${pool.length}`, 'high', {
        positionId,
        count: settings.councilorPoolSize - pool.length,
      });
    }
  }

  // 3. Rivals, one at a time so each generation sees the previous ones.
  if (campaign.parties.length < settings.rivalCount + 1) {
    return job('rival.generate', String(campaign.parties.length), 'high', {
      index: campaign.parties.length,
    });
  }

  // 4. Initial public opinion, one candidate at a time. This completes the
  //    essentials — the campaign can start once every candidate is polled.
  for (const candidate of campaign.candidates) {
    if (!isCandidateSeeded(campaign, candidate.id)) {
      return job('opinion.seed', candidate.id, 'high', { candidateId: candidate.id });
    }
  }

  // 5. Non-blocking extras, in usefulness order: agenda fits (the player is
  //    choosing councilors right now), then the platform, then influencers.
  for (const positionId of COUNCILOR_POSITION_IDS) {
    const pool = campaign.councilors.pool[positionId] ?? [];
    const unmatched = pool.filter((c) => !c.agendaMatch).map((c) => c.id);
    if (unmatched.length > 0) {
      return job('councilor.match', `${positionId}:${unmatched.join('.')}`, 'background', {
        positionId,
        councilorIds: unmatched,
      });
    }
  }
  const playerParty = campaign.parties.find((p) => p.id === campaign.playerPartyId);
  if (playerParty && playerParty.policies.length === 0) {
    return job('party.policies', playerParty.id, 'background', { partyId: playerParty.id });
  }
  if (campaign.influencers.length < settings.influencerCount) {
    return job('influencers.generate', String(campaign.influencers.length), 'background', {
      count: Math.min(3, settings.influencerCount - campaign.influencers.length),
    });
  }
  return null;
}

/** Chat replies are needed in any phase; only hired councilors have threads. */
function pushChatJobs(campaign: Campaign, jobs: JobRequest[]): void {
  for (const thread of Object.values(campaign.chats)) {
    if (thread.pendingReply) {
      jobs.push(
        job('chat.reply', `${thread.councilorId}:${thread.messages.length}`, 'interactive', {
          councilorId: thread.councilorId,
          messageCount: thread.messages.length,
        }),
      );
    }
  }
}

/** Needs for a running or finished campaign (the queue serializes execution). */
function deriveOngoingJobs(campaign: Campaign): JobRequest[] {
  const jobs: JobRequest[] = [];
  const settings = campaign.settings;

  // --- World construction chain (normally done in setup; also heals saves) --
  if (!campaign.nation) {
    jobs.push(job('world.generate', '', 'high', {}));
    return jobs; // everything else depends on the nation existing
  }
  if (campaign.parties.length < settings.rivalCount + 1) {
    // One rival at a time so each generation sees the previous ones.
    jobs.push(
      job('rival.generate', String(campaign.parties.length), 'high', {
        index: campaign.parties.length,
      }),
    );
  }
  const playerParty = campaign.parties.find((p) => p.id === campaign.playerPartyId);
  if (playerParty && playerParty.policies.length === 0) {
    jobs.push(job('party.policies', playerParty.id, 'high', { partyId: playerParty.id }));
  }
  for (const candidate of campaign.candidates) {
    if (!isCandidateSeeded(campaign, candidate.id)) {
      jobs.push(job('opinion.seed', candidate.id, 'high', { candidateId: candidate.id }));
    }
  }

  // --- Councilor pools & evaluations ---------------------------------------
  for (const positionId of COUNCILOR_POSITION_IDS) {
    const pool = campaign.councilors.pool[positionId] ?? [];
    const missing = settings.councilorPoolSize - pool.length;
    if (missing > 0) {
      jobs.push(
        job('councilor.pool', `${positionId}:${pool.length}`, 'background', {
          positionId,
          count: missing,
        }),
      );
    }
    const unmatched = pool.filter((c) => !c.agendaMatch).map((c) => c.id);
    if (unmatched.length > 0) {
      jobs.push(
        job('councilor.match', `${positionId}:${unmatched.join('.')}`, 'background', {
          positionId,
          councilorIds: unmatched,
        }),
      );
    }
  }

  // --- Influencers ----------------------------------------------------------
  if (campaign.influencers.length < settings.influencerCount) {
    const count = Math.min(3, settings.influencerCount - campaign.influencers.length);
    jobs.push(
      job('influencers.generate', String(campaign.influencers.length), 'background', {
        count,
      }),
    );
  }

  pushChatJobs(campaign, jobs);

  if (campaign.phase === 'running') {
    // --- Today's event ------------------------------------------------------
    const record = campaign.days.find((d) => d.day === campaign.day);
    if (record?.eventPlanned && !record.eventId) {
      jobs.push(job('event.generate', String(campaign.day), 'interactive', { day: campaign.day }));
    }
    for (const event of campaign.events) {
      if (event.response && !event.evaluation) {
        jobs.push(job('event.evaluate', event.id, 'interactive', { eventId: event.id }));
      }
    }

    // --- Daily reports for past days ----------------------------------------
    for (const past of campaign.days) {
      if (past.day < campaign.day && past.outcomes.length > 0 && !past.reportText) {
        jobs.push(job('day.report', String(past.day), 'background', { day: past.day }));
      }
    }

    // --- Influencer content --------------------------------------------------
    for (const influencer of campaign.influencers) {
      if (
        influencer.endorsement &&
        influencer.nextContentDay !== undefined &&
        influencer.nextContentDay <= campaign.day
      ) {
        jobs.push(
          job('influencer.content', `${influencer.id}:${campaign.day}`, 'background', {
            influencerId: influencer.id,
            day: campaign.day,
          }),
        );
      }
    }

    // --- Active debate -------------------------------------------------------
    const debate = activeDebate(campaign);
    const exchange = debate && currentExchange(debate);
    if (debate && exchange) {
      const playerId = campaign.playerCandidateId;
      const ref = { debateId: debate.id, exchangeId: exchange.id };
      if (!exchange.question) {
        if (exchange.questionerId === playerId) {
          if (!exchange.questionOptions) {
            jobs.push(job('debate.playerQuestionOptions', exchange.id, 'interactive', ref));
          }
        } else if (exchange.targetId === playerId) {
          jobs.push(job('debate.rivalQuestion', exchange.id, 'interactive', ref));
        } else {
          jobs.push(job('debate.rivalExchange', exchange.id, 'interactive', ref));
        }
      } else if (!exchange.answer) {
        if (exchange.targetId === playerId) {
          if (!exchange.answerOptions) {
            jobs.push(job('debate.playerAnswerOptions', exchange.id, 'interactive', ref));
          }
        } else {
          jobs.push(job('debate.rivalAnswer', exchange.id, 'interactive', ref));
        }
      } else if (!exchange.evaluation) {
        jobs.push(job('debate.evaluate', exchange.id, 'interactive', ref));
      }
    }
  }

  // --- Epilogue --------------------------------------------------------------
  if (campaign.phase === 'finished' && campaign.result && !campaign.result.epilogue) {
    jobs.push(job('election.epilogue', '', 'high', {}));
  }

  return jobs;
}

/** Human-readable label for queue UI. */
export function jobLabel(campaign: Campaign, request: JobRequest): string {
  switch (request.type) {
    case 'world.generate':
      return 'Shaping the nation…';
    case 'rival.generate':
      return `Inventing rival candidate ${(request.payload as JobPayloads['rival.generate']).index}/${campaign.settings.rivalCount}…`;
    case 'party.policies':
      return 'Writing the party platform…';
    case 'opinion.seed': {
      const { candidateId } = request.payload as JobPayloads['opinion.seed'];
      const name = campaign.candidates.find((c) => c.id === candidateId)?.name ?? 'a candidate';
      return `Polling initial opinion on ${name}…`;
    }
    case 'councilor.pool': {
      const { positionId } = request.payload as JobPayloads['councilor.pool'];
      return `Collecting applications for ${COUNCILOR_POSITION_BY_ID[positionId as CouncilorPositionId].title}…`;
    }
    case 'councilor.match':
      return 'Assessing applicants against your agendas…';
    case 'influencers.generate':
      return 'Scouting influencers…';
    case 'event.generate':
      return 'A story is breaking…';
    case 'event.evaluate':
      return 'The public weighs your response…';
    case 'day.report':
      return 'Writing the daily briefing…';
    case 'chat.reply':
      return 'Your councilor is typing…';
    case 'influencer.content':
      return 'An influencer is posting…';
    case 'debate.playerQuestionOptions':
      return 'Drafting your question…';
    case 'debate.rivalQuestion':
      return 'Your rival prepares a question…';
    case 'debate.playerAnswerOptions':
      return 'Drafting your possible answers…';
    case 'debate.rivalAnswer':
      return 'Your rival is answering…';
    case 'debate.evaluate':
      return 'The analysts score the exchange…';
    case 'debate.rivalExchange':
      return 'The rivals clash on stage…';
    case 'election.epilogue':
      return 'History is being written…';
  }
}
