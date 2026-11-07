import type { GrahaId } from '@vedic/engine';
import type { GrahaRemedySet } from './types';

/** Vimshottari mahadasha years, for the alternative japa count. */
export const DASHA_YEARS: Record<GrahaId, number> = {
  sun: 6, moon: 10, mars: 7, mercury: 17, jupiter: 16, venus: 20, saturn: 19, rahu: 18, ketu: 7,
};

/** Sun's square; every later graha adds 1 to each cell, so the total rises by 3. */
const BASE_SQUARE = [[6, 1, 8], [7, 5, 3], [2, 9, 4]];
const YANTRA_ORDER: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
export const yantraGrid = (g: GrahaId): number[][] => {
  const k = YANTRA_ORDER.indexOf(g);
  return BASE_SQUARE.map((row) => row.map((n) => n + k));
};
const yantra = (g: GrahaId) => ({ total: 15 + 3 * YANTRA_ORDER.indexOf(g), grid: yantraGrid(g), cite: [{ source: 'navagraha_yantra' as const }] });

const gemCite = [{ source: 'gem_tradition' as const }];
const mantraCite = [{ source: 'bija_tradition' as const }, { source: 'japa_counts' as const }, { source: 'bphs_dasha_shanti' as const }];
const charityCite = [{ source: 'yajnavalkya_grahashanti' as const }, { source: 'bphs_dasha_shanti' as const }];
const fastCite = [{ source: 'vrata_tradition' as const }];
const stotra = (incipit: string) => ({ incipit, cite: { source: 'vyasa_stotra' as const } });
const mantra = (g: GrahaId, name: string, bija: string, vedic: GrahaRemedySet['mantra']['vedic'], count: number): GrahaRemedySet['mantra'] => ({
  name, bija, vedic, count, vimshottariCount: DASHA_YEARS[g] * 1000, cite: mantraCite,
});

/**
 * The remedy set for each graha. Mantras, counts, gifts and homa woods are
 * traditional and quoted as such; the practice lines are original writing.
 */
