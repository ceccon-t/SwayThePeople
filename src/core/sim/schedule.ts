/** Day-start bookkeeping: event rolls, debates, surveys. */
import type { Campaign, CampaignSettings, DayRecord } from '../model/schemas';
import { createDebate } from './debates';
import type { Rng } from './rng';
import { takeSurvey } from './surveys';

export function isDebateDay(settings: CampaignSettings, day: number): boolean {
  return settings.debateDays.includes(day);
}

/** Surveys on day 1 and every `surveyInterval` days after (1, 4, 7, …). */
export function isSurveyDay(settings: CampaignSettings, day: number): boolean {
  return day % settings.surveyInterval === 1;
}

/** Create the record for a newly started day, rolling its scheduled content. */
export function rollDayStart(campaign: Campaign, rng: Rng, day: number): DayRecord {
  const settings = campaign.settings;
  const record: DayRecord = {
    day,
    eventPlanned: !isDebateDay(settings, day) && rng.chance(settings.eventChance),
    outcomes: [],
  };
  if (isDebateDay(settings, day)) {
    record.debateId = createDebate(campaign, rng, day).id;
  }
  if (isSurveyDay(settings, day)) {
    record.surveyId = takeSurvey(campaign, rng, day).id;
  }
  campaign.days.push(record);
  return record;
}

export function currentDayRecord(campaign: Campaign): DayRecord | undefined {
  return campaign.days.find((d) => d.day === campaign.day);
}
