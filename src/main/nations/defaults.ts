/**
 * The nations bundled with the game, offered on the new-campaign wizard so a
 * run can start without waiting for world generation. Validated against the
 * package schema at module load — a malformed default is a programming error
 * and should fail loudly, not at campaign creation.
 *
 * Three deliberately contrasting countries, mechanically alike (5 states,
 * 3 rivals, 6 influencers) but with topic weights and casts that express each
 * nation's temperament: a booming republic split by its own modernity, a
 * bruised one seething over who owns it, and a serene one in graceful decline.
 */
import type { NationPackage } from '@core/nation/package';
import { NATION_PACKAGE_FORMAT_VERSION, nationPackageSchema } from '@core/nation/package';

// ---------------------------------------------------------------------------
// Republic of Marovia — the boom and the backlash
// ---------------------------------------------------------------------------

const MAROVIA = {
  formatVersion: NATION_PACKAGE_FORMAT_VERSION,
  id: 'default-marovia',
  name: 'Republic of Marovia',
  description:
    'A sun-washed coastal republic riding a headlong tech boom: server farms rise over fishing docks, fortunes are minted in app stores, and every family dinner splits between those building the new Marovia and those who never asked for it.',
  states: [
    {
      id: 'mv-st-porto-real',
      name: 'Porto Real',
      description:
        'The capital and its bay — startup towers, venture money and rooftop bars stacked over a colonial old town that still goes to Sunday mass.',
      cities: ['Porto Real', 'Baixa Nova', 'Almadora'],
      populationWeight: 30,
      topicWeights: {
        economy: 30,
        culture: 25,
        education: 15,
        security: 10,
        health: 10,
        environment: 10,
      },
    },
    {
      id: 'mv-st-valdorra',
      name: 'Valdorra',
      description:
        'Vineyards, olive terraces and processions; the heartland that feeds the boom and distrusts it in equal measure.',
      cities: ['Vila Serrano', 'Ordoveira'],
      populationWeight: 20,
      topicWeights: {
        culture: 30,
        economy: 20,
        security: 15,
        health: 15,
        education: 10,
        environment: 10,
      },
    },
    {
      id: 'mv-st-san-aleixo',
      name: 'San Aleixo',
      description:
        'The old textile belt retooling for chip assembly: overtime for some, severance for the rest, and everyone watching the job boards.',
      cities: ['San Aleixo', 'Fabril'],
      populationWeight: 20,
      topicWeights: {
        economy: 30,
        education: 20,
        security: 15,
        health: 15,
        culture: 10,
        environment: 10,
      },
    },
    {
      id: 'mv-st-serra-lume',
      name: 'Serra do Lume',
      description:
        'Mountain country over the lithium seams that feed the battery plants; mining royalties on one side of the valley, poisoned-well lawsuits on the other.',
      cities: ['Lume Alto', 'Minaverde'],
      populationWeight: 15,
      topicWeights: {
        environment: 30,
        economy: 25,
        culture: 15,
        security: 10,
        health: 10,
        education: 10,
      },
    },
    {
      id: 'mv-st-ilha-verde',
      name: 'Ilha Verde',
      description:
        'An island province of ferries and fig trees, lately colonized by remote workers whose rents arrive in foreign currency.',
      cities: ['Porto Pequeno', 'Andrelas'],
      populationWeight: 15,
      topicWeights: {
        culture: 25,
        environment: 25,
        economy: 20,
        security: 10,
        health: 10,
        education: 10,
      },
    },
  ],
  parties: [
    {
      id: 'mv-pt-horizonte',
      name: 'Horizonte Digital',
      code: '14',
      colors: { main: '#0e7c9e', secondary: '#e8f7fb' },
      publicAgenda:
        'Finish the boom: universal fiber, coding and English in every school, modern rights for modern families, and a state that moves at startup speed.',
      hiddenAgenda:
        "Steer the republic's digital-infrastructure contracts to the venture fund that incubated the party — and its candidate.",
    },
    {
      id: 'mv-pt-heranca',
      name: 'Herança Nacional',
      code: '25',
      colors: { main: '#7a1f2b', secondary: '#f3e9d8' },
      publicAgenda:
        'Slow down and remember who we are: protect the family table, the parish, the vineyard and the Sunday rest from the app-store economy.',
      hiddenAgenda:
        "Return the old religious orders to the classroom and shield the great landowning families' water rights from the mining and tech estates.",
    },
    {
      id: 'mv-pt-pacto',
      name: 'Pacto Operário',
      code: '40',
      colors: { main: '#b3541e', secondary: '#fdf1e3' },
      publicAgenda:
        'The boom must pay its workers: union seats on tech boards, retraining billed to the platforms, and no Marovian left refreshing a gig app at midnight.',
      hiddenAgenda:
        "Put the union federation's officers in charge of the new retraining funds — and their relatives on its payroll.",
    },
  ],
  candidates: [
    {
      id: 'mv-cd-cardim',
      partyId: 'mv-pt-horizonte',
      name: 'Beatriz Cardim',
      age: 39,
      gender: 'female',
      bio: 'Sold her logistics app at twenty-nine, built a foundation wiring village schools, and has never once waited in a line she could not disrupt.',
    },
    {
      id: 'mv-cd-vasques',
      partyId: 'mv-pt-heranca',
      name: 'Aurélio Vasques',
      age: 63,
      gender: 'male',
      bio: 'Three-term governor of Valdorra with a handshake like a land deed; blesses new bridges and distrusts new ideas in the same afternoon.',
    },
    {
      id: 'mv-cd-leandro',
      partyId: 'mv-pt-pacto',
      name: 'Marta Leandro',
      age: 52,
      gender: 'female',
      bio: 'A textile-floor steward who argued her first wage case at nineteen and has since lost exactly two negotiations, both to hurricanes.',
    },
  ],
  initialOpinion: {
    'mv-cd-cardim': {
      topicScores: {
        economy: 62,
        education: 58,
        health: 45,
        environment: 42,
        culture: 40,
        security: 38,
      },
      stateAffinities: {
        'mv-st-porto-real': 72,
        'mv-st-ilha-verde': 60,
        'mv-st-san-aleixo': 52,
        'mv-st-serra-lume': 42,
        'mv-st-valdorra': 30,
      },
    },
    'mv-cd-vasques': {
      topicScores: {
        culture: 62,
        security: 55,
        health: 48,
        environment: 45,
        economy: 42,
        education: 38,
      },
      stateAffinities: {
        'mv-st-valdorra': 74,
        'mv-st-serra-lume': 55,
        'mv-st-san-aleixo': 46,
        'mv-st-ilha-verde': 40,
        'mv-st-porto-real': 32,
      },
    },
    'mv-cd-leandro': {
      topicScores: {
        health: 56,
        economy: 54,
        education: 48,
        culture: 44,
        security: 42,
        environment: 40,
      },
      stateAffinities: {
        'mv-st-san-aleixo': 70,
        'mv-st-serra-lume': 55,
        'mv-st-porto-real': 45,
        'mv-st-valdorra': 44,
        'mv-st-ilha-verde': 40,
      },
    },
  },
  influencers: [
    {
      id: 'mv-in-tavessa',
      name: 'Rui Tavessa',
      age: 34,
      gender: 'male',
      bio: "Host of the republic's biggest tech podcast; records from a converted sardine cannery and calls every guest 'founder'.",
      domain: 'tech podcasting',
      audience: 'urban professionals and students',
      reach: 68,
      partyAffinity: { 'mv-pt-horizonte': 82, 'mv-pt-pacto': 40, 'mv-pt-heranca': 15 },
    },
    {
      id: 'mv-in-roseira',
      name: 'Camila Roseira',
      age: 58,
      gender: 'female',
      bio: 'Morning-show hostess for thirty years; her kitchen segment moves more groceries than any law ever has.',
      domain: 'daytime television',
      audience: 'families and older viewers',
      reach: 80,
      partyAffinity: { 'mv-pt-heranca': 60, 'mv-pt-pacto': 48, 'mv-pt-horizonte': 30 },
    },
    {
      id: 'mv-in-marreiros',
      name: 'Ivo Marreiros',
      age: 27,
      gender: 'male',
      bio: 'National-team winger from the San Aleixo tenements; every transfer rumor is front-page news for a week.',
      domain: 'football',
      audience: 'everyone with a television',
      reach: 85,
      partyAffinity: { 'mv-pt-pacto': 58, 'mv-pt-horizonte': 45, 'mv-pt-heranca': 40 },
    },
    {
      id: 'mv-in-brita',
      name: 'Estêvão Brita',
      age: 61,
      gender: 'male',
      bio: 'Radio homilist whose Sunday broadcast reaches every valley kitchen in Valdorra; speaks softly about firm things.',
      domain: 'religious radio',
      audience: 'rural churchgoing households',
      reach: 55,
      partyAffinity: { 'mv-pt-heranca': 78, 'mv-pt-pacto': 35, 'mv-pt-horizonte': 12 },
    },
    {
      id: 'mv-in-fontoura',
      name: 'Lia Fontoura',
      age: 24,
      gender: 'female',
      bio: 'Pop singer whose breakup album went double platinum; live-streams her tour bus and her opinions in equal measure.',
      domain: 'pop music',
      audience: 'urban youth',
      reach: 74,
      partyAffinity: { 'mv-pt-horizonte': 65, 'mv-pt-pacto': 45, 'mv-pt-heranca': 18 },
    },
    {
      id: 'mv-in-muralha',
      name: 'Zé Muralha',
      age: 45,
      gender: 'male',
      bio: 'Satirist whose late-night monologue has ended two ministerial careers; claims he only reads the news aloud, slowly.',
      domain: 'late-night comedy',
      audience: 'commuters and night owls',
      reach: 62,
      partyAffinity: { 'mv-pt-pacto': 50, 'mv-pt-horizonte': 48, 'mv-pt-heranca': 25 },
    },
  ],
};

