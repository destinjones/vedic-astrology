import type { PlanetId } from '../types';

export interface NakshatraProfile {
  number: number;
  id: string;
  name: string;
  lord: PlanetId;
  deity: string;
  symbol: string;
  gana: 'deva' | 'manushya' | 'rakshasa';
  /** The power (shakti) the nakshatra grants. */
  shakti: string;
  /** Short motivation used in composed text. */
  motivation: 'dharma' | 'artha' | 'kama' | 'moksha';
  nature: string;
  keywords: string[];
  /** A few sentences in plain English. */
  description: string;
  gifts: string[];
  shadows: string[];
  /** Short note on each pada (quarter). Padas follow the navamsa sign sequence. */
  padas: [string, string, string, string];
  /** Start of the nakshatra in sidereal degrees. */
  start: number;
}

const SPAN = 360 / 27;

const raw: Omit<NakshatraProfile, 'start'>[] = [
  {
    number: 1, id: 'ashwini', name: 'Ashwini', lord: 'ketu', deity: 'the Ashwini Kumaras, physicians of the gods', symbol: "a horse's head", gana: 'deva',
    shakti: 'the power to reach things quickly (shidhra vyapani)', motivation: 'dharma', nature: 'swift and light',
    keywords: ['speed', 'healing', 'beginnings', 'youthfulness'],
    description: 'Ashwini is the first light of the zodiac. It moves fast, heals fast and starts things before anyone else is ready. People strongly marked by it are often energetic, helpful and a little impatient, with a knack for emergency fixes and fresh starts.',
    gifts: ['quick recovery', 'healing ability', 'courage to begin', 'resourcefulness'],
    shadows: ['impulsiveness', 'starting more than is finished', 'restlessness'],
    padas: ['Aries navamsa: pure drive, pioneering and competitive.', 'Taurus navamsa: practical healer, steadier and more material.', 'Gemini navamsa: inventive, communicative and versatile.', 'Cancer navamsa: caring, protective and emotionally responsive.'],
  },
  {
    number: 2, id: 'bharani', name: 'Bharani', lord: 'venus', deity: 'Yama, lord of death and dharma', symbol: 'the yoni, the womb', gana: 'manushya',
    shakti: 'the power to carry things away (apabharani)', motivation: 'artha', nature: 'fierce and creative',
    keywords: ['birth and death', 'restraint', 'intensity', 'responsibility'],
    description: 'Bharani carries life through its passages: birth, death, pleasure and moral limits. It gives intense appetites and the strength to bear heavy responsibilities. It asks for honesty with oneself about desire and duty.',
    gifts: ['endurance', 'creative fertility', 'moral courage', 'capacity to carry burdens'],
    shadows: ['extremes of indulgence or restraint', 'jealousy', 'judgmental streak'],
    padas: ['Leo navamsa: proud, creative and self-assured.', 'Virgo navamsa: disciplined, service-oriented and detail-focused.', 'Libra navamsa: harmonious, artistic and pleasure-loving.', 'Scorpio navamsa: deep, secretive and transformative.'],
  },
  {
    number: 3, id: 'krittika', name: 'Krittika', lord: 'sun', deity: 'Agni, the god of fire', symbol: 'a razor or a flame', gana: 'rakshasa',
    shakti: 'the power to burn and purify (dahana)', motivation: 'kama', nature: 'sharp and mixed',
    keywords: ['purification', 'cutting', 'nourishment', 'standards'],
    description: 'Krittika cuts through the false. It is honest to the point of bluntness and holds high standards, yet it also cooks and nourishes like the household fire. People marked by it are protective, determined and allergic to pretence.',
    gifts: ['clarity', 'determination', 'protective instinct', 'ability to refine'],
    shadows: ['harsh speech', 'stubbornness', 'quick temper'],
    padas: ['Sagittarius navamsa: principled, generous and philosophical.', 'Capricorn navamsa: ambitious, disciplined and practical.', 'Aquarius navamsa: humanitarian, idealistic and cerebral.', 'Pisces navamsa: compassionate, devotional and gentle.'],
  },
  {
    number: 4, id: 'rohini', name: 'Rohini', lord: 'moon', deity: 'Brahma (Prajapati), the creator', symbol: 'an ox cart or chariot', gana: 'manushya',
    shakti: 'the power of growth (rohana)', motivation: 'moksha', nature: 'fixed and fertile',
    keywords: ['beauty', 'fertility', 'growth', 'attraction'],
    description: 'Rohini is the Moon’s favourite. It is lush, magnetic and creative, and it makes things grow. People strongly marked by it are often attractive, artistic and fond of comfort, with a talent for cultivating wealth and relationships.',
    gifts: ['charm', 'artistic sense', 'abundance', 'nurturing growth'],
    shadows: ['possessiveness', 'materialism', 'jealousy'],
    padas: ['Aries navamsa: energetic and assertive in pursuit of comfort.', 'Taurus navamsa: the most sensual and wealth-building quarter.', 'Gemini navamsa: witty, artistic and sociable.', 'Cancer navamsa: emotionally rich, domestic and devoted.'],
  },
  {
    number: 5, id: 'mrigashira', name: 'Mrigashira', lord: 'mars', deity: 'Soma, the moon nectar', symbol: "a deer's head", gana: 'deva',
    shakti: 'the power to give fulfilment (prinana)', motivation: 'moksha', nature: 'soft and searching',
    keywords: ['seeking', 'curiosity', 'gentleness', 'travel'],
    description: 'Mrigashira is the searching deer. It is curious, sensitive and always looking for the next thing, whether an idea, a place or a person. It gives a gentle intelligence and a love of research, travel and conversation.',
    gifts: ['curiosity', 'perceptiveness', 'gentleness', 'research skill'],
    shadows: ['restlessness', 'suspicion', 'difficulty settling'],
    padas: ['Leo navamsa: confident seeker, drawn to self-expression.', 'Virgo navamsa: analytical, studious and communicative.', 'Libra navamsa: social, artistic and relationship-seeking.', 'Scorpio navamsa: intense, investigative and passionate.'],
  },
  {
    number: 6, id: 'ardra', name: 'Ardra', lord: 'rahu', deity: 'Rudra, the storm god', symbol: 'a teardrop or diamond', gana: 'manushya',
    shakti: 'the power of effort (yatna)', motivation: 'kama', nature: 'sharp and stormy',
    keywords: ['storms', 'breakthrough', 'emotion', 'intellect'],
    description: 'Ardra is the storm that clears the air. It brings upheaval, tears and then renewal. People strongly marked by it have penetrating minds, strong emotions and the capacity to rebuild after destruction, often excelling in technology, research or crisis work.',
    gifts: ['mental sharpness', 'resilience', 'capacity for breakthrough', 'honesty about pain'],
    shadows: ['emotional turbulence', 'destructiveness', 'arrogance'],
    padas: ['Sagittarius navamsa: questioning, philosophical and outspoken.', 'Capricorn navamsa: ambitious and hardworking through hardship.', 'Aquarius navamsa: innovative, humanitarian and technological.', 'Pisces navamsa: emotional, empathic and healing.'],
  },
  {
    number: 7, id: 'punarvasu', name: 'Punarvasu', lord: 'jupiter', deity: 'Aditi, the boundless mother', symbol: 'a quiver of arrows', gana: 'deva',
    shakti: 'the power to regain wealth or vitality (vasutva prapana)', motivation: 'artha', nature: 'movable and renewing',
    keywords: ['return', 'renewal', 'optimism', 'home'],
    description: 'Punarvasu is the return of light after the storm. It restores, forgives and starts again. People marked by it are generous, philosophical and content with simple things, and they bounce back from setbacks better than most.',
    gifts: ['resilience', 'kindness', 'wisdom', 'contentment'],
    shadows: ['complacency', 'naivety', 'inconsistency'],
    padas: ['Aries navamsa: active, adventurous and bold.', 'Taurus navamsa: practical, earthy and resource-minded.', 'Gemini navamsa: intellectual, talkative and curious.', 'Cancer navamsa: the most nurturing and devotional quarter.'],
  },
  {
    number: 8, id: 'pushya', name: 'Pushya', lord: 'saturn', deity: 'Brihaspati, teacher of the gods', symbol: "a cow's udder or a flower", gana: 'deva',
    shakti: 'the power to create spiritual energy (brahmavarchasa)', motivation: 'dharma', nature: 'light and nourishing',
    keywords: ['nourishment', 'devotion', 'care', 'tradition'],
    description: 'Pushya is considered the most auspicious nakshatra. It feeds, protects and teaches. People marked by it are dutiful, caring and respectful of tradition, and they often take on the role of provider or counsellor.',
    gifts: ['nurturing', 'reliability', 'devotion', 'good counsel'],
    shadows: ['over-protectiveness', 'rigidity', 'self-sacrifice to excess'],
    padas: ['Leo navamsa: proud, generous provider.', 'Virgo navamsa: practical, analytical and helpful.', 'Libra navamsa: diplomatic, family- and home-centred.', 'Scorpio navamsa: deep, psychic and protective.'],
  },
  {
    number: 9, id: 'ashlesha', name: 'Ashlesha', lord: 'mercury', deity: 'the Nagas, serpent deities', symbol: 'a coiled serpent', gana: 'rakshasa',
    shakti: 'the power to inflict poison (visasleshana)', motivation: 'dharma', nature: 'sharp and binding',
    keywords: ['hypnotism', 'intuition', 'secrecy', 'kundalini'],
    description: 'Ashlesha coils and binds. It gives hypnotic insight into people, strategic intelligence and strong instincts for self-protection. Used well it heals and transforms; used poorly it manipulates.',
    gifts: ['psychological insight', 'strategy', 'charisma', 'mystical depth'],
    shadows: ['manipulation', 'suspicion', 'clinginess'],
    padas: ['Sagittarius navamsa: philosophical and less guarded.', 'Capricorn navamsa: ambitious and calculating.', 'Aquarius navamsa: unconventional, secretive and inventive.', 'Pisces navamsa: deeply intuitive and occult-minded.'],
  },
  {
    number: 10, id: 'magha', name: 'Magha', lord: 'ketu', deity: 'the Pitris, the ancestors', symbol: 'a royal throne', gana: 'rakshasa',
    shakti: 'the power to leave the body (tyaga kshepani)', motivation: 'artha', nature: 'fierce and regal',
    keywords: ['ancestry', 'royalty', 'tradition', 'honour'],
    description: 'Magha is the ancestral throne. It gives dignity, a sense of lineage and natural authority. People marked by it respect tradition, want to be honoured and often carry family duties or a legacy.',
    gifts: ['leadership', 'loyalty to lineage', 'generosity', 'presence'],
    shadows: ['arrogance', 'entitlement', 'living in the past'],
    padas: ['Aries navamsa: ambitious and commanding.', 'Taurus navamsa: wealth-minded and steady.', 'Gemini navamsa: intellectual and communicative.', 'Cancer navamsa: devoted to family and ancestors.'],
  },
  {
    number: 11, id: 'purva-phalguni', name: 'Purva Phalguni', lord: 'venus', deity: 'Bhaga, god of delight and fortune', symbol: 'the front legs of a bed or a hammock', gana: 'manushya',
    shakti: 'the power of procreation (prajanana)', motivation: 'kama', nature: 'fierce and pleasurable',
    keywords: ['pleasure', 'romance', 'rest', 'creativity'],
    description: 'Purva Phalguni is the reward after work. It loves leisure, romance, art and celebration. People marked by it are warm, sociable and generous, and they need beauty and enjoyment to feel alive.',
    gifts: ['charm', 'creativity', 'generosity', 'social ease'],
    shadows: ['laziness', 'vanity', 'indulgence'],
    padas: ['Leo navamsa: dramatic, proud and creative.', 'Virgo navamsa: refined and practical in enjoyment.', 'Libra navamsa: romantic, artistic and diplomatic.', 'Scorpio navamsa: passionate and intense.'],
  },
  {
    number: 12, id: 'uttara-phalguni', name: 'Uttara Phalguni', lord: 'sun', deity: 'Aryaman, god of contracts and friendship', symbol: 'the back legs of a bed', gana: 'manushya',
    shakti: 'the power of prosperity through union (chayani)', motivation: 'moksha', nature: 'fixed and kind',
    keywords: ['patronage', 'agreements', 'loyalty', 'service'],
    description: 'Uttara Phalguni keeps its word. It favours partnerships, contracts and lasting friendship. People marked by it are dependable, helpful and fair, and they often succeed through patrons or social bonds.',
    gifts: ['reliability', 'generosity', 'organisational skill', 'loyal friendship'],
    shadows: ['dependence on others’ approval', 'pride', 'over-commitment'],
    padas: ['Sagittarius navamsa: principled and philosophical.', 'Capricorn navamsa: practical, dutiful and ambitious.', 'Aquarius navamsa: humanitarian and networked.', 'Pisces navamsa: compassionate and spiritual.'],
  },
  {
    number: 13, id: 'hasta', name: 'Hasta', lord: 'moon', deity: 'Savitar, the creative sun', symbol: 'an open hand', gana: 'deva',
    shakti: 'the power to put what we seek into our hands (hasta sthapaniya)', motivation: 'moksha', nature: 'light and skilful',
    keywords: ['craft', 'dexterity', 'humour', 'healing touch'],
    description: 'Hasta is the skilled hand. It gives manual and mental dexterity, wit and a practical knack for getting results. People marked by it are clever, helpful and good with crafts, healing or detail work.',
    gifts: ['skill', 'humour', 'resourcefulness', 'healing hands'],
    shadows: ['restlessness', 'cunning', 'anxiety over control'],
    padas: ['Aries navamsa: energetic and competitive.', 'Taurus navamsa: practical and material.', 'Gemini navamsa: communicative and clever.', 'Cancer navamsa: nurturing and intuitive.'],
  },
  {
    number: 14, id: 'chitra', name: 'Chitra', lord: 'mars', deity: 'Vishvakarma (Tvashtar), the divine architect', symbol: 'a bright jewel', gana: 'rakshasa',
    shakti: 'the power to accumulate merit (punya cayani)', motivation: 'kama', nature: 'soft and brilliant',
    keywords: ['design', 'beauty', 'craftsmanship', 'charisma'],
    description: 'Chitra is the shining jewel and the architect. It loves design, colour and form, and it builds things that dazzle. People marked by it are stylish, inventive and want their work to be admired.',
    gifts: ['design talent', 'charisma', 'craftsmanship', 'vision'],
    shadows: ['vanity', 'self-centredness', 'restless desire'],
    padas: ['Leo navamsa: proud and showy.', 'Virgo navamsa: precise and technical.', 'Libra navamsa: artistic and balanced.', 'Scorpio navamsa: intense and secretive.'],
  },
  {
    number: 15, id: 'swati', name: 'Swati', lord: 'rahu', deity: 'Vayu, the wind', symbol: 'a young shoot swaying in the wind', gana: 'deva',
    shakti: 'the power to scatter like the wind (pradhvamsa)', motivation: 'artha', nature: 'movable and independent',
    keywords: ['independence', 'trade', 'flexibility', 'movement'],
    description: 'Swati bends without breaking. It values freedom, fair dealing and self-direction, and it often makes good traders, diplomats and independent professionals. It needs room to move.',
    gifts: ['adaptability', 'business sense', 'diplomacy', 'independence'],
    shadows: ['indecision', 'restlessness', 'difficulty committing'],
    padas: ['Sagittarius navamsa: philosophical and wide-ranging.', 'Capricorn navamsa: commercial and ambitious.', 'Aquarius navamsa: idealistic and inventive.', 'Pisces navamsa: spiritual and imaginative.'],
  },
  {
    number: 16, id: 'vishakha', name: 'Vishakha', lord: 'jupiter', deity: 'Indra and Agni', symbol: 'a triumphal arch', gana: 'rakshasa',
    shakti: 'the power to achieve many goals (vyapana)', motivation: 'dharma', nature: 'mixed and goal-driven',
    keywords: ['ambition', 'determination', 'focus', 'triumph'],
    description: 'Vishakha aims at the arch of victory. It is single-minded and determined, willing to wait and work for a goal. People marked by it are ambitious, persuasive and passionate, and they often succeed later in life.',
    gifts: ['perseverance', 'goal focus', 'passion', 'leadership'],
    shadows: ['jealousy', 'ends-justify-means thinking', 'frustration'],
    padas: ['Aries navamsa: competitive and bold.', 'Taurus navamsa: persistent and wealth-focused.', 'Gemini navamsa: intellectual and persuasive.', 'Cancer navamsa: emotional and devoted.'],
  },
  {
    number: 17, id: 'anuradha', name: 'Anuradha', lord: 'saturn', deity: 'Mitra, god of friendship', symbol: 'a lotus', gana: 'deva',
    shakti: 'the power of worship (radhana)', motivation: 'dharma', nature: 'soft and devoted',
    keywords: ['friendship', 'devotion', 'cooperation', 'success abroad'],
    description: 'Anuradha is the lotus that blooms in mud. It forms loyal friendships and succeeds through cooperation, often far from home. People marked by it are devoted, organised and able to stay steady in difficult conditions.',
    gifts: ['loyalty', 'organisation', 'devotion', 'endurance'],
    shadows: ['melancholy', 'jealousy', 'control issues'],
    padas: ['Leo navamsa: dignified and leading.', 'Virgo navamsa: methodical and service-oriented.', 'Libra navamsa: relationship-centred and diplomatic.', 'Scorpio navamsa: intense and occult.'],
  },
  {
    number: 18, id: 'jyeshtha', name: 'Jyeshtha', lord: 'mercury', deity: 'Indra, king of the gods', symbol: 'a circular amulet or umbrella', gana: 'rakshasa',
    shakti: 'the power to rise and conquer (arohana)', motivation: 'artha', nature: 'sharp and senior',
    keywords: ['seniority', 'protection', 'power', 'responsibility'],
    description: 'Jyeshtha is the eldest. It carries authority, protectiveness and the burden of responsibility. People marked by it are resourceful and capable of leadership but may feel isolated or overburdened.',
    gifts: ['courage', 'protectiveness', 'resourcefulness', 'authority'],
    shadows: ['arrogance', 'secrecy', 'loneliness at the top'],
    padas: ['Sagittarius navamsa: generous and principled.', 'Capricorn navamsa: ambitious and controlling.', 'Aquarius navamsa: unusual and independent.', 'Pisces navamsa: intuitive and spiritual.'],
  },
  {
    number: 19, id: 'mula', name: 'Mula', lord: 'ketu', deity: 'Nirriti, goddess of dissolution', symbol: 'a bunch of roots', gana: 'rakshasa',
    shakti: 'the power to ruin or destroy (barhana)', motivation: 'kama', nature: 'sharp and radical',
    keywords: ['roots', 'investigation', 'uprooting', 'truth'],
    description: 'Mula goes to the root. It tears down what is false to find what is real, and it often brings upheaval before clarity. People marked by it are investigators, philosophers and radicals who are not afraid of extremes.',
    gifts: ['depth', 'research ability', 'courage', 'spiritual seeking'],
    shadows: ['destructiveness', 'feeling uprooted', 'extremism'],
    padas: ['Aries navamsa: bold and energetic.', 'Taurus navamsa: stable and material.', 'Gemini navamsa: intellectual and curious.', 'Cancer navamsa: emotional and protective.'],
  },
  {
    number: 20, id: 'purva-ashadha', name: 'Purva Ashadha', lord: 'venus', deity: 'Apas, the cosmic waters', symbol: 'a fan or winnowing basket', gana: 'manushya',
    shakti: 'the power to invigorate (varchograhana)', motivation: 'moksha', nature: 'fierce and invincible',
    keywords: ['invincibility', 'purification', 'conviction', 'charm'],
    description: 'Purva Ashadha is the early, undefeated victory. It gives conviction, persuasiveness and pride. People marked by it are inspiring, fond of debate and hard to stop once committed.',
    gifts: ['conviction', 'persuasion', 'resilience', 'charm'],
    shadows: ['stubbornness', 'arrogance', 'overconfidence'],
    padas: ['Leo navamsa: proud and ambitious.', 'Virgo navamsa: analytical and service-minded.', 'Libra navamsa: diplomatic and artistic.', 'Scorpio navamsa: intense and secretive.'],
  },
  {
    number: 21, id: 'uttara-ashadha', name: 'Uttara Ashadha', lord: 'sun', deity: 'the Vishvedevas, the universal gods', symbol: "an elephant's tusk", gana: 'manushya',
    shakti: 'the power to grant unchallengeable victory (apradhrishya)', motivation: 'moksha', nature: 'fixed and righteous',
    keywords: ['integrity', 'final victory', 'leadership', 'responsibility'],
    description: 'Uttara Ashadha is the lasting victory. It is principled, patient and committed to doing the right thing over time. People marked by it make reliable leaders and often achieve recognition through integrity.',
    gifts: ['integrity', 'leadership', 'patience', 'sense of duty'],
    shadows: ['rigidity', 'stubbornness', 'over-seriousness'],
    padas: ['Sagittarius navamsa: idealistic and ethical.', 'Capricorn navamsa: ambitious and responsible.', 'Aquarius navamsa: humanitarian and inventive.', 'Pisces navamsa: compassionate and devotional.'],
  },
  {
    number: 22, id: 'shravana', name: 'Shravana', lord: 'moon', deity: 'Vishnu, the preserver', symbol: 'an ear, or three footprints', gana: 'deva',
    shakti: 'the power of connection (samhanana)', motivation: 'artha', nature: 'movable and receptive',
    keywords: ['listening', 'learning', 'knowledge', 'connection'],
    description: 'Shravana is the listening ear. It learns by hearing, connects people and preserves knowledge. People marked by it are good students and teachers, attentive to tradition and often successful in media or education.',
    gifts: ['listening', 'learning', 'organisation', 'connection'],
    shadows: ['gossip', 'rigidity', 'sensitivity to criticism'],
    padas: ['Aries navamsa: ambitious and active.', 'Taurus navamsa: practical and wealth-minded.', 'Gemini navamsa: communicative and studious.', 'Cancer navamsa: nurturing and devotional.'],
  },
  {
    number: 23, id: 'dhanishta', name: 'Dhanishta', lord: 'mars', deity: 'the eight Vasus, gods of abundance', symbol: 'a drum', gana: 'rakshasa',
    shakti: 'the power to give abundance and fame (khyapayitri)', motivation: 'dharma', nature: 'movable and rhythmic',
    keywords: ['wealth', 'music', 'rhythm', 'fame'],
    description: 'Dhanishta is the drum of plenty. It gives rhythm, musical or athletic talent, and the ability to attract wealth and recognition. People marked by it are generous, ambitious and good in groups.',
    gifts: ['rhythm', 'generosity', 'adaptability', 'prosperity'],
    shadows: ['arrogance', 'marital difficulty', 'materialism'],
    padas: ['Leo navamsa: ambitious and proud.', 'Virgo navamsa: practical and skilful.', 'Libra navamsa: social and musical.', 'Scorpio navamsa: intense and energetic.'],
  },
  {
    number: 24, id: 'shatabhisha', name: 'Shatabhisha', lord: 'rahu', deity: 'Varuna, lord of the cosmic waters', symbol: 'an empty circle', gana: 'rakshasa',
    shakti: 'the power to heal (bheshaja)', motivation: 'dharma', nature: 'movable and secretive',
    keywords: ['healing', 'mystery', 'solitude', 'science'],
    description: 'Shatabhisha is the hundred healers. It is secretive, scientific and philosophical, often drawn to medicine, technology, astrology or research. People marked by it value privacy and independent thought.',
    gifts: ['healing ability', 'scientific mind', 'independence', 'philosophical depth'],
    shadows: ['isolation', 'secrecy', 'emotional coldness'],
    padas: ['Sagittarius navamsa: philosophical and optimistic.', 'Capricorn navamsa: ambitious and practical.', 'Aquarius navamsa: the most visionary and unconventional quarter.', 'Pisces navamsa: compassionate and mystical.'],
  },
  {
    number: 25, id: 'purva-bhadrapada', name: 'Purva Bhadrapada', lord: 'jupiter', deity: 'Aja Ekapada, the one-footed goat', symbol: 'a sword or the front of a funeral cot', gana: 'manushya',
    shakti: 'the power to raise the spiritual level (yajamana udyamana)', motivation: 'artha', nature: 'fierce and idealistic',
    keywords: ['intensity', 'idealism', 'transformation', 'duality'],
    description: 'Purva Bhadrapada burns with idealism. It can be fiercely passionate about causes and capable of great sacrifice. People marked by it often live with an inner duality between worldly and spiritual pulls.',
    gifts: ['passion', 'idealism', 'spiritual intensity', 'courage'],
    shadows: ['extremism', 'anxiety', 'cynicism'],
    padas: ['Aries navamsa: bold and energetic.', 'Taurus navamsa: practical and determined.', 'Gemini navamsa: intellectual and communicative.', 'Cancer navamsa: emotional and protective.'],
  },
  {
    number: 26, id: 'uttara-bhadrapada', name: 'Uttara Bhadrapada', lord: 'saturn', deity: 'Ahir Budhnya, the serpent of the deep', symbol: 'the back legs of a funeral cot, or twins', gana: 'manushya',
    shakti: 'the power to bring rain (varshodyamana)', motivation: 'kama', nature: 'fixed and deep',
    keywords: ['depth', 'wisdom', 'restraint', 'compassion'],
    description: 'Uttara Bhadrapada is the calm deep water. It gives wisdom, self-control and compassion. People marked by it are thoughtful, generous and able to stay steady through hardship.',
    gifts: ['wisdom', 'patience', 'compassion', 'self-control'],
    shadows: ['laziness', 'withdrawal', 'melancholy'],
    padas: ['Leo navamsa: proud and generous.', 'Virgo navamsa: practical and service-oriented.', 'Libra navamsa: diplomatic and harmonious.', 'Scorpio navamsa: deep and occult.'],
  },
  {
    number: 27, id: 'revati', name: 'Revati', lord: 'mercury', deity: 'Pushan, the nourisher and guide of travellers', symbol: 'a fish or a drum', gana: 'deva',
    shakti: 'the power of nourishment (kshiradyapani)', motivation: 'moksha', nature: 'soft and guiding',
    keywords: ['completion', 'guidance', 'protection', 'compassion'],
    description: 'Revati is the end of the journey and the guide who gets you home. It is gentle, imaginative and protective of the vulnerable. People marked by it are kind, artistic and spiritually inclined.',
    gifts: ['compassion', 'creativity', 'guidance', 'faith'],
    shadows: ['over-sensitivity', 'escapism', 'naivety'],
    padas: ['Sagittarius navamsa: optimistic and philosophical.', 'Capricorn navamsa: practical and ambitious.', 'Aquarius navamsa: humanitarian and inventive.', 'Pisces navamsa: deeply spiritual and compassionate.'],
  },
];

export const NAKSHATRAS: NakshatraProfile[] = raw.map((n) => ({ ...n, start: (n.number - 1) * SPAN }));

export const getNakshatra = (n: number): NakshatraProfile => NAKSHATRAS[(((n - 1) % 27) + 27) % 27];

export const nakshatraFromLongitude = (lon: number): { nakshatra: number; pada: 1 | 2 | 3 | 4 } => {
  const l = ((lon % 360) + 360) % 360;
  const idx = Math.floor(l / SPAN);
  const pada = (Math.floor((l - idx * SPAN) / (SPAN / 4)) + 1) as 1 | 2 | 3 | 4;
  return { nakshatra: idx + 1, pada };
};
