import { BOUNDS } from '../model/constants';
import { newId } from '../model/ids';
import type { Campaign, Survey } from '../model/schemas';
import { addLog } from './log';
import { computeShares, nationalTopicApproval } from './opinion';
import type { Rng } from './rng';

/** Take a poll snapshot with sampling noise and record it. */
export function takeSurvey(campaign: Campaign, rng: Rng, day: number): Survey {
  const shares = computeShares(campaign, rng, BOUNDS.surveyNoise);
  const survey: Survey = {
    id: newId('survey'),
    day,
    national: shares.national,
    byState: shares.byState,
    topicApproval: nationalTopicApproval(campaign),
  };
  campaign.surveys.push(survey);
  const leaderId = Object.entries(shares.national).sort((a, b) => b[1] - a[1])[0]?.[0];
  const leader = campaign.candidates.find((c) => c.id === leaderId);
  addLog(campaign, {
    kind: 'survey',
    day,
    text: leader
      ? `New national survey published — ${leader.name} leads with ${(shares.national[leader.id] * 100).toFixed(1)}% of voting intentions.`
      : 'New national survey published.',
  });
  return survey;
}
