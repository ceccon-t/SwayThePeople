/**
 * Nation export: turn a campaign's world back into a shareable NationPackage
 * so a generated (or hand-tuned) nation can be replayed in later campaigns.
 * The inverse of instantiateNationPackage, minus everything the player brought
 * along — the player's party and candidate, their opinion seed, and every
 * influencer's affinity toward the player's party are stripped (ARCHITECTURE
 * axiom 15). Baseline opinions come from the immutable `initialOpinion`
 * record, not from the current, campaign-worn approval numbers.
 *
 * A section is exported only once the campaign has finished generating it: a
 * half-generated cast would otherwise become the whole cast on import, because
 * instantiation derives the rival/influencer counts from the package.
 */
import { slugify } from '../model/sanitize';
import type { Campaign } from '../model/schemas';
import { TOPIC_AREA_IDS } from '../model/schemas';
import type { NationPackage } from './package';
import { NATION_PACKAGE_FORMAT_VERSION, nationPackageSchema } from './package';

/** Suggested file name for an exported nation (the dialog default). */
export function nationExportFileName(campaign: Campaign): string {
  return `${slugify(campaign.nation?.name ?? '', 'nation')}.json`;
}

/**
 * Stored weights are normalized fractions; the package format takes relative
 * weights, so they are exported as percentages rounded for readability.
 */
function asPercentWeight(fraction: number): number {
  return Math.max(0.01, Math.round(fraction * 10000) / 100);
}

export function exportNationPackage(campaign: Campaign): NationPackage {
  const nation = campaign.nation;
  if (!nation) throw new Error('The nation has not been generated yet.');

  const rivalParties = campaign.parties.filter((p) => p.id !== campaign.playerPartyId);
  const rivalCandidates = campaign.candidates.filter((c) => c.id !== campaign.playerCandidateId);
  const castComplete =
    rivalParties.length > 0 &&
    rivalParties.length >= campaign.settings.rivalCount &&
    rivalCandidates.length === rivalParties.length &&
    rivalCandidates.every((c) => rivalParties.some((p) => p.id === c.partyId));
  const influencersComplete =
    campaign.influencers.length > 0 &&
    campaign.influencers.length >= campaign.settings.influencerCount;

  // A campaign born from a package keeps that package's identity; a generated
  // nation gets one derived from its name plus the campaign it was born in.
  const id =
    campaign.nationRef?.kind === 'package' && campaign.nationRef.packageId
      ? campaign.nationRef.packageId
      : `${slugify(nation.name, 'nation')}-${campaign.id.slice(-6)}`;

  const pkg: NationPackage = {
    formatVersion: NATION_PACKAGE_FORMAT_VERSION,
    id,
    name: nation.name,
    description: nation.description,
    states: nation.states.map((state) => ({
      id: state.id,
      name: state.name,
      description: state.description,
      cities: [...state.cities],
      populationWeight: asPercentWeight(state.populationWeight),
      topicWeights: Object.fromEntries(
        TOPIC_AREA_IDS.map((t) => [t, asPercentWeight(state.topicWeights[t])]),
      ) as NationPackage['states'][number]['topicWeights'],
    })),
  };

  if (castComplete) {
    pkg.parties = rivalParties.map((party) => ({
      id: party.id,
      name: party.name,
      code: party.code,
      colors: { main: party.colors.main, secondary: party.colors.secondary },
      publicAgenda: party.publicAgenda,
      hiddenAgenda: party.hiddenAgenda,
    }));
    pkg.candidates = rivalCandidates.map((candidate) => ({
      id: candidate.id,
      partyId: candidate.partyId,
      name: candidate.name,
      age: candidate.age,
      gender: candidate.gender,
      bio: candidate.bio,
    }));
    const initialOpinion: NonNullable<NationPackage['initialOpinion']> = {};
    for (const candidate of rivalCandidates) {
      const seeded = campaign.initialOpinion?.[candidate.id];
      if (!seeded) continue;
      initialOpinion[candidate.id] = {
        topicScores: { ...seeded.topicScores },
        stateAffinities: { ...seeded.stateAffinities },
      };
    }
    if (Object.keys(initialOpinion).length > 0) pkg.initialOpinion = initialOpinion;

    // Influencers rate parties by id, so they only make sense alongside the cast.
    if (influencersComplete) {
      const rivalPartyIds = new Set(rivalParties.map((p) => p.id));
      pkg.influencers = campaign.influencers.map((influencer) => ({
        id: influencer.id,
        name: influencer.name,
        age: influencer.age,
        gender: influencer.gender,
        bio: influencer.bio,
        domain: influencer.domain,
        audience: influencer.audience,
        reach: influencer.reach,
        partyAffinity: Object.fromEntries(
          Object.entries(influencer.partyAffinity).filter(([partyId]) =>
            rivalPartyIds.has(partyId),
          ),
        ),
      }));
    }
  }

  // The file must load back through the same gate as any other package.
  return nationPackageSchema.parse(pkg);
}
