/**
 * Context builders: one per job type, each assembling exactly the context that
 * task needs (see ARCHITECTURE.md — "context is engineered, not accumulated").
 *
 * Hidden-agenda allowlist: the player's hidden agenda may enter a prompt ONLY
 * for: councilor.match, election.epilogue, councilor chat, generation of
 * the player's own suggestions/platform (party.policies, event options,
 * debate player options), and influencer.content for a player-endorsing
 * influencer whose seeded hint roll came up (nextContentHintsHidden — see
 * sim/influencers.ts). Rivals' own hidden agendas may inform content voiced
 * BY that rival. Nothing else ever sees a hidden agenda.
 */
import { BOUNDS, COUNCILOR_POSITION_BY_ID, TOPIC_AREA_BY_ID } from '../model/constants';
import {
  getCandidate,
  getCandidateParty,
  getPlayerCandidate,
  getPlayerParty,
  positionCouncilors,
} from '../model/queries';
import type { Campaign, Candidate, Councilor } from '../model/schemas';
import { composeSections } from './budget';
import type { CompletionRequest } from './engine';
import { candidateStatements, debateTranscript, recentLog } from './history';
import type { JobPayloads, JobRequest, JobType } from './jobs';
import { playerProfileBlock, worldPrimer } from './primer';
import { STYLE_CONTRACT, jsonInstructions } from './style';

const TEMP = { creative: 0.9, structured: 0.7, referee: 0.3 } as const;

function candidateBlock(campaign: Campaign, candidate: Candidate, includeHidden: boolean): string {
  const party = getCandidateParty(campaign, candidate.id);
  const lines = [
    `${candidate.name}, ${candidate.age}, ${candidate.gender} — ${candidate.bio}`,
    `Party: ${party.name} (code ${party.code}). Public agenda: ${party.publicAgenda}`,
  ];
  if (includeHidden) {
    lines.push(
      `Their hidden agenda (their private motivation, never stated openly): ${party.hiddenAgenda}`,
    );
  }
  return lines.join('\n');
}

function make(
  tag: JobType,
  sections: { text: string; optional?: boolean }[],
  task: string,
  temperature: number,
  maxOutputTokens: number,
  expectJson = true,
): CompletionRequest {
  return {
    tag,
    system: composeSections([{ text: STYLE_CONTRACT }, ...sections]),
    messages: [{ role: 'user', content: task }],
    temperature,
    maxOutputTokens,
    expectJson,
  };
}

type Builder<T extends JobType> = (
  campaign: Campaign,
  payload: JobPayloads[T],
) => CompletionRequest;

