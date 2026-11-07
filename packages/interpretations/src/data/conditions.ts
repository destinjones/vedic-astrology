/**
 * Planetary conditions: dignity levels, retrograde and combust readings per planet,
 * conjunctions for every pair, and aspect meanings.
 */
import type { Dignity, PlanetId } from '../types';

export interface DignityText {
  label: string;
  summary: string;
  detail: string;
  score: number;
}

export const DIGNITY_TEXT: Record<Dignity, DignityText> = {
  exalted: {
    label: 'Exalted (uchcha)',
    summary: 'The planet is at its strongest and most refined.',
    detail: 'An exalted planet delivers its significations generously and with ease. It acts like a guest of honour: confident, effective and admired. Exaltation can also make a planet proud or one-sided, so check the house it rules and what aspects it.',
    score: 3,
  },
  moolatrikona: {
    label: 'Moolatrikona',
    summary: 'The planet is in its office: purposeful and reliable.',
    detail: 'Moolatrikona is the sign where a planet does its official work. It is almost as strong as exaltation, and it acts with clear purpose and authority.',
    score: 2.5,
  },
  own: {
    label: 'Own sign (svakshetra)',
    summary: 'The planet is at home: comfortable, stable and self-sufficient.',
    detail: 'In its own sign a planet protects the house it occupies and the house it rules. It acts naturally and without strain.',
    score: 2,
  },
  great_friend: {
    label: 'Great friend’s sign (adhi-mitra)',
    summary: 'The planet is well supported by its host.',
    detail: 'Both by nature and by temporary placement the sign lord is friendly, so the planet is supported and confident.',
    score: 1.5,
  },
  friend: {
    label: 'Friend’s sign (mitra)',
    summary: 'The planet is comfortable and cooperative.',
    detail: 'The planet is a welcome guest. Results are generally good and come without much friction.',
    score: 1,
  },
  neutral: {
    label: 'Neutral sign (sama)',
    summary: 'The planet works on its own merits.',
    detail: 'The host neither helps nor hinders. Results depend on house, aspects and conjunctions.',
    score: 0,
  },
  enemy: {
    label: 'Enemy’s sign (shatru)',
    summary: 'The planet works under some strain.',
    detail: 'The planet is in unfriendly territory. It can still deliver, but results require more effort and may come with friction.',
    score: -1,
  },
  great_enemy: {
    label: 'Great enemy’s sign (adhi-shatru)',
    summary: 'The planet is uncomfortable and resisted.',
    detail: 'The sign lord is hostile both naturally and by placement. The planet struggles to express itself and may act defensively.',
    score: -1.5,
  },
  debilitated: {
    label: 'Debilitated (neecha)',
    summary: 'The planet is at its weakest and must learn its lesson the hard way.',
    detail: 'A debilitated planet has trouble giving its natural results and may express them in distorted ways. It is not doom: debilitation is often cancelled (neecha bhanga), and a debilitated planet that is worked with consciously can become a source of exceptional strength later in life.',
    score: -3,
  },
};

export interface RetroText {
  summary: string;
  detail: string;
  strengths: string[];
  challenges: string[];
}

