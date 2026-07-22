/**
 * MockAdapter: a deterministic, offline "LLM" producing valid output for every
 * job type. First-class citizen — powers offline development, the full-campaign
 * smoke test, and lets players try the game without any model configured.
 */
import type {
  CompletionRequest,
  CompletionResult,
  LlmEngine,
  ModelInfo,
} from '@core/generation/engine';

const RIVAL_PARTIES = [
  {
    party: {
      name: 'National Renewal Front',
      code: '21',
      colors: { main: '#8b1e3f', secondary: '#f2e9dc' },
      publicAgenda: 'Order, tradition and secure borders for a proud nation.',
      hiddenAgenda: 'Funnel state contracts to allied industrial families.',
    },
    candidate: {
      name: 'General Petra Volkanis',
      age: 61,
      gender: 'female',
      bio: 'A retired general with an iron handshake and a carefully rehearsed smile, she speaks of discipline as if it were poetry.',
    },
  },
  {
    party: {
      name: 'Greenward Alliance',
      code: '43',
      colors: { main: '#1f6f43', secondary: '#e8f4d9' },
      publicAgenda: 'A green transition that leaves no worker behind.',
      hiddenAgenda: 'Secure lucrative consulting posts in international climate bodies.',
    },
    candidate: {
      name: 'Dr. Ansel Maro',
      age: 47,
      gender: 'male',
      bio: 'A soft-spoken climatologist turned politician who quotes soil statistics at dinner parties and means them affectionately.',
    },
  },
  {
    party: {
      name: 'Citizens for Prosperity',
      code: '55',
      colors: { main: '#1d4e89', secondary: '#ffd166' },
      publicAgenda: 'Lower taxes, small government, and an economy that roars.',
      hiddenAgenda: 'Deregulate the banking sector to benefit campaign donors.',
    },
    candidate: {
      name: 'Maximo Ferrant',
      age: 53,
      gender: 'male',
      bio: 'A self-made logistics magnate who never lets anyone forget the "self-made" part; charming, loud, allergic to footnotes.',
    },
  },
];

const COUNCILOR_NAMES = [
  'Ilya Berenshaw',
  'Marisol Quandt',
  'Tobias Rell',
  'Greta Osmund',
  'Fenwick Adler',
  'Priya Valcourt',
  'Casimir Holt',
  'Yolanda Brisk',
  'Edmund Tarrow',
  'Sable Munoz',
  'Viktor Lann',
  'Odette Framm',
];

const INFLUENCERS = [
  { name: 'Zuzu Vela', domain: 'pop music', audience: 'urban youth', reach: 82 },
  {
    name: 'Coach Bramwell',
    domain: 'sports punditry',
    audience: 'working-class families',
    reach: 64,
  },
  {
    name: 'The Frugal Duchess',
    domain: 'lifestyle & finance',
    audience: 'suburban savers',
    reach: 51,
  },
  {
    name: 'Dr. Owlbeam',
    domain: 'pop science video',
    audience: 'students and educators',
    reach: 46,
  },
  {
    name: 'Grandma Ferocity',
    domain: 'cooking & commentary',
    audience: 'rural households',
    reach: 58,
  },
  { name: 'Nightwatch Niko', domain: 'true-crime podcast', audience: 'commuters', reach: 39 },
];

export class MockAdapter implements LlmEngine {
  readonly providerId = 'mock' as const;
  private counter = 0;
  /** Artificial latency (ms) so the async UI paths are visible in dev. */
  constructor(private readonly latencyMs = 150) {}

  async listModels(): Promise<ModelInfo[]> {
    return [{ id: 'mock-writer-1', name: 'Mock Writer (offline)' }];
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Mock engine ready — fully offline, canned content.' };
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
    this.counter += 1;
    return { text: this.generate(request) };
  }