// ---------------------------------------------------------------------------
// Republic of Rockland — who owns the country?
// ---------------------------------------------------------------------------

const ROCKLAND = {
  formatVersion: NATION_PACKAGE_FORMAT_VERSION,
  id: 'default-rockland',
  name: 'Republic of Rockland',
  description:
    'A landlocked republic still carrying the bruises of a botched privatization: a glittering capital quarter ringed by picket lines, shuttered steelworks, and a public running out of patience with the fifteen families who own everything.',
  states: [
    {
      id: 'rk-st-sterling',
      name: 'Sterling',
      description:
        "The capital: a glass 'New Quarter' where the money lives, ringed by boulevards that fill with marchers every Friday.",
      cities: ['Sterling City', 'Northgate'],
      populationWeight: 30,
      topicWeights: {
        economy: 28,
        security: 25,
        health: 15,
        culture: 12,
        education: 10,
        environment: 10,
      },
    },
    {
      id: 'rk-st-bessemer',
      name: 'Bessemer',
      description:
        'The steel basin. Half the furnaces are cold, the union halls are not, and every family measures time in shifts and layoffs.',
      cities: ['Bessemer', 'Millers Bend'],
      populationWeight: 20,
      topicWeights: {
        economy: 35,
        health: 18,
        security: 15,
        culture: 12,
        education: 10,
        environment: 10,
      },
    },
    {
      id: 'rk-st-greenfield',
      name: 'Greenfield',
      description:
        'A river plain of smallholdings being swallowed field by field by the Agrovia conglomerate; the auctions are always legal and never fair.',
      cities: ['Cedar Plains', 'Marlow'],
      populationWeight: 20,
      topicWeights: {
        economy: 25,
        environment: 20,
        security: 15,
        health: 15,
        culture: 15,
        education: 10,
      },
    },
    {
      id: 'rk-st-riverport',
      name: 'Riverport',
      description:
        'The river-port strip: cranes, customs stamps and fortunes that appear somewhere between the manifest and the warehouse.',
      cities: ['Riverport', 'Old Wharf'],
      populationWeight: 15,
      topicWeights: {
        security: 32,
        economy: 25,
        environment: 13,
        culture: 10,
        health: 10,
        education: 10,
      },
    },
    {
      id: 'rk-st-dunmore',
      name: 'Dunmore',
      description:
        "Emptying highland villages where the young send money home and the clinics close one by one; the pensions arrive, the doctors don't.",
      cities: ['Dunmore', 'Cold Hollow'],
      populationWeight: 15,
      topicWeights: {
        health: 34,
        economy: 20,
        culture: 16,
        security: 10,
        education: 10,
        environment: 10,
      },
    },
  ],
  parties: [
    {
      id: 'rk-pt-renewal',
      name: "People's Renewal Movement",
      code: '11',
      colors: { main: '#a32020', secondary: '#f7e8e0' },
      publicAgenda:
        'Make the fifteen families pay: windfall taxes on privatized fortunes, utilities back in public hands, and bread that costs what bread costs.',
      hiddenAgenda:
        "The movement's war chest comes from the billionaire Wade Corbin, who wants his rivals expropriated first — and his own ledgers left closed.",
    },
    {
      id: 'rk-pt-order',
      name: 'Civic Order Party',
      code: '30',
      colors: { main: '#1c3f6e', secondary: '#e9eef6' },
      publicAgenda:
        'First peace, then prosperity: end the street chaos, protect honest property, and let the police do their work without apology.',
      hiddenAgenda:
        "Route the new national-guard equipment and prison contracts to the security firm quietly held by the candidate's brother.",
    },
    {
      id: 'rk-pt-open',
      name: 'Open Rockland',
      code: '77',
      colors: { main: '#0d7a5f', secondary: '#eaf6f1' },
      publicAgenda:
        'Clean courts, honest tenders and foreign investment: make Rockland a country young people return to, not one they describe.',
      hiddenAgenda:
        "Leave the original privatizations un-prosecuted — the party's discreet donors were their beneficiaries, and a foreign bank directorship awaits the candidate either way.",
    },
  ],
  candidates: [
    {
      id: 'rk-cd-merrick',
      partyId: 'rk-pt-renewal',
      name: 'Dana Merrick',
      age: 44,
      gender: 'female',
      bio: 'A strike lawyer who won back pay for eleven thousand steelworkers and sleeps four hours a night, mostly on trains.',
    },
    {
      id: 'rk-cd-marsh',
      partyId: 'rk-pt-order',
      name: 'Vernon Marsh',
      age: 58,
      gender: 'male',
      bio: 'Former interior minister who never raises his voice; the last man to do so in his presence is still remembered fondly.',
    },
    {
      id: 'rk-cd-shore',
      partyId: 'rk-pt-open',
      name: 'Martin Shore',
      age: 47,
      gender: 'male',
      bio: 'An economist who lectured abroad for a decade and came home with three languages, two reform plans and one carefully undisclosed client list.',
    },
  ],
  initialOpinion: {
    'rk-cd-merrick': {
      topicScores: {
        economy: 58,
        health: 52,
        culture: 45,
        education: 44,
        environment: 42,
        security: 35,
      },
      stateAffinities: {
        'rk-st-bessemer': 74,
        'rk-st-greenfield': 60,
        'rk-st-dunmore': 55,
        'rk-st-sterling': 48,
        'rk-st-riverport': 40,
      },
    },
    'rk-cd-marsh': {
      topicScores: {
        security: 64,
        economy: 45,
        culture: 42,
        health: 40,
        education: 38,
        environment: 35,
      },
      stateAffinities: {
        'rk-st-riverport': 68,
        'rk-st-sterling': 55,
        'rk-st-dunmore': 48,
        'rk-st-greenfield': 42,
        'rk-st-bessemer': 35,
      },
    },
    'rk-cd-shore': {
      topicScores: {
        education: 58,
        economy: 55,
        environment: 45,
        health: 42,
        culture: 38,
        security: 36,
      },
      stateAffinities: {
        'rk-st-sterling': 62,
        'rk-st-riverport': 48,
        'rk-st-greenfield': 44,
        'rk-st-bessemer': 38,
        'rk-st-dunmore': 35,
      },
    },
  },
  influencers: [
    {
      id: 'rk-in-wolfe',
      name: 'Dara Wolfe',
      age: 31,
      gender: 'female',
      bio: 'Investigative YouTuber whose land-registry exposés get ministers reshuffled; films with her passport in her jacket.',
      domain: 'investigative video journalism',
      audience: 'urban and expatriate viewers',
      reach: 72,
      partyAffinity: { 'rk-pt-open': 60, 'rk-pt-renewal': 55, 'rk-pt-order': 10 },
    },
    {
      id: 'rk-in-mercer',
      name: 'Hank Mercer',
      age: 55,
      gender: 'male',
      bio: "Heartland rocker of the shuttered factories; stadiums of grown men cry at the third chorus of 'Second Shift'.",
      domain: 'heartland rock',
      audience: 'workers and pensioners',
      reach: 70,
      partyAffinity: { 'rk-pt-renewal': 72, 'rk-pt-order': 30, 'rk-pt-open': 25 },
    },
    {
      id: 'rk-in-rains',
      name: 'Kayla Rains',
      age: 26,
      gender: 'female',
      bio: "Lifestyle vlogger from the New Quarter penthouses; her followers love the handbags and increasingly ask how they're paid for.",
      domain: 'fashion and lifestyle',
      audience: 'young urban women',
      reach: 58,
      partyAffinity: { 'rk-pt-open': 50, 'rk-pt-order': 42, 'rk-pt-renewal': 20 },
    },
    {
      id: 'rk-in-stanton',
      name: 'Eddie Stanton',
      age: 49,
      gender: 'male',
      bio: 'Olympic boxing medalist who runs free gyms in Bessemer; hands like anvils, opinions likewise.',
      domain: 'sport and charity',
      audience: 'working-class men',
      reach: 66,
      partyAffinity: { 'rk-pt-renewal': 60, 'rk-pt-order': 45, 'rk-pt-open': 25 },
    },
    {
      id: 'rk-in-brooks',
      name: 'Eleanor Brooks',
      age: 62,
      gender: 'female',
      bio: 'Television economist who has predicted eleven of the last three crises; feared by every finance minister regardless.',
      domain: 'economic punditry',
      audience: 'news watchers',
      reach: 48,
      partyAffinity: { 'rk-pt-open': 58, 'rk-pt-renewal': 35, 'rk-pt-order': 30 },
    },
    {
      id: 'rk-in-jarvis',
      name: 'Paul Jarvis',
      age: 29,
      gender: 'male',
      bio: "Streamer known as 'PJ' who narrates city-council meetings like football derbies; the councilors have started playing to camera.",
      domain: 'live streaming',
      audience: 'students and commuters',
      reach: 54,
      partyAffinity: { 'rk-pt-renewal': 45, 'rk-pt-open': 45, 'rk-pt-order': 18 },
    },
  ],
};