/** Retrograde meanings. Rahu and Ketu are always retrograde (mean nodes) and treated separately. */
export const RETROGRADE_TEXT: Record<PlanetId, RetroText> = {
  sun: { summary: 'The Sun is never retrograde.', detail: 'The Sun never appears retrograde from Earth.', strengths: [], challenges: [] },
  moon: { summary: 'The Moon is never retrograde.', detail: 'The Moon never appears retrograde from Earth.', strengths: [], challenges: [] },
  mars: {
    summary: 'Retrograde Mars: energy turned inward and re-strategised.',
    detail: 'Retrograde Mars gives energy that is stored, revisited and released in bursts. You may hesitate to act and then act with great force, or fight battles from the past. In Vedic thought a retrograde planet is close to Earth and bright, so it is strong (cheshta bala), but its results feel unconventional or delayed. Revisiting old projects, property matters and unresolved anger is typical.',
    strengths: ['strategic patience', 'stamina in reserve', 'ability to revisit and finish'], challenges: ['suppressed anger', 'delayed action', 'repeating conflicts'],
  },
  mercury: {
    summary: 'Retrograde Mercury: a reflective, non-linear thinker.',
    detail: 'Retrograde Mercury gives a mind that reviews, rethinks and approaches problems from unusual angles. You may learn differently from others, re-read and revise, and find original solutions. Communication can be misunderstood at first. Many writers, researchers and analysts have this placement.',
    strengths: ['original thinking', 'research depth', 'careful revision'], challenges: ['miscommunication', 'indecision', 'second-guessing'],
  },
  jupiter: {
    summary: 'Retrograde Jupiter: wisdom found through personal inquiry.',
    detail: 'Retrograde Jupiter questions inherited beliefs and builds its own philosophy. Teachers, children or faith may come with karmic lessons, and blessings may arrive late but strongly. You often become a teacher to others after first learning the hard way.',
    strengths: ['independent wisdom', 'depth of faith', 'late but strong blessings'], challenges: ['doubt', 'unconventional beliefs', 'delayed children or mentors'],
  },
  venus: {
    summary: 'Retrograde Venus: love and values re-examined.',
    detail: 'Retrograde Venus revisits relationships, aesthetics and values. Past partners may return, and you may hold unusual tastes or values. Love matures slowly. This placement can give exceptional artistic originality.',
    strengths: ['artistic originality', 'depth in love', 'refined values'], challenges: ['relationship delays', 'repeating patterns', 'self-worth questions'],
  },
  saturn: {
    summary: 'Retrograde Saturn: duty carried from the past.',
    detail: 'Retrograde Saturn often indicates karmic responsibilities and an inner critic. You may feel that you must earn everything twice, but the discipline you build is unshakeable. Results come late and last long.',
    strengths: ['inner discipline', 'endurance', 'mastery through repetition'], challenges: ['self-criticism', 'fear of failure', 'delays'],
  },
  rahu: {
    summary: 'Rahu always moves backward through the zodiac.',
    detail: 'Rahu and Ketu (the lunar nodes) are always retrograde in mean motion. Their placement shows the direction of growth (Rahu) and of release (Ketu) rather than a special retrograde effect.',
    strengths: [], challenges: [],
  },
  ketu: {
    summary: 'Ketu always moves backward through the zodiac.',
    detail: 'Rahu and Ketu (the lunar nodes) are always retrograde in mean motion. Ketu shows what is already mastered and being released.',
    strengths: [], challenges: [],
  },
};

export const COMBUST_TEXT: Partial<Record<PlanetId, string>> = {
  moon: 'A Moon close to the Sun (near new moon) gives a mind absorbed in purpose but can reduce emotional ease and public visibility.',
  mars: 'Combust Mars burns its own energy in the Sun’s heat: courage is present but may be spent on ego battles or in service of an authority figure.',
  mercury: 'Mercury is often near the Sun, and mild combustion (Budha-Aditya) is common and not seriously harmful. Deep combustion can make thinking ego-driven or communication unheard.',
  jupiter: 'Combust Jupiter hides its wisdom. Advice may go unheeded and teachers or children may be less visible, though faith can be intensely personal.',
  venus: 'Combust Venus can dim romance or comforts, or tie them to status. Relationships may be overshadowed by career or ego.',
  saturn: 'Combust Saturn sets the Sun and Saturn (father and son) in tension: authority, discipline and duty may be in conflict with self-expression.',
};

