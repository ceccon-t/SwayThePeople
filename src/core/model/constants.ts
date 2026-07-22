import type { CampaignSettings, CouncilorPositionId, TopicAreaId } from './schemas';

export interface TopicAreaInfo {
  id: TopicAreaId;
  name: string;
  description: string;
}

export const TOPIC_AREAS: TopicAreaInfo[] = [
  { id: 'economy', name: 'Economy', description: 'Jobs, taxes, industry, cost of living' },
  { id: 'security', name: 'Security', description: 'Crime, policing, borders, defense' },
  { id: 'health', name: 'Health', description: 'Healthcare access, hospitals, public health' },
  { id: 'education', name: 'Education', description: 'Schools, universities, research' },
  { id: 'culture', name: 'Culture', description: 'Identity, arts, media, social values' },
  { id: 'environment', name: 'Environment', description: 'Climate, energy, land and water' },
];

export const TOPIC_AREA_BY_ID: Record<TopicAreaId, TopicAreaInfo> = Object.fromEntries(
  TOPIC_AREAS.map((topic) => [topic.id, topic]),
) as Record<TopicAreaId, TopicAreaInfo>;

export interface CouncilorPositionInfo {
  id: CouncilorPositionId;
  title: string;
  description: string;
}

export const COUNCILOR_POSITIONS: CouncilorPositionInfo[] = [
  {
    id: 'campaignManager',
    title: 'Campaign Manager',
    description: 'Runs day-to-day strategy, field operations and scheduling',
  },
  {
    id: 'communicationsChief',
    title: 'Communications Chief',
    description: 'Shapes the message, handles press and public image',
  },
  {
    id: 'policyAdvisor',
    title: 'Policy Advisor',
    description: 'Turns the platform into positions that survive scrutiny',
  },
];

export const COUNCILOR_POSITION_BY_ID: Record<CouncilorPositionId, CouncilorPositionInfo> =
  Object.fromEntries(COUNCILOR_POSITIONS.map((position) => [position.id, position])) as Record<
    CouncilorPositionId,
    CouncilorPositionInfo
  >;

export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  totalDays: 14,
  debateDays: [5, 12],
  surveyInterval: 3,
  rivalCount: 3,
  stateCount: 5,
  councilorPoolSize: 3,
  influencerCount: 6,
  debateRounds: 2,
  eventChance: 2 / 3,
};

/** All numeric limits applied to LLM-proposed or simulated opinion changes. */
export const BOUNDS = {
  /** Per-topic delta from any single LLM-evaluated act. */
  topicDeltaMax: 8,
  regionalMultiplierMin: 0.5,
  regionalMultiplierMax: 2.0,
  /** Noise added when applying an impact to each state (± this value). */
  impactNoise: 0.5,
  /** Mission baselines and their random swing (± swing). */
  missionCampaignStateBase: 2.0,
  missionPromoteTopicBase: 1.5,
  missionSwing: 1.0,
  /** Rival daily action strength. */
  rivalActionBase: 1.2,
  rivalActionSwing: 0.6,
  /** Court-influencer: success if affinity + roll(±15) >= threshold. */
  courtRollSpread: 15,
  courtThreshold: 60,
  courtFailAffinityGain: 5,
  /** Commitment gained by courting an influencer who already endorses you. */
  courtSupporterGain: 10,
  /**
   * Endorsing influencers past this commitment start hinting at the hidden
   * agenda; the chance of a hint scales linearly from 0 here to 1 at 100.
   */
  influencerHintThreshold: 70,
  /**
   * Councilor agenda-fit floor: every generated applicant is presented as at
   * least this compatible with BOTH agendas (provisional — likely revisited).
   */
  councilorMatchFloor: 50,
  /**
   * Maximum spread (in weighted national approval points) between the
   * strongest and weakest candidate at campaign start. A 14-day campaign
   * cannot recover a huge gap; longer campaigns may relax this.
   */
  initialApprovalGapMax: 10,
  /** Multiplier on the player's positive debate deltas per prep point. */
  debatePrepBonusPerPoint: 0.15,
  /** Survey sampling noise on state scores (± points). */
  surveyNoise: 1.5,
  /** Election-day noise on state scores (± points). */
  electionNoise: 2.0,
  /** Influencer content impact scale by reach (delta = reach/100 * this). */
  influencerImpactMax: 4,
} as const;