// ---------------------------------------------------------------------------
// Havelmark — serenity on a slow ebb
// ---------------------------------------------------------------------------

const HAVELMARK = {
  formatVersion: NATION_PACKAGE_FORMAT_VERSION,
  id: 'default-havelmark',
  name: 'Havelmark',
  description:
    'A quiet highland democracy that retired its crown half a century ago and kept its habits: sheep, hymns, punctual trains and world-class craftsmanship that the world, politely, has stopped buying.',
  states: [
    {
      id: 'hv-st-kronsdal',
      name: 'Kronsdal',
      description:
        'The capital valley: the old royal palace is a museum, parliament sits in the riding hall, and the civil service is the biggest employer by a comfortable, well-documented margin.',
      cities: ['Kronsdal', 'Bruket'],
      populationWeight: 25,
      topicWeights: {
        culture: 28,
        economy: 20,
        education: 15,
        health: 15,
        environment: 14,
        security: 8,
      },
    },
    {
      id: 'hv-st-norrbro',
      name: 'Norrbro',
      description:
        'Timber towns along the northern river where family sawmills cut half of what they did a generation ago, and apologize for the noise.',
      cities: ['Norrbro', 'Furuholm'],
      populationWeight: 20,
      topicWeights: {
        economy: 33,
        environment: 20,
        health: 15,
        culture: 14,
        education: 10,
        security: 8,
      },
    },
    {
      id: 'hv-st-lammark',
      name: 'Lammark',
      description:
        'The sheep highlands: wool prices fell forty years ago and never got up, and the young follow the lambs down to the lowlands each spring.',
      cities: ['Fjellby', 'Ulldal'],
      populationWeight: 20,
      topicWeights: {
        economy: 30,
        health: 20,
        culture: 18,
        education: 16,
        environment: 10,
        security: 6,
      },
    },
    {
      id: 'hv-st-urenstad',
      name: 'Urenstad',
      description:
        "Workshop towns that once put a Havelmark movement in half the world's fine watches; the skill remains, the orders do not.",
      cities: ['Urenstad', 'Federdal'],
      populationWeight: 15,
      topicWeights: {
        economy: 34,
        education: 24,
        culture: 16,
        health: 10,
        environment: 10,
        security: 6,
      },
    },
    {
      id: 'hv-st-vidsee',
      name: 'Vidsee',
      description:
        'The lake district of spas, springs and retirees; serenity is the leading industry and it is fully booked.',
      cities: ['Vidsee Bad', 'Stillnes'],
      populationWeight: 20,
      topicWeights: {
        health: 30,
        environment: 24,
        culture: 20,
        economy: 14,
        education: 6,
        security: 6,
      },
    },
  ],
  parties: [
    {
      id: 'hv-pt-krone',
      name: 'Crown & Countryside',
      code: '22',
      colors: { main: '#3f5233', secondary: '#f0e6c8' },
      publicAgenda:
        'Keep Havelmark Havelmark: defend the farm subsidies, the parish schools and the quiet; decline, if it must come, will find us dignified.',
      hiddenAgenda:
        'Restore the former royal house to an official advisory council — with its confiscated estates returned; the candidate is, quietly, a cousin of the old king.',
    },
    {
      id: 'hv-pt-nykurs',
      name: 'New Course Alliance',
      code: '45',
      colors: { main: '#1d5f8a', secondary: '#e6f1f8' },
      publicAgenda:
        'A gentle turn, firmly taken: fiber to every farm, watch workshops retooled for medical instruments, and a tax holiday for any firm that hires north of the pass.',
      hiddenAgenda:
        "The alliance's financiers want the highland water rights: the hydropower concessions must be sold quietly, before the valuations turn honest.",
    },
    {
      id: 'hv-pt-landsfolk',
      name: 'Landsfolk Union',
      code: '63',
      colors: { main: '#9a7b2d', secondary: '#f6efdc' },
      publicAgenda:
        'The land keeps whoever keeps it: cooperative buyouts for failing mills, a starter croft for every young family that stays, markets before museums.',
      hiddenAgenda:
        "The union's leadership skims the cooperative funds through its purchasing arm — and the candidate's family co-op is always first in line.",
    },
  ],
  candidates: [
    {
      id: 'hv-cd-vossberg',
      partyId: 'hv-pt-krone',
      name: 'Ingrid Vossberg',
      age: 61,
      gender: 'female',
      bio: 'A county magistrate famed for rulings so measured that both parties apologize; keeps bees, quotes scripture, answers letters by hand.',
    },
    {
      id: 'hv-cd-ekdal',
      partyId: 'hv-pt-nykurs',
      name: 'Jonas Ekdal',
      age: 45,
      gender: 'male',
      bio: 'An engineer who came home after fifteen years abroad to inherit a silent sawmill, and an opinion about everything that led to that silence.',
    },
    {
      id: 'hv-cd-kjelde',
      partyId: 'hv-pt-landsfolk',
      name: 'Astrid Kjelde',
      age: 53,
      gender: 'female',
      bio: 'Runs the largest dairy cooperative in the highlands and has out-negotiated three supermarket chains; her handshake is a contract and her silence a verdict.',
    },
  ],
  initialOpinion: {
    'hv-cd-vossberg': {
      topicScores: {
        culture: 60,
        health: 52,
        security: 50,
        environment: 48,
        education: 42,
        economy: 40,
      },
      stateAffinities: {
        'hv-st-kronsdal': 66,
        'hv-st-vidsee': 62,
        'hv-st-lammark': 55,
        'hv-st-norrbro': 45,
        'hv-st-urenstad': 38,
      },
    },
    'hv-cd-ekdal': {
      topicScores: {
        economy: 58,
        education: 56,
        environment: 42,
        security: 40,
        health: 40,
        culture: 35,
      },
      stateAffinities: {
        'hv-st-urenstad': 68,
        'hv-st-norrbro': 58,
        'hv-st-kronsdal': 48,
        'hv-st-lammark': 42,
        'hv-st-vidsee': 36,
      },
    },
    'hv-cd-kjelde': {
      topicScores: {
        economy: 52,
        health: 50,
        culture: 48,
        environment: 46,
        education: 44,
        security: 38,
      },
      stateAffinities: {
        'hv-st-lammark': 70,
        'hv-st-norrbro': 56,
        'hv-st-vidsee': 48,
        'hv-st-kronsdal': 42,
        'hv-st-urenstad': 40,
      },
    },
  },
  influencers: [
    {
      id: 'hv-in-dalum',
      name: 'Henrik Dalum',
      age: 67,
      gender: 'male',
      bio: "Forty seasons presenting 'Our Quiet Hills'; the nation sets its clocks by his owl documentaries.",
      domain: 'nature broadcasting',
      audience: 'the whole family, especially grandparents',
      reach: 76,
      partyAffinity: { 'hv-pt-krone': 62, 'hv-pt-landsfolk': 48, 'hv-pt-nykurs': 30 },
    },
    {
      id: 'hv-in-lund',
      name: 'Freja Lund',
      age: 28,
      gender: 'female',
      bio: 'Vlogs her move abroad and her doubts about it; every homesick Havelmarker under thirty watches on Sunday nights.',
      domain: 'video blogging',
      audience: 'young people at home and abroad',
      reach: 58,
      partyAffinity: { 'hv-pt-nykurs': 60, 'hv-pt-landsfolk': 42, 'hv-pt-krone': 25 },
    },
    {
      id: 'hv-in-brandt',
      name: 'Emil Brandt',
      age: 59,
      gender: 'male',
      bio: 'Master watchmaker whose repair films are watched by millions who will never own such a watch; narrates escapements like love letters.',
      domain: 'craft video',
      audience: 'international craft enthusiasts and Urenstad',
      reach: 44,
      partyAffinity: { 'hv-pt-nykurs': 52, 'hv-pt-krone': 45, 'hv-pt-landsfolk': 35 },
    },
    {
      id: 'hv-in-aune',
      name: 'Solveig Aune',
      age: 34,
      gender: 'female',
      bio: 'Folk singer who sets the old hymnal to synthesizers; the church choirs are divided, the streaming numbers are not.',
      domain: 'folk music',
      audience: 'listeners young and old',
      reach: 56,
      partyAffinity: { 'hv-pt-landsfolk': 50, 'hv-pt-nykurs': 45, 'hv-pt-krone': 40 },
    },
    {
      id: 'hv-in-overgaard',
      name: 'Nils Overgaard',
      age: 30,
      gender: 'male',
      bio: 'Cross-country skiing champion; two Olympic golds, one national heartbreak, sponsors everything wool.',
      domain: 'winter sport',
      audience: 'everyone with a flag',
      reach: 72,
      partyAffinity: { 'hv-pt-krone': 50, 'hv-pt-landsfolk': 46, 'hv-pt-nykurs': 40 },
    },
    {
      id: 'hv-in-krag',
      name: 'Bodil Krag',
      age: 63,
      gender: 'female',
      bio: 'Evening call-in host who has heard every worry in the country twice and answers each as if for the first time.',
      domain: 'evening radio',
      audience: 'rural households and night drivers',
      reach: 64,
      partyAffinity: { 'hv-pt-landsfolk': 55, 'hv-pt-krone': 52, 'hv-pt-nykurs': 30 },
    },
  ],
};

export const DEFAULT_NATION_PACKAGES: NationPackage[] = [MAROVIA, ROCKLAND, HAVELMARK].map((pkg) =>
  nationPackageSchema.parse(pkg),
);

export function findDefaultNation(packageId: string): NationPackage | undefined {
  return DEFAULT_NATION_PACKAGES.find((pkg) => pkg.id === packageId);
}