/** Conjunctions for every pair (keys are alphabetical "a+b"). */
export const CONJUNCTIONS: Record<string, [summary: string, detail: string, score: number]> = {
  'moon+sun': ['Sun–Moon: will and mind fused.', 'Born near a new moon, you have a focused, single-minded personality. Mind and ego work together, which gives determination but can make it hard to see other perspectives. Emotional needs may be overshadowed by goals.', 0],
  'mars+sun': ['Sun–Mars: fiery courage and leadership.', 'A powerful, energetic combination for leadership, sports, the military or surgery. Temper and pride must be managed.', 1],
  'mercury+sun': ['Budha-Aditya yoga: bright intelligence.', 'The Sun and Mercury together give intelligence, communication skill and recognition for the mind. Deep combustion can reduce the benefit.', 2],
  'jupiter+sun': ['Sun–Jupiter: wisdom and authority.', 'A noble combination giving ethics, respect, good counsel and favour from authority. Can make one self-righteous.', 2],
  'sun+venus': ['Sun–Venus: charm overshadowed by ego.', 'Artistic talent and social grace, but romance and pleasures may be tied to status. Venus is often combust here.', 0],
  'saturn+sun': ['Sun–Saturn: discipline versus ego.', 'Father and son are enemies. Tension with authority, delays in recognition and a serious nature, but great endurance.', -1],
  'rahu+sun': ['Sun–Rahu: eclipse of the self.', 'A grahana yoga affecting confidence, the father or authority. Strong ambition and political skill, but identity confusion or conflict with government.', -2],
  'ketu+sun': ['Sun–Ketu: detached ego.', 'A grahana yoga. Spiritual insight and humility, but low self-confidence or a distant father.', -1],
  'mars+moon': ['Chandra-Mangala yoga: emotional drive and earning power.', 'Passionate, enterprising and able to earn, though emotions can be fiery.', 1],
  'mercury+moon': ['Moon–Mercury: an emotional intellect.', 'Imaginative, witty and communicative, but thinking may be coloured by mood and anxiety.', 1],
  'jupiter+moon': ['Moon–Jupiter: Gaja Kesari energy.', 'Wisdom, kindness, reputation and emotional resilience. One of the most supportive combinations.', 3],
  'moon+venus': ['Moon–Venus: gentle, artistic and pleasure-loving.', 'Beauty, charm and love of comfort. Can be over-indulgent or emotionally dependent.', 1],
  'moon+saturn': ['Moon–Saturn: disciplined but heavy emotions.', 'Visha yoga in some texts. Emotional maturity and endurance, but melancholy or emotional coldness.', -2],
  'moon+rahu': ['Moon–Rahu: a restless, obsessive mind.', 'A grahana yoga. Imagination and ambition, but anxiety, confusion or unusual emotional patterns.', -2],
  'ketu+moon': ['Moon–Ketu: a detached, intuitive mind.', 'A grahana yoga. Psychic sensitivity and spiritual inclination, but emotional emptiness or confusion.', -2],
  'mars+mercury': ['Mars–Mercury: a sharp, argumentative mind.', 'Technical and debating skill, quick thinking, but harsh speech or nervous tension.', 0],
  'jupiter+mars': ['Guru-Mangala yoga: principled action.', 'Courage guided by wisdom. Good for law, leadership, engineering and teaching.', 2],
  'mars+venus': ['Mars–Venus: passion and desire.', 'Strong attraction, creativity and sensuality. Relationships are passionate but may be turbulent.', 0],
  'mars+saturn': ['Mars–Saturn: frustrated or disciplined energy.', 'A hard combination: obstacles, accidents or anger, but also great engineering and endurance capacity.', -2],
  'mars+rahu': ['Angaraka yoga: explosive energy.', 'Intense drive and courage, but risk of accidents, anger, conflict or impulsive action.', -2],
  'ketu+mars': ['Mars–Ketu: sharp, intuitive action.', 'Precision, surgical skill and courage, but sudden injuries or impulsiveness.', -1],
  'jupiter+mercury': ['Mercury–Jupiter: learning and wisdom.', 'Excellent for education, teaching, writing and counsel.', 2],
  'mercury+venus': ['Lakshmi-Narayana flavour: art and intellect.', 'Mercury and Venus together give artistic intelligence, charm in speech and business sense.', 2],
  'mercury+saturn': ['Mercury–Saturn: a serious, structured mind.', 'Good for research, accounting and long-term planning, though speech may be cautious.', 1],
  'mercury+rahu': ['Mercury–Rahu: a clever, unconventional mind.', 'Sharp intelligence, technology and media skill, but possible deception or nervousness.', 0],
  'ketu+mercury': ['Mercury–Ketu: intuitive intelligence.', 'Insight and technical precision, but communication can be unclear.', 0],
  'jupiter+venus': ['Jupiter–Venus: two gurus together.', 'The teachers of gods and demons meet. Wealth, refinement and wisdom, but sometimes conflicting values.', 1],
  'jupiter+saturn': ['Jupiter–Saturn: disciplined wisdom.', 'Practical wisdom, long-term success and ethical responsibility.', 1],
  'jupiter+rahu': ['Guru-Chandala yoga: wisdom tested by ambition.', 'Unconventional beliefs or a challenge to tradition. Can produce brilliant innovators or misguided teachers depending on strength.', -1],
  'jupiter+ketu': ['Jupiter–Ketu: spiritual wisdom.', 'Strong spiritual and philosophical inclination, intuition and detachment.', 1],
  'saturn+venus': ['Venus–Saturn: lasting love and discipline in art.', 'Friends by nature. Loyal relationships, artistic craft and steady wealth, though love may come late.', 1],
  'rahu+venus': ['Venus–Rahu: unconventional desire.', 'Magnetism, glamour and creative innovation, but obsession or unusual relationships.', -1],
  'ketu+venus': ['Venus–Ketu: spiritual love.', 'Artistic intuition and spiritual devotion, but dissatisfaction in relationships.', -1],
  'rahu+saturn': ['Saturn–Rahu: Shrapit-type karma.', 'Heavy karmic burdens, delays and fears, but also great endurance and unconventional success.', -2],
  'ketu+saturn': ['Saturn–Ketu: disciplined detachment.', 'Spiritual discipline and renunciation, but losses or isolation.', -1],
};