const builders: { [T in JobType]: Builder<T> } = {
  'world.generate': (campaign) => {
    const party = getPlayerParty(campaign);
    const candidate = getPlayerCandidate(campaign);
    return make(
      'world.generate',
      [
        {
          text: `A new campaign begins. The player's candidate is ${candidate.name} (${candidate.age}, ${candidate.gender}): ${candidate.bio}\nTheir party, ${party.name}, publicly stands for: ${party.publicAgenda}`,
        },
      ],
      `Invent the fictional nation where this presidential election takes place — a country where this candidacy makes sense and has friction. Create exactly ${campaign.settings.stateCount} states with distinct identities and concerns. populationWeight and topicWeights are relative numbers (they will be normalized).
${jsonInstructions('{"nationName":"…","nationDescription":"2-3 sentences","states":[{"name":"…","description":"1-2 sentences","cities":["…","…"],"populationWeight":30,"topicWeights":{"economy":30,"security":15,"health":10,"education":15,"culture":20,"environment":10}}]}')}`,
      TEMP.structured,
      1800,
    );
  },

  'rival.generate': (campaign, payload) => {
    const existing = campaign.parties
      .map((p) => {
        const cand = campaign.candidates.find((c) => c.partyId === p.id);
        return `- ${p.name} (code ${p.code}), candidate ${cand?.name ?? '?'} — ${p.publicAgenda}`;
      })
      .join('\n');
    return make(
      'rival.generate',
      [
        { text: worldPrimer(campaign) },
        {
          text: `Parties already in the race (yours must be clearly distinct from all of them):\n${existing}`,
        },
      ],
      `Invent rival #${payload.index} for this presidential race: a party and its candidate. Give them a coherent public agenda, a private hidden agenda that colors their behavior, a distinct two-digit party code (different from all existing codes), and party colors as hex values.
${jsonInstructions('{"party":{"name":"…","code":"27","colors":{"main":"#8b1e3f","secondary":"#f2e9dc"},"publicAgenda":"…","hiddenAgenda":"…"},"candidate":{"name":"…","age":54,"gender":"…","bio":"2-3 sentences"}}')}`,
      TEMP.structured,
      900,
    );
  },

  'party.policies': (campaign) => {
    return make(
      'party.policies',
      [
        { text: worldPrimer(campaign), optional: true },
        { text: playerProfileBlock(campaign, true) },
      ],
      `Write the party's official platform: one policy per topic area (${Object.values(
        TOPIC_AREA_BY_ID,
      )
        .map((t) => t.name)
        .join(
          ', ',
        )}). Each policy must credibly serve the public agenda; where possible it may quietly leave room for the hidden agenda, but must never reveal it.
${jsonInstructions('{"policies":[{"topic":"Economy","title":"short headline","summary":"2-3 sentences"}]}')}`,
      TEMP.structured,
      1200,
    );
  },

  'opinion.seed': (campaign, payload) => {
    const candidate = getCandidate(campaign, payload.candidateId);
    const states = (campaign.nation?.states ?? [])
      .map((s) => `- ${s.name}: ${s.description}`)
      .join('\n');
    return make(
      'opinion.seed',
      [
        { text: worldPrimer(campaign) },
        { text: `Candidate being rated:\n${candidateBlock(campaign, candidate, false)}` },
        { text: `States:\n${states}` },
      ],
      `As a neutral pollster at the start of the campaign, rate this candidate's initial public standing: a 0-100 score per topic area (how convincing they currently are on it) and a 0-100 affinity per state (how naturally their message lands there). Be discriminating — no candidate is equally strong everywhere.
${jsonInstructions('{"topicScores":{"economy":55,"security":40,"health":50,"education":60,"culture":45,"environment":35},"stateAffinities":[{"state":"State Name","affinity":60}]}')}`,
      TEMP.referee,
      700,
    );
  },

  'councilor.pool': (campaign, payload) => {
    const party = getPlayerParty(campaign);
    const position = COUNCILOR_POSITION_BY_ID[payload.positionId];
    return make(
      'councilor.pool',
      [
        {
          text: `The party hiring: ${party.name} — public agenda: ${party.publicAgenda}. Candidate: ${getPlayerCandidate(campaign).name}.`,
        },
        { text: campaign.nation ? `Nation: ${campaign.nation.name}.` : '', optional: true },
      ],
      `Invent ${payload.count} distinct applicant(s) for the position of ${position.title} (${position.description}) on this presidential campaign. Vary their backgrounds, ages and temperaments; they know the party's public agenda and still want the job — but they need not agree with everything.
${jsonInstructions('{"candidates":[{"name":"…","age":47,"gender":"…","bio":"2 sentences","politicalViews":"short phrase","personality":"short phrase"}]}')}`,
      TEMP.creative,
      1000,
    );
  },

  'councilor.match': (campaign, payload) => {
    const profiles = positionCouncilors(campaign, payload.positionId)
      .filter((c) => payload.councilorIds.includes(c.id))
      .map(
        (c) => `- ${c.name}: ${c.bio} Views: ${c.politicalViews}. Personality: ${c.personality}.`,
      )
      .join('\n');
    return make(
      'councilor.match',
      [{ text: playerProfileBlock(campaign, true) }, { text: `Applicants:\n${profiles}` }],
      `As the candidate's most trusted confidant, assess each applicant. These people were pre-screened before reaching your desk: every one of them is broadly compatible with both the public agenda and (whether they know it or not) the hidden one — so scores express degrees of usefulness, not raw alignment. publicScore (${BOUNDS.councilorMatchFloor}-100 fit with the public agenda), hiddenScore (${BOUNDS.councilorMatchFloor}-100 — how comfortable they would likely be serving the hidden agenda if they came to sense it), and one dry sentence of commentary.
${jsonInstructions('{"evaluations":[{"name":"…","publicScore":72,"hiddenScore":58,"commentary":"…"}]}')}`,
      TEMP.referee,
      700,
    );
  },

  'influencers.generate': (campaign, payload) => {
    const parties = campaign.parties.map((p) => `- ${p.name}: ${p.publicAgenda}`).join('\n');
    const existing = campaign.influencers.map((i) => i.name).join(', ') || 'none yet';
    return make(
      'influencers.generate',
      [
        { text: worldPrimer(campaign) },
        { text: `Parties in the race:\n${parties}\nInfluencers already created: ${existing}` },
      ],
      `Invent ${payload.count} celebrities/influencers of this nation (distinct from the existing ones): different domains (music, sports, business, comedy, punditry…), audiences and reach (1-100 relative audience size). For each, give a 0-100 affinity toward each party's message.
${jsonInstructions('{"influencers":[{"name":"…","age":33,"gender":"…","bio":"1-2 sentences","domain":"…","audience":"…","reach":60,"partyAffinities":[{"party":"Party Name","affinity":40}]}]}')}`,
      TEMP.creative,
      1400,
    );
  },

  'event.generate': (campaign, payload) => {
    return make(
      'event.generate',
      [
        { text: worldPrimer(campaign) },
        { text: playerProfileBlock(campaign, true) },
        { text: `Recent campaign developments:\n${recentLog(campaign, 8)}`, optional: true },
      ],
      `Write today's (day ${payload.day}) breaking news event: something that demands a public reaction from ${getPlayerCandidate(campaign).name} — a story, crisis, gaffe, or opportunity, plausibly grown from this nation and race. Then write exactly 3 response options in the candidate's own voice (distinct strategies; each 1-2 sentences, quotable). Options may quietly serve the hidden agenda but must never expose it. "topic" is the main topic area affected; "state" is a state name if the story is regional, else null.
${jsonInstructions('{"title":"…","description":"3-4 sentences","topic":"Economy","state":null,"options":["…","…","…"]}')}`,
      TEMP.creative,
      900,
    );
  },

  'event.evaluate': (campaign, payload) => {
    const event = campaign.events.find((e) => e.id === payload.eventId);
    return make(
      'event.evaluate',
      [
        { text: worldPrimer(campaign) },
        { text: playerProfileBlock(campaign, false) },
        {
          text: `The event (day ${event?.day}): ${event?.title} — ${event?.description}\nThe candidate's public response: "${event?.response?.text}"`,
        },
      ],
      `As a neutral political analyst, judge how this response lands with the public. Deltas are per-topic approval changes for the candidate, each between -8 and 8 (most honest reactions warrant -4..4; reserve larger only for exceptional moments). Use statesEmphasis (0.5-2.0 multipliers) only if the story is regional. The rationale is published, so write it like a pundit's verdict.
${jsonInstructions('{"impact":{"deltas":[{"topic":"Economy","delta":3}],"statesEmphasis":[{"state":"State Name","multiplier":1.5}],"rationale":"…"},"commentary":"…"}')}`,
      TEMP.referee,
      600,
    );
  },

  'day.report': (campaign, payload) => {
    const record = campaign.days.find((d) => d.day === payload.day);
    const facts = record?.outcomes.join('\n') || 'A quiet day on the trail.';
    const staff = Object.values(campaign.councilors.hired)
      .filter((councilor): councilor is Councilor => Boolean(councilor))
      .map(
        (councilor) =>
          `- ${councilor.name} (${COUNCILOR_POSITION_BY_ID[councilor.positionId].title})`,
      )
      .join('\n');
    const rivalNames = campaign.candidates
      .filter((c) => c.id !== campaign.playerCandidateId)
      .map((c) => c.name)
      .join(', ');
    return make(
      'day.report',
      [
        { text: worldPrimer(campaign) },
        {
          text: `WHO IS WHO — never confuse these two groups:
YOUR STAFF (councilors): advisors employed by your campaign who carry out missions on your behalf. They are NOT candidates; they never appear on a ballot or a debate stage. When a councilor "prepares for the debate", they are coaching YOU — it is you who will be sharper on stage, not them and not an opponent.
${staff || '- (no councilors hired)'}
YOUR ADVERSARIES (rival candidates, the only people competing against you): ${rivalNames || '(none)'}`,
        },
        {
          text: `Factual outcomes of day ${payload.day} (the player's campaign and rivals):\n${facts}`,
        },
      ],
      `Write the campaign's end-of-day internal briefing for day ${payload.day}: 100-150 words, in-world, covering the listed facts with a professional but wry tone. Address the candidate as "you"; refer to councilors strictly as your own staff and to rivals strictly as opposing candidates. Plain text only, no JSON.`,
      TEMP.creative,
      400,
      false,
    );
  },

  'chat.reply': (campaign, payload) => {
    const councilor = Object.values(campaign.councilors.hired).find(
      (c) => c?.id === payload.councilorId,
    );
    const thread = campaign.chats[payload.councilorId];
    const history = (thread?.messages ?? []).slice(-12);
    const transcript = history
      .slice(0, -1)
      .map((m) => `${m.role === 'player' ? 'Candidate' : councilor?.name}: ${m.text}`)
      .join('\n');
    const lastMessage = history[history.length - 1]?.text ?? '';
    return {
      tag: 'chat.reply',
      system: composeSections([
        { text: STYLE_CONTRACT },
        {
          text: `You are ${councilor?.name}, ${councilor?.age}, ${COUNCILOR_POSITION_BY_ID[councilor?.positionId ?? 'campaignManager'].title} of this presidential campaign. ${councilor?.bio} Political views: ${councilor?.politicalViews}. Personality: ${councilor?.personality}.\nYou speak in private with your candidate. Stay fully in character; answer like a trusted advisor (2-5 sentences, no lists unless asked).`,
        },
        { text: worldPrimer(campaign) },
        { text: playerProfileBlock(campaign, true) },
        { text: `Conversation so far:\n${transcript}`, optional: true },
      ]),
      messages: [{ role: 'user', content: lastMessage || 'Say hello to your candidate.' }],
      temperature: TEMP.creative,
      maxOutputTokens: 350,
      expectJson: false,
    };
  },

  'influencer.content': (campaign, payload) => {
    const influencer = campaign.influencers.find((i) => i.id === payload.influencerId);
    const endorsed = influencer?.endorsement
      ? getCandidate(campaign, influencer.endorsement.candidateId)
      : undefined;
    const party = endorsed ? getCandidateParty(campaign, endorsed.id) : undefined;
    // Allowlist: a deeply committed player-endorsing influencer may hint at
    // the hidden agenda when their seeded roll (nextContentHintsHidden) hit.
    const hintsHidden = Boolean(
      influencer?.nextContentHintsHidden && endorsed?.id === campaign.playerCandidateId,
    );
    return make(
      'influencer.content',
      [
        { text: worldPrimer(campaign) },
        {
          text: `Influencer: ${influencer?.name}, ${influencer?.age} — ${influencer?.bio} Domain: ${influencer?.domain}. Audience: ${influencer?.audience}. They publicly support ${endorsed?.name} (${party?.name} — ${party?.publicAgenda}).`,
        },
        {
          text: hintsHidden
            ? `${influencer?.name} has grown so close to the campaign that they sense its private ambition: ${party?.hiddenAgenda}\nToday's content should carry ONE subtle, deniable nod toward that ambition — a wink only careful readers catch, never an open statement of it.`
            : '',
        },
        { text: `Recent developments:\n${recentLog(campaign, 5)}`, optional: true },
      ],
      `Describe one piece of content this influencer publishes today supporting ${endorsed?.name} (a social post, interview mention, podcast bit…, in their own voice and style — "medium" names the format, "text" describes/quotes the content in 2-4 sentences). Then give its impact: small per-topic deltas for ${endorsed?.name} (each between 0 and 4, proportional to how persuasive it is).
${jsonInstructions('{"medium":"video post","text":"…","impact":{"deltas":[{"topic":"Culture","delta":2}],"rationale":"…"}}')}`,
      TEMP.creative,
      600,
    );
  },

  'debate.playerQuestionOptions': (campaign, payload) => {
    const { exchange } = findExchange(campaign, payload);
    const target = getCandidate(campaign, exchange?.targetId ?? '');
    return make(
      'debate.playerQuestionOptions',
      [
        { text: worldPrimer(campaign) },
        { text: playerProfileBlock(campaign, true) },
        { text: `Your target on stage:\n${candidateBlock(campaign, target, false)}` },
        {
          text: `Their past public statements:\n${candidateStatements(campaign, target.id, 6)}`,
          optional: true,
        },
        { text: `Debate so far:\n${debateTranscript(campaign, payload.debateId)}`, optional: true },
      ],
      `In the live presidential debate, it is your turn to question ${target.name}. The moderator's theme is ${TOPIC_AREA_BY_ID[exchange?.topicAreaId ?? 'economy'].name}. Draft 3 alternative questions in your candidate's voice: pointed, quotable, each with a different angle (one may exploit their past statements). They may serve your hidden agenda obliquely but must never expose it.
${jsonInstructions('{"options":["…","…","…"]}')}`,
      TEMP.creative,
      500,
    );
  },

  'debate.rivalQuestion': (campaign, payload) => {
    const { exchange } = findExchange(campaign, payload);
    const questioner = getCandidate(campaign, exchange?.questionerId ?? '');
    const target = getCandidate(campaign, exchange?.targetId ?? '');
    return make(
      'debate.rivalQuestion',
      [
        { text: worldPrimer(campaign) },
        {
          text: `You are ${questioner.name} on the debate stage.\n${candidateBlock(campaign, questioner, true)}`,
        },
        { text: `You are questioning:\n${candidateBlock(campaign, target, false)}` },
        {
          text: `Their past public statements:\n${candidateStatements(campaign, target.id, 6)}`,
          optional: true,
        },
        { text: `Debate so far:\n${debateTranscript(campaign, payload.debateId)}`, optional: true },
      ],
      `The moderator's theme is ${TOPIC_AREA_BY_ID[exchange?.topicAreaId ?? 'economy'].name}. Ask ${target.name} one question in ${questioner.name}'s voice: sharp, in character, ideally leveraging their past statements or weaknesses. 1-2 sentences.
${jsonInstructions('{"question":"…"}')}`,
      TEMP.creative,
      300,
    );
  },

  'debate.playerAnswerOptions': (campaign, payload) => {
    const { exchange } = findExchange(campaign, payload);
    const questioner = getCandidate(campaign, exchange?.questionerId ?? '');
    return make(
      'debate.playerAnswerOptions',
      [
        { text: worldPrimer(campaign) },
        { text: playerProfileBlock(campaign, true) },
        {
          text: `Your own past public statements (stay consistent, or pay for it):\n${candidateStatements(campaign, campaign.playerCandidateId, 6)}`,
          optional: true,
        },
        { text: `Debate so far:\n${debateTranscript(campaign, payload.debateId)}`, optional: true },
      ],
      `On the debate stage, ${questioner.name} just asked you: "${exchange?.question}"
Draft 3 alternative answers in your candidate's voice (each 1-3 sentences, distinct strategies: e.g. rebut, reframe, counterattack). They may quietly serve your hidden agenda but must never expose it.
${jsonInstructions('{"options":["…","…","…"]}')}`,
      TEMP.creative,
      600,
    );
  },

  'debate.rivalAnswer': (campaign, payload) => {
    const { exchange } = findExchange(campaign, payload);
    const questioner = getCandidate(campaign, exchange?.questionerId ?? '');
    const target = getCandidate(campaign, exchange?.targetId ?? '');
    return make(
      'debate.rivalAnswer',
      [
        { text: worldPrimer(campaign) },
        {
          text: `You are ${target.name} on the debate stage.\n${candidateBlock(campaign, target, true)}`,
        },
        {
          text: `Your own past public statements:\n${candidateStatements(campaign, target.id, 6)}`,
          optional: true,
        },
        { text: `Debate so far:\n${debateTranscript(campaign, payload.debateId)}`, optional: true },
      ],
      `${questioner.name} just asked you: "${exchange?.question}"
Answer in ${target.name}'s voice: in character, consistent with their platform and past statements. 1-3 sentences.
${jsonInstructions('{"answer":"…"}')}`,
      TEMP.creative,
      350,
    );
  },

  'debate.evaluate': (campaign, payload) => {
    const { exchange } = findExchange(campaign, payload);
    const questioner = getCandidate(campaign, exchange?.questionerId ?? '');
    const target = getCandidate(campaign, exchange?.targetId ?? '');
    return make(
      'debate.evaluate',
      [
        { text: worldPrimer(campaign) },
        { text: `Questioner:\n${candidateBlock(campaign, questioner, false)}` },
        { text: `Answerer:\n${candidateBlock(campaign, target, false)}` },
        {
          text: `Answerer's past statements (judge consistency):\n${candidateStatements(campaign, target.id, 5)}`,
          optional: true,
        },
        {
          text: `The exchange (theme: ${TOPIC_AREA_BY_ID[exchange?.topicAreaId ?? 'economy'].name}):\n${questioner.name}: "${exchange?.question}"\n${target.name}: "${exchange?.answer}"`,
        },
      ],
      `As a neutral debate analyst, score this exchange's effect on public opinion. Give one impact per affected candidate ("target" is the candidate's name — usually both questioner and answerer). Deltas are per-topic, each between -8 and 8 (typical exchanges warrant -4..4). Rationales are published like pundit verdicts.
${jsonInstructions('{"impacts":[{"target":"Name","deltas":[{"topic":"Economy","delta":-2}],"rationale":"…"}],"commentary":"one line on how the room felt"}')}`,
      TEMP.referee,
      700,
    );
  },

  'debate.rivalExchange': (campaign, payload) => {
    const { exchange } = findExchange(campaign, payload);
    const questioner = getCandidate(campaign, exchange?.questionerId ?? '');
    const target = getCandidate(campaign, exchange?.targetId ?? '');
    return make(
      'debate.rivalExchange',
      [
        { text: worldPrimer(campaign) },
        { text: `Questioner:\n${candidateBlock(campaign, questioner, true)}` },
        { text: `Answerer:\n${candidateBlock(campaign, target, true)}` },
        {
          text: `Answerer's past public statements:\n${candidateStatements(campaign, target.id, 5)}`,
          optional: true,
        },
        { text: `Debate so far:\n${debateTranscript(campaign, payload.debateId)}`, optional: true },
      ],
      `Write this full debate exchange (theme: ${TOPIC_AREA_BY_ID[exchange?.topicAreaId ?? 'economy'].name}): ${questioner.name} questions ${target.name}; ${target.name} answers. Both in character. Then, as a neutral analyst, score its effect: one impact per affected candidate, per-topic deltas between -8 and 8 (typical: -4..4), published rationales.
${jsonInstructions('{"question":"…","answer":"…","impacts":[{"target":"Name","deltas":[{"topic":"Economy","delta":2}],"rationale":"…"}],"commentary":"one line"}')}`,
      TEMP.creative,
      800,
    );
  },

  'election.epilogue': (campaign) => {
    const player = getPlayerCandidate(campaign);
    const result = campaign.result;
    const winner = campaign.candidates.find((c) => c.id === result?.winnerId);
    const placing = (result?.ordering.indexOf(player.id) ?? 0) + 1;
    const firstSurvey = campaign.surveys[0];
    const startShare = firstSurvey ? 100 * (firstSurvey.national[player.id] ?? 0) : null;
    const finalShare = 100 * (result?.national[player.id] ?? 0);
    const opinionArc =
      startShare !== null
        ? `THE ARC OF PUBLIC OPINION: on day 1 ${player.name} polled at ${startShare.toFixed(1)}% of national voting intention; on election day they took ${finalShare.toFixed(1)}% (${finalShare - startShare >= 0 ? '+' : ''}${(finalShare - startShare).toFixed(1)} points over the campaign).`
        : '';
    return make(
      'election.epilogue',
      [
        { text: worldPrimer(campaign) },
        { text: playerProfileBlock(campaign, true) },
        { text: `Campaign history:\n${recentLog(campaign, 60, 4000)}` },
        {
          text: `Election result: ${winner?.name} won with ${(100 * (result?.national[result.winnerId] ?? 0)).toFixed(1)}%. ${player.name} placed #${placing} with ${finalShare.toFixed(1)}%.`,
        },
        { text: opinionArc, optional: true },
      ],
      `The election is over. Remember what the HIDDEN agenda is: not a campaign promise, but what the candidate secretly intends to pursue AFTER taking power — nothing of it was supposed to happen during the campaign itself. Judge how well positioned that private design now is to become reality (advancementScore 0-100): winning the presidency with the agenda intact and deniable scores high; winning after bargaining it away scores low; losing usually scores low, unless the campaign genuinely bent the national conversation or built power that still serves it.
Then write the epilogue: 170-240 words, in-world, second person ("you"), set in the days AFTER the election. If the candidate won: how the presidency begins, and how the hidden design quietly starts (or fails) to move. If they lost: the concession, and what becomes of the hidden agenda now that power is out of reach. Either way, the epilogue must also reckon with the arc of public opinion above — a candidate who climbed far from where they started changed the nation's discourse even in defeat, and that shift deserves explicit words. justification: 1-2 sentences.
${jsonInstructions('{"advancementScore":62,"justification":"…","epilogue":"…"}')}`,
      TEMP.creative,
      900,
    );
  },
};

function findExchange(campaign: Campaign, payload: { debateId: string; exchangeId: string }) {
  const debate = campaign.debates.find((d) => d.id === payload.debateId);
  const exchange = debate?.exchanges.find((e) => e.id === payload.exchangeId);
  return { debate, exchange };
}

export function buildRequest(campaign: Campaign, job: JobRequest): CompletionRequest {
  const builder = builders[job.type] as Builder<JobType>;
  return builder(campaign, job.payload);
}