  private generate(request: CompletionRequest): string {
    const n = this.counter;
    switch (request.tag) {
      case 'world.generate':
        return JSON.stringify({
          nationName: 'Republic of Vandalia',
          nationDescription:
            'A mid-sized coastal republic proud of its shipyards, suspicious of its neighbors, and permanently arguing about bread prices.',
          states: [
            {
              name: 'Port Aurelia',
              description: 'The wealthy harbor state, all cranes and finance towers.',
              cities: ['Aurelia City', 'Brinemouth'],
              populationWeight: 30,
              topicWeights: {
                economy: 35,
                security: 15,
                health: 10,
                education: 15,
                culture: 15,
                environment: 10,
              },
            },
            {
              name: 'Grainmark',
              description: 'Endless farmland; its combines vote as reliably as its people.',
              cities: ['Millhaven', 'Rustfield'],
              populationWeight: 20,
              topicWeights: {
                economy: 25,
                security: 10,
                health: 15,
                education: 10,
                culture: 15,
                environment: 25,
              },
            },
            {
              name: 'Ironvale',
              description:
                'Old industry, new resentments, and the loudest football fans in the republic.',
              cities: ['Forgeton', 'Slagharbor'],
              populationWeight: 25,
              topicWeights: {
                economy: 30,
                security: 20,
                health: 15,
                education: 10,
                culture: 15,
                environment: 10,
              },
            },
            {
              name: 'The Veils',
              description: 'Misty highlands of universities, monasteries and stubborn poets.',
              cities: ['Highspire', 'Cloudwell'],
              populationWeight: 10,
              topicWeights: {
                economy: 10,
                security: 10,
                health: 15,
                education: 30,
                culture: 25,
                environment: 10,
              },
            },
            {
              name: 'Costa Bruma',
              description: 'Sunny beaches, fishing villages, and a tourism lobby with sharp teeth.',
              cities: ['Playa Verde', 'Foghollow'],
              populationWeight: 15,
              topicWeights: {
                economy: 20,
                security: 15,
                health: 15,
                education: 10,
                culture: 20,
                environment: 20,
              },
            },
          ],
        });

      case 'rival.generate': {
        const match = request.messages[0]?.content.match(/rival #(\d+)/);
        const index = match
          ? Math.max(0, Number(match[1]) - 1) % RIVAL_PARTIES.length
          : n % RIVAL_PARTIES.length;
        return JSON.stringify(RIVAL_PARTIES[index]);
      }

      case 'party.policies':
        return JSON.stringify({
          policies: [
            {
              topic: 'Economy',
              title: 'The Honest Ledger Act',
              summary:
                'Simplify taxes, audit every subsidy, and publish the books where any citizen can read them.',
            },
            {
              topic: 'Security',
              title: 'Neighborhood Shield',
              summary:
                'Community-anchored policing with measurable trust targets and body-worn accountability.',
            },
            {
              topic: 'Health',
              title: 'Clinics Before Palaces',
              summary: 'Redirect prestige-project budgets into walk-in clinics in every district.',
            },
            {
              topic: 'Education',
              title: 'Teachers First',
              summary:
                'Raise teacher pay to the professional median and cut classroom paperwork in half.',
            },
            {
              topic: 'Culture',
              title: 'A Stage in Every Town',
              summary:
                'Micro-grants for local arts, libraries open on weekends, and a national storytelling prize.',
            },
            {
              topic: 'Environment',
              title: 'Clean Coasts Compact',
              summary: 'Binding coastal cleanup targets funded by a modest levy on bulk shipping.',
            },
          ],
        });

      case 'opinion.seed': {
        const base = 35 + ((n * 13) % 25);
        const scores = [0, 1, 2, 3, 4, 5].map((i) => Math.min(85, base + ((n * 7 + i * 11) % 20)));
        return JSON.stringify({
          topicScores: {
            economy: scores[0],
            security: scores[1],
            health: scores[2],
            education: scores[3],
            culture: scores[4],
            environment: scores[5],
          },
          stateAffinities: [
            { state: 'Port Aurelia', affinity: 40 + ((n * 3) % 30) },
            { state: 'Grainmark', affinity: 40 + ((n * 5) % 30) },
            { state: 'Ironvale', affinity: 40 + ((n * 7) % 30) },
            { state: 'The Veils', affinity: 40 + ((n * 11) % 30) },
            { state: 'Costa Bruma', affinity: 40 + ((n * 13) % 30) },
          ],
        });
      }

      case 'councilor.pool': {
        const candidates = [0, 1, 2].map((i) => {
          const name = COUNCILOR_NAMES[(n + i * 4) % COUNCILOR_NAMES.length];
          return {
            name,
            age: 32 + ((n * 5 + i * 9) % 40),
            gender: i % 2 === 0 ? 'female' : 'male',
            bio: `${name} has survived ${2 + ((n + i) % 6)} campaigns, two scandals that were not their fault, and one that partially was.`,
            politicalViews: [
              'pragmatic centrist',
              'reform idealist',
              'old-school machine politics',
            ][i % 3],
            personality: ['dry and meticulous', 'warm but relentless', 'charming, slightly feral'][
              i % 3
            ],
          };
        });
        return JSON.stringify({ candidates });
      }

      case 'councilor.match':
        return JSON.stringify({
          evaluations: [0, 1, 2].map((i) => ({
            name: `applicant ${i + 1}`,
            publicScore: 55 + ((n * 7 + i * 13) % 40),
            hiddenScore: 50 + ((n * 11 + i * 17) % 45),
            commentary: 'Competent, presentable, and exactly as loyal as the salary suggests.',
          })),
        });

      case 'influencers.generate': {
        const influencers = [0, 1, 2].map((i) => {
          const base = INFLUENCERS[(n + i) % INFLUENCERS.length];
          return {
            ...base,
            age: 28 + ((n + i * 7) % 35),
            gender: i % 2 === 0 ? 'female' : 'male',
            bio: `${base.name} built an empire on ${base.domain} and defends it with the zeal of a border garrison.`,
            partyAffinities: [],
          };
        });
        return JSON.stringify({ influencers });
      }

      case 'event.generate':
        return JSON.stringify({
          title: `Dockworkers Strike in Port Aurelia (${n})`,
          description:
            "Crane operators walked out at dawn over an unpaid overtime dispute, freezing half the republic's imports. Cameras are waiting at the gates, and so are the strikers.",
          topic: 'Economy',
          state: 'Port Aurelia',
          options: [
            'I will stand with the workers at the gate this afternoon — fair pay is not a luxury.',
            'Both sides must return to the table tonight; I will send my own negotiator to see it done.',
            'This strike is being exploited by my opponents. The ports must open, then we talk.',
          ],
        });

      case 'event.evaluate':
        return JSON.stringify({
          impact: {
            deltas: [{ topic: 'Economy', delta: n % 2 === 0 ? 3 : -2 }],
            statesEmphasis: [{ state: 'Port Aurelia', multiplier: 1.5 }],
            rationale:
              n % 2 === 0
                ? 'A confident, concrete response that read as leadership rather than theater.'
                : 'The response satisfied no one: too warm for the owners, too cold for the strikers.',
          },
          commentary: 'The evening panels replayed the clip twice, which is once more than usual.',
        });

      case 'day.report':
        return `Day briefing: the ground game moved as planned, and nobody set anything on fire, which your communications chief counts as a victory. Rival camps spent the day patching their own leaks. The numbers drifted our way in places that matter; keep the pressure where the map says, not where the applause is loudest. Tomorrow wants one bold thing and two boring ones done well. (mock briefing #${n})`;

      case 'chat.reply':
        return `Candidly? ${n % 2 === 0 ? 'I like where we stand, but liking is not a strategy.' : 'We are one bad headline from a rough week, so let us not supply the headline.'} Give me a district and a message, and I will give you three points by Friday. (mock counsel #${n})`;

      case 'influencer.content':
        return JSON.stringify({
          medium: 'viral video post',
          text: `A ninety-second clip, filmed in one take: "I don't do politics. But I do arithmetic, and only one candidate's numbers add up." It ends with a wink and a campaign mug placed just barely off-center. (mock content #${n})`,
          impact: {
            deltas: [{ topic: 'Culture', delta: 2 }],
            rationale: 'Light, shareable, and just sincere enough to survive the comment section.',
          },
        });

      case 'debate.playerQuestionOptions':
        return JSON.stringify({
          options: [
            'You promise discipline for the nation — why did discipline never reach your own budget office?',
            `Your platform names every problem and prices none of them. Which promise gets cut first? (mock ${n})`,
            'When your donors and your voters disagree, who wins — and can you name one time the voters did?',
          ],
        });

      case 'debate.rivalQuestion':
        return JSON.stringify({
          question: `You speak beautifully about the future, but the ledgers of your past are less poetic. Will you explain them tonight, or shall I? (mock ${n})`,
        });

      case 'debate.playerAnswerOptions':
        return JSON.stringify({
          options: [
            'I would rather explain my ledgers than defend your arithmetic — mine at least add up.',
            `The public record is open; unlike my opponent, I have nothing that needs footnotes. (mock ${n})`,
            'Every figure in my past bought a school or a clinic. Ask what your figures bought.',
          ],
        });

      case 'debate.rivalAnswer':
        return JSON.stringify({
          answer: `A rehearsed line deserves a rehearsed answer: my record is public, my conscience is clean, and my patience with theatrics is finite. (mock ${n})`,
        });

      case 'debate.evaluate':
        return JSON.stringify({
          impacts: [
            {
              target: null,
              deltas: [{ topic: 'Economy', delta: n % 3 === 0 ? -2 : 2 }],
              rationale:
                n % 3 === 0
                  ? 'The answer wobbled where it needed to land; the hall noticed.'
                  : 'A clean parry that turned the attack into a stage for the platform.',
            },
          ],
          commentary: 'The room leaned forward; the moderators pretended not to.',
        });

      case 'debate.rivalExchange':
        return JSON.stringify({
          question: `Your coalition promises everything to everyone — who pays, and when do they find out? (mock ${n})`,
          answer:
            'They pay less than they do under your donors, and they find out on day one, in writing.',
          impacts: [
            {
              target: null,
              deltas: [{ topic: 'Economy', delta: n % 2 === 0 ? 1 : -1 }],
              rationale: 'A workmanlike exchange: no blood drawn, some minds nudged.',
            },
          ],
          commentary: 'Two professionals trading rehearsed blows to polite applause.',
        });

      case 'election.epilogue':
        return JSON.stringify({
          advancementScore: 40 + (n % 45),
          justification:
            'The campaign bent the public conversation toward the hidden design more than the vote count suggests.',
          epilogue:
            'You wake the morning after the count to a country that argues in your vocabulary now, whatever the tally said. The party files into headquarters — some to celebrate, some to update their résumés — and you allow yourself one private smile about the agenda no camera ever saw. History will call this election a chapter; you already know which sentence in it was yours. The work that mattered was never on the ballot, and it is far from finished. (mock epilogue)',
        });
    }
  }
}