export const conjunctionKey = (a: PlanetId, b: PlanetId): string => [a, b].sort().join('+');

/** Short meaning of a planet's aspect (drishti) on a house, by planet. */
export const ASPECT_FLAVOR: Record<PlanetId, string> = {
  sun: 'brings authority, visibility and some heat to',
  moon: 'brings emotional attention, care and fluctuation to',
  mars: 'energises, but can also inflame or cause conflict in',
  mercury: 'brings intelligence, communication and versatility to',
  jupiter: 'protects, expands and blesses',
  venus: 'brings harmony, beauty and pleasure to',
  saturn: 'brings discipline, delay and long-term structure to',
  rahu: 'amplifies desire, ambition and unpredictability in',
  ketu: 'brings detachment, insight and sudden change to',
};

export const SPECIAL_ASPECT_NOTES: Partial<Record<PlanetId, Record<number, string>>> = {
  mars: { 4: 'Mars’ 4th aspect protects and pushes the house it falls on, like a guard.', 8: 'Mars’ 8th aspect can bring sudden events or intensity to the house it falls on.' },
  jupiter: { 5: 'Jupiter’s 5th aspect blesses with intelligence and grace.', 9: 'Jupiter’s 9th aspect blesses with fortune and dharma.' },
  saturn: { 3: 'Saturn’s 3rd aspect demands effort and persistence.', 10: 'Saturn’s 10th aspect brings responsibility and karmic pressure.' },
  rahu: { 5: 'Rahu’s 5th aspect (in some traditions) stirs obsession.', 9: 'Rahu’s 9th aspect (in some traditions) unsettles belief.' },
  ketu: { 5: 'Ketu’s 5th aspect (in some traditions) brings detachment.', 9: 'Ketu’s 9th aspect (in some traditions) brings spiritual questioning.' },
};
