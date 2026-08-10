/**
 * The nations bundled with the game, offered on the new-campaign wizard so a
 * run can start without waiting for world generation. Validated against the
 * package schema at module load — a malformed default is a programming error
 * and should fail loudly, not at campaign creation.
 *
 * NOTE: placeholder content. The structure is final; the values are dummies
 * to be replaced with curated nations before release.
 */
import type { NationPackage } from '@core/nation/package';
import { NATION_PACKAGE_FORMAT_VERSION, nationPackageSchema } from '@core/nation/package';
import { TOPIC_AREA_IDS } from '@core/model/schemas';
import type { TopicNumbers } from '@core/model/schemas';

/** Even weights, with one emphasized topic (relative values; normalized later). */
function emphasize(topicIndex: number): TopicNumbers {
  return Object.fromEntries(
    TOPIC_AREA_IDS.map((topicId, i) => [
      topicId,
      i === topicIndex % TOPIC_AREA_IDS.length ? 40 : 12,
    ]),
  ) as TopicNumbers;
}

function dummyPackage(slug: string, label: string, partyCodes: [string, string, string]): unknown {
  const stateCount = 5;
  const rivalCount = 3;
  const influencerCount = 6;
  const stateId = (i: number): string => `${slug}-state-${i + 1}`;
  const partyId = (i: number): string => `${slug}-party-${i + 1}`;
  const candidateId = (i: number): string => `${slug}-cand-${i + 1}`;

  return {
    formatVersion: NATION_PACKAGE_FORMAT_VERSION,
    id: `default-${slug}`,
    name: `Nation ${label}`,
    description: `A placeholder nation (${label}) shipped while the curated defaults are written. Perfectly playable, deliberately bland.`,
    states: Array.from({ length: stateCount }, (_, i) => ({
      id: stateId(i),
      name: `${label} State ${i + 1}`,
      description: `Placeholder state ${i + 1} of Nation ${label}, chiefly concerned with its top topic.`,
      cities: [`${label} City ${i + 1}A`, `${label} City ${i + 1}B`],
      populationWeight: 10 + 5 * i,
      topicWeights: emphasize(i),
    })),
    parties: Array.from({ length: rivalCount }, (_, i) => ({
      id: partyId(i),
      name: `${label} Party ${i + 1}`,
      code: partyCodes[i],
      colors: { main: ['#8b1e3f', '#1f6f43', '#1d4e89'][i], secondary: '#f2e9dc' },
      publicAgenda: `Placeholder public agenda ${i + 1}: promise everything about topic ${i + 1}, loudly.`,
      hiddenAgenda: `Placeholder hidden agenda ${i + 1}: quietly reward the backers of party ${i + 1}.`,
    })),
    candidates: Array.from({ length: rivalCount }, (_, i) => ({
      id: candidateId(i),
      partyId: partyId(i),
      name: `${label} Rival ${i + 1}`,
      age: 45 + 5 * i,
      gender: i % 2 === 0 ? 'female' : 'male',
      bio: `Placeholder rival ${i + 1} of Nation ${label}: a career politician with exactly one memorable speech.`,
    })),
    initialOpinion: Object.fromEntries(
      Array.from({ length: rivalCount }, (_, i) => [
        candidateId(i),
        {
          topicScores: Object.fromEntries(
            TOPIC_AREA_IDS.map((topicId, j) => [topicId, 40 + ((i * 7 + j * 11) % 20)]),
          ),
          stateAffinities: Object.fromEntries(
            Array.from({ length: stateCount }, (_, s) => [
              stateId(s),
              40 + ((i * 13 + s * 5) % 25),
            ]),
          ),
        },
      ]),
    ),
    influencers: Array.from({ length: influencerCount }, (_, i) => ({
      id: `${slug}-infl-${i + 1}`,
      name: `${label} Influencer ${i + 1}`,
      age: 28 + 4 * i,
      gender: i % 2 === 0 ? 'female' : 'male',
      bio: `Placeholder influencer ${i + 1}: famous in Nation ${label} for reasons nobody can quite recall.`,
      domain: ['pop music', 'sports', 'finance talk', 'comedy', 'punditry', 'cooking'][i],
      audience: ['urban youth', 'families', 'savers', 'students', 'commuters', 'rural households'][
        i
      ],
      reach: 35 + 9 * i,
      partyAffinity: Object.fromEntries(
        Array.from({ length: rivalCount }, (_, p) => [partyId(p), 30 + ((i * 17 + p * 23) % 45)]),
      ),
    })),
  };
}

export const DEFAULT_NATION_PACKAGES: NationPackage[] = [
  dummyPackage('alpha', 'Alpha', ['21', '43', '55']),
  dummyPackage('bravo', 'Bravo', ['12', '34', '56']),
  dummyPackage('charlie', 'Charlie', ['18', '36', '54']),
].map((pkg) => nationPackageSchema.parse(pkg));

export function findDefaultNation(packageId: string): NationPackage | undefined {
  return DEFAULT_NATION_PACKAGES.find((pkg) => pkg.id === packageId);
}