export const REMEDY_SETS: Record<GrahaId, GrahaRemedySet> = {
  sun: {
    graha: 'sun', name: 'Sun', sanskrit: 'Surya', colour: 'red, copper',
    gem: { name: 'Ruby', sanskrit: 'Manikya', substitutes: ['red garnet', 'red spinel'], metal: 'gold or copper', finger: 'ring finger', cite: gemCite },
    mantra: mantra('sun', 'Om Suryaya Namah', 'Om Hram Hrim Hraum Sah Suryaya Namah', { incipit: 'Ā kṛṣṇena rajasā vartamāno …', cite: { source: 'rigveda', locus: '1.35.2' } }, 7000),
    yantra: yantra('sun'),
    charity: { items: ['wheat', 'jaggery', 'copper', 'red cloth'], dakshina: 'a cow', samidh: 'arka (crown flower)', serve: 'fathers, mentors and people in public service', cite: charityCite },
    fast: { day: 'Sunday', note: 'One meal taken before sunset, without salt in stricter custom.', cite: fastCite },
    stotra: stotra('Japākusuma saṅkāśaṃ kāśyapeyaṃ mahādyutim …'),
    practice: 'Rise early and greet the sunrise. Keep promises to people who depend on you, and take responsibility before claiming credit.',
  },
  moon: {
    graha: 'moon', name: 'Moon', sanskrit: 'Chandra', colour: 'white, silver',
    gem: { name: 'Pearl', sanskrit: 'Moti (Mukta)', substitutes: ['moonstone'], metal: 'silver', finger: 'little finger', cite: gemCite },
    mantra: mantra('moon', 'Om Chandraya Namah', 'Om Shram Shrim Shraum Sah Chandraya Namah', { incipit: 'Imaṃ devā asapatnaṃ suvadhvam …', cite: { source: 'yajurveda', locus: '9.40' } }, 11000),
    yantra: yantra('moon'),
    charity: { items: ['white rice', 'milk', 'white cloth', 'silver'], dakshina: 'a conch', samidh: 'palasha (flame of the forest)', serve: 'mothers, carers and anyone grieving', cite: charityCite },
    fast: { day: 'Monday', note: 'Milk, fruit or one simple meal. Many keep it on full-moon days instead.', cite: fastCite },
    stotra: stotra('Dadhiśaṅkha tuṣārābhaṃ kṣīrodārṇava sambhavam …'),
    practice: 'Protect your sleep and keep a steady daily rhythm. Call your mother or someone who mothered you, and spend time near water.',
  },
  mars: {
    graha: 'mars', name: 'Mars', sanskrit: 'Mangala', colour: 'red, coral',
    gem: { name: 'Red coral', sanskrit: 'Moonga (Pravala)', substitutes: ['carnelian'], metal: 'gold or copper', finger: 'ring finger', cite: gemCite },
    mantra: mantra('mars', 'Om Mangalaya Namah', 'Om Kram Krim Kraum Sah Bhaumaya Namah', { incipit: 'Agnir mūrdhā divaḥ kakut …', cite: { source: 'rigveda', locus: '8.44.16' } }, 10000),
    yantra: yantra('mars'),
    charity: { items: ['red lentils (masoor)', 'jaggery', 'red cloth', 'copper'], dakshina: 'a red bull', samidh: 'khadira (cutch tree)', serve: 'brothers, soldiers, firefighters and blood banks', cite: charityCite },
    fast: { day: 'Tuesday', note: 'Often kept with Hanuman worship. Sweet food rather than salt.', cite: fastCite },
    stotra: stotra('Dharaṇīgarbha sambhūtaṃ vidyutkānti samaprabham …'),
    practice: 'Give anger a physical outlet: hard exercise or a martial art. Settle disputes with siblings and neighbours before they harden.',
  },
  mercury: {
    graha: 'mercury', name: 'Mercury', sanskrit: 'Budha', colour: 'green',
    gem: { name: 'Emerald', sanskrit: 'Panna (Marakata)', substitutes: ['peridot', 'green tourmaline'], metal: 'gold', finger: 'little finger', cite: gemCite },
    mantra: mantra('mercury', 'Om Budhaya Namah', 'Om Bram Brim Braum Sah Budhaya Namah', { incipit: 'Udbudhyasvāgne prati jāgṛhi …', cite: { source: 'yajurveda', locus: '15.54' } }, 9000),
    yantra: yantra('mercury'),
    charity: { items: ['green gram (moong)', 'green cloth', 'books and stationery'], dakshina: 'gold', samidh: 'apamarga (prickly chaff flower)', serve: 'students, young relatives and people learning to read', cite: charityCite },
    fast: { day: 'Wednesday', note: 'One meal, often of green gram.', cite: fastCite },
    stotra: stotra('Priyaṅgu kalikā śyāmaṃ rūpeṇāpratimaṃ budham …'),
    practice: 'Write things down and keep accounts honest. Speak plainly, check facts before repeating them, and teach someone a skill you have.',
  },
  jupiter: {
    graha: 'jupiter', name: 'Jupiter', sanskrit: 'Guru (Brihaspati)', colour: 'yellow',
    gem: { name: 'Yellow sapphire', sanskrit: 'Pukhraj (Pushparaga)', substitutes: ['citrine', 'yellow topaz'], metal: 'gold', finger: 'index finger', cite: gemCite },
    mantra: mantra('jupiter', 'Om Gurave Namah', 'Om Gram Grim Graum Sah Gurave Namah', { incipit: 'Bṛhaspate ati yad aryo arhāt …', cite: { source: 'rigveda', locus: '2.23.15' } }, 19000),
    yantra: yantra('jupiter'),
    charity: { items: ['turmeric', 'chana dal', 'yellow cloth', 'ghee', 'books'], dakshina: 'yellow cloth', samidh: 'ashvattha (sacred fig)', serve: 'teachers, priests, elders and children', cite: charityCite },
    fast: { day: 'Thursday', note: 'One meal, often yellow food, sometimes with banana-tree worship.', cite: fastCite },
    stotra: stotra('Devānāṃ ca ṛṣīṇāṃ ca guruṃ kāñcana sannibham …'),
    practice: 'Study something serious and share it. Honour your teachers, keep your word on money, and give advice only when asked.',
  },
  venus: {
    graha: 'venus', name: 'Venus', sanskrit: 'Shukra', colour: 'white, pastel',
    gem: { name: 'Diamond', sanskrit: 'Heera (Vajra)', substitutes: ['white sapphire', 'white zircon'], metal: 'silver or platinum', finger: 'middle or ring finger (lineages differ)', cite: gemCite },
    mantra: mantra('venus', 'Om Shukraya Namah', 'Om Dram Drim Draum Sah Shukraya Namah', { incipit: 'Annāt parisruto rasaṃ …', cite: { source: 'yajurveda', locus: '19.75' } }, 16000),
    yantra: yantra('venus'),
    charity: { items: ['white rice', 'sugar', 'ghee', 'white cloth', 'perfume'], dakshina: 'a white horse', samidh: 'udumbara (cluster fig)', serve: 'women in need, artists and couples starting out', cite: charityCite },
    fast: { day: 'Friday', note: 'One meal, often sweet, sometimes with Lakshmi puja.', cite: fastCite },
    stotra: stotra('Himakunda mṛṇālābhaṃ daityānāṃ paramaṃ gurum …'),
    practice: 'Treat your partner with courtesy in small things. Keep your surroundings clean and beautiful, and make room for art you love.',
  },
  saturn: {
    graha: 'saturn', name: 'Saturn', sanskrit: 'Shani', colour: 'black, dark blue',
    gem: { name: 'Blue sapphire', sanskrit: 'Neelam (Indranila)', substitutes: ['amethyst', 'blue spinel'], metal: 'silver, iron or panchadhatu', finger: 'middle finger', cite: gemCite },
    mantra: mantra('saturn', 'Om Shanaye Namah', 'Om Pram Prim Praum Sah Shanaischaraya Namah', { incipit: 'Śaṃ no devīr abhiṣṭaya …', cite: { source: 'rigveda', locus: '10.9.4' } }, 23000),
    yantra: yantra('saturn'),
    charity: { items: ['black sesame', 'mustard oil', 'black urad', 'iron', 'black cloth'], dakshina: 'a black cow', samidh: 'shami', serve: 'the elderly, labourers and people with disabilities', cite: charityCite },
    fast: { day: 'Saturday', note: 'One meal after sunset; sesame or urad in the food.', cite: fastCite },
    stotra: stotra('Nīlāñjana samābhāsaṃ ravi putraṃ yamāgrajam …'),
    practice: 'Do the slow, unglamorous work on time. Serve people who cannot repay you, and treat staff and workers fairly.',
  },
  rahu: {
    graha: 'rahu', name: 'Rahu', sanskrit: 'Rahu', colour: 'smoky blue, grey',
    gem: { name: 'Hessonite garnet', sanskrit: 'Gomed (Gomedaka)', substitutes: ['spessartite garnet', 'orange zircon'], metal: 'silver or panchadhatu', finger: 'middle finger', cite: gemCite },
    mantra: mantra('rahu', 'Om Rahave Namah', 'Om Bhram Bhrim Bhraum Sah Rahave Namah', { incipit: 'Kayā naś citra ā bhuvad …', cite: { source: 'rigveda', locus: '4.31.1' } }, 18000),
    yantra: yantra('rahu'),
    charity: { items: ['blue or black cloth', 'black gram', 'coconut', 'blankets'], dakshina: 'iron (a blade, in the text)', samidh: 'durva grass', serve: 'outcasts, migrants and people battling addiction', cite: charityCite },
    fast: { day: 'Saturday', note: 'Kept with Saturn\'s fast, or on the day Rahu kalam is worshipped.', cite: fastCite },
    stotra: stotra('Ardhakāyaṃ mahāvīryaṃ candrāditya vimardanam …'),
    practice: 'Notice cravings and shortcuts before acting on them. Keep away from intoxicants and from schemes that need secrecy.',
  },
  ketu: {
    graha: 'ketu', name: 'Ketu', sanskrit: 'Ketu', colour: 'smoky, multicoloured',
    gem: { name: 'Cat\'s eye chrysoberyl', sanskrit: 'Lehsunia (Vaidurya)', substitutes: ['tiger\'s eye', 'cat\'s eye apatite'], metal: 'silver or panchadhatu', finger: 'ring or little finger (lineages differ)', cite: gemCite },
    mantra: mantra('ketu', 'Om Ketave Namah', 'Om Stram Strim Straum Sah Ketave Namah', { incipit: 'Ketuṃ kṛṇvann aketave …', cite: { source: 'rigveda', locus: '1.6.3' } }, 17000),
    yantra: yantra('ketu'),
    charity: { items: ['multicoloured blankets', 'sesame', 'food for stray dogs'], dakshina: 'a goat', samidh: 'kusha grass', serve: 'monks, hospices and people who are alone', cite: charityCite },
    fast: { day: 'Tuesday', note: 'Kept with Mars\'s fast; some keep Thursday.', cite: fastCite },
    stotra: stotra('Palāśa puṣpa saṅkāśaṃ tārakā graha mastakam …'),
    practice: 'Keep a quiet practice, such as meditation or prayer, every day. Let go of one thing you hold on to out of habit, not need.',
  },
};

