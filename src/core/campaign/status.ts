/** Derived campaign-status helpers used by reducers, needs derivation and UI. */
import type { Campaign, CampaignEvent } from '../model/schemas';
import { isCandidateSeeded } from '../sim/opinion';
import { debateBlocksDayEnd } from '../sim/debates';
import { currentDayRecord } from '../sim/schedule';

/**
 * World content required before the campaign itself can start: the nation, all
 * rivals, and every candidate's initial opinion. Everything else (platform,
 * councilor pools/fits, influencers) keeps generating in the background and
 * shows as placeholders until it lands.
 */
export function isCoreSetupReady(campaign: Campaign): boolean {
  if (!campaign.nation) return false;
  if (campaign.parties.length < campaign.settings.rivalCount + 1) return false;
  return campaign.candidates.every((c) => isCandidateSeeded(campaign, c.id));
}

export function getEvent(campaign: Campaign, eventId: string): CampaignEvent | undefined {
  return campaign.events.find((e) => e.id === eventId);
}

export function currentDayEvent(campaign: Campaign): CampaignEvent | undefined {
  const record = currentDayRecord(campaign);
  if (!record?.eventId) return undefined;
  return getEvent(campaign, record.eventId);
}

export interface DayEndBlocker {
  reason: 'debate' | 'eventPending' | 'eventUnresolved';
  detail: string;
}

/** Why the current day cannot end yet (null = free to end). */
export function dayEndBlocker(campaign: Campaign): DayEndBlocker | null {
  if (debateBlocksDayEnd(campaign)) {
    return { reason: 'debate', detail: "Today's debate must be completed first." };
  }
  const record = currentDayRecord(campaign);
  if (record?.eventPlanned) {
    const event = record.eventId ? campaign.events.find((e) => e.id === record.eventId) : undefined;
    if (!event) {
      return { reason: 'eventPending', detail: 'A breaking story is developing…' };
    }
    if (!event.evaluation) {
      return {
        reason: 'eventUnresolved',
        detail: `You must respond to “${event.title}” before the day ends.`,
      };
    }
  }
  return null;
}
