/**
 * The full-campaign smoke test (MVP Definition of Done #1): drive a complete
 * campaign — creation → setup → 14 days → 2 debates → election → epilogue —
 * over the MockAdapter, then round-trip it through save/load.
 */
import { describe, expect, it } from 'vitest';
import { BOUNDS } from '@core/model/constants';
import { COUNCILOR_POSITION_IDS, TOPIC_AREA_IDS } from '@core/model/schemas';
import {
  TEST_INPUT,
  actOnce,
  expectOk,
  makeHost,
  sendCommand as command,
  setupCampaign,
} from './helpers';

describe('full campaign smoke test', () => {
  it('plays a complete campaign to the epilogue and survives save/load', async () => {
    const host = makeHost();

    // --- Setup ---------------------------------------------------------
    let campaign = await setupCampaign(host);
    expect(campaign.nation).not.toBeNull();
    expect(campaign.parties).toHaveLength(4);
    expect(campaign.candidates).toHaveLength(4);
    expect(campaign.parties.find((p) => p.id === campaign.playerPartyId)?.policies).toHaveLength(6);
    expect(campaign.influencers.length).toBe(campaign.settings.influencerCount);
    const codes = campaign.parties.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);

    // Every assessed applicant meets the agenda-fit floor on both scores.
    for (const pool of Object.values(campaign.councilors.pool)) {
      for (const applicant of pool) {
        if (!applicant.agendaMatch) continue;
        expect(applicant.agendaMatch.publicScore).toBeGreaterThanOrEqual(
          BOUNDS.councilorMatchFloor,
        );
        expect(applicant.agendaMatch.hiddenScore).toBeGreaterThanOrEqual(
          BOUNDS.councilorMatchFloor,
        );
      }
    }

    // The starting field is compressed: weighted national approval spread ≤ gap.
    const startingStrengths = campaign.candidates.map((candidate) => {
      let strength = 0;
      for (const state of campaign.nation!.states) {
        for (const topicId of TOPIC_AREA_IDS) {
          strength +=
            state.populationWeight *
            state.topicWeights[topicId] *
            campaign.opinion.approval[state.id][topicId][candidate.id];
        }
      }
      return strength;
    });
    expect(Math.max(...startingStrengths) - Math.min(...startingStrengths)).toBeLessThanOrEqual(
      BOUNDS.initialApprovalGapMax + 1e-6,
    );

    // --- Hire the full team ---------------------------------------------
    for (const positionId of COUNCILOR_POSITION_IDS) {
      const applicant = campaign.councilors.pool[positionId][0];
      expect(applicant).toBeDefined();
      await command(host, { type: 'hireCouncilor', positionId, councilorId: applicant.id });
      campaign = host.getCampaign()!;
    }

    await command(host, { type: 'startCampaign' });
    campaign = host.getCampaign()!;
    expect(campaign.phase).toBe('running');
    expect(campaign.day).toBe(1);
    expect(campaign.surveys.length).toBeGreaterThanOrEqual(1); // day-1 baseline

    // --- Councilor chat ---------------------------------------------------
    const councilorId = campaign.councilors.hired[COUNCILOR_POSITION_IDS[0]]!.id;
    await command(host, { type: 'chatSend', councilorId, text: 'How do we win this thing?' });
    await host.queueIdle();
    campaign = host.getCampaign()!;
    const thread = campaign.chats[councilorId];
    expect(thread.pendingReply).toBe(false);
    expect(thread.messages.at(-1)?.role).toBe('councilor');

    // --- The 14 days ------------------------------------------------------
    for (let guard = 0; guard < 500 && host.getCampaign()!.phase === 'running'; guard++) {
      await host.queueIdle();
      campaign = host.getCampaign()!;
      if (campaign.phase !== 'running') break;
      const acted = await actOnce(host, campaign);
      if (!acted) await host.queueIdle();
    }

    campaign = host.getCampaign()!;
    expect(campaign.phase).toBe('finished');
    expect(campaign.day).toBe(campaign.settings.totalDays);
    expect(campaign.debates).toHaveLength(campaign.settings.debateDays.length);
    for (const debate of campaign.debates) {
      expect(debate.status).toBe('finished');
      expect(debate.exchanges.length).toBe(debate.order.length);
      expect(debate.exchanges.every((e) => e.evaluation)).toBe(true);
    }
    // Surveys on days 1, 4, 7, 10, 13.
    expect(campaign.surveys.length).toBe(5);

    // --- Result & epilogue ------------------------------------------------
    expect(campaign.result).toBeDefined();
    const result = campaign.result!;
    expect(result.ordering).toHaveLength(4);
    expect(Object.values(result.national).reduce((sum, v) => sum + v, 0)).toBeCloseTo(1, 6);
    await host.queueIdle();
    campaign = host.getCampaign()!;
    expect(campaign.result!.epilogue).toBeDefined();
    expect(campaign.result!.epilogue!.advancementScore).toBeGreaterThanOrEqual(0);
    expect(campaign.result!.epilogue!.advancementScore).toBeLessThanOrEqual(100);

    // Opinion movements must be traceable (rationales in the log).
    expect(campaign.log.filter((entry) => entry.kind === 'debate').length).toBeGreaterThan(0);

    // --- Save / load round-trip --------------------------------------------
    const saved = expectOk(await host.handle('campaign.save', { name: 'smoke run' })) as {
      fileName: string;
      sizeBytes: number;
    };
    expect(saved.sizeBytes).toBeGreaterThan(0);
    await host.handle('campaign.close');
    expect(host.getCampaign()).toBeNull();
    expectOk(await host.handle('campaign.load', { fileName: saved.fileName }));
    expect(host.getCampaign()).toEqual(campaign);
  }, 120_000);

  it('resumes pending generation after save/load mid-setup', async () => {
    const host = makeHost();
    expectOk(await host.handle('campaign.new', TEST_INPUT));
    // Save immediately: setup generation is still pending.
    const saved = expectOk(await host.handle('campaign.save', { name: 'early save' })) as {
      fileName: string;
    };
    await host.handle('campaign.close');
    expectOk(await host.handle('campaign.load', { fileName: saved.fileName }));
    // Needs derivation re-enqueues everything; setup completes normally.
    await host.queueIdle();
    const campaign = host.getCampaign()!;
    expect(campaign.nation).not.toBeNull();
    expect(campaign.parties).toHaveLength(4);
  }, 60_000);
});