/**
 * Ishta devata read from the 12th from the Karakamsa (BPHS Karakamsa Phala;
 * Jaimini 1.2). `avatar` is the form of Vishnu BPHS links to each graha in
 * its chapter on the avatars, which many teachers offer as a Vaishnava reading.
 */
export const ISHTA_DEITY: Record<GrahaId, { deity: string; avatar: string; alternatives: string[] }> = {
  sun: { deity: 'Shiva', avatar: 'Rama', alternatives: ['Surya Narayana'] },
  moon: { deity: 'Gauri (Parvati)', avatar: 'Krishna', alternatives: ['the Divine Mother as Lalita'] },
  mars: { deity: 'Skanda (Kartikeya, Subrahmanya)', avatar: 'Narasimha', alternatives: ['Hanuman'] },
  mercury: { deity: 'Vishnu', avatar: 'Buddha', alternatives: [] },
  jupiter: { deity: 'Samba Shiva (Shiva with Parvati)', avatar: 'Vamana', alternatives: ['Dattatreya'] },
  venus: { deity: 'Lakshmi', avatar: 'Parashurama', alternatives: [] },
  saturn: { deity: 'Vishnu (Narayana)', avatar: 'Kurma', alternatives: ['kshudra devatas (local and protective deities), in some Jaimini commentaries'] },
  rahu: { deity: 'Durga', avatar: 'Varaha', alternatives: [] },
  ketu: { deity: 'Ganesha', avatar: 'Matsya', alternatives: ['Skanda'] },
};
