import type { Source, SourceId } from './types';

/**
 * Where each remedy comes from. References are given at the level we can
 * stand behind: a chapter or section name, and a verse only where the text is
 * a fixed, well-known one (the Vedic mantras). Chapter numbers in BPHS differ
 * between editions, so chapters are named rather than numbered.
 *
 * Several remedies people take for granted (the planet-gem pairing above all)
 * are later tradition rather than classical text. Those say so.
 */
export const SOURCES: Record<SourceId, Source> = {
  bphs_karakamsa: {
    id: 'bphs_karakamsa',
    work: 'Brihat Parashara Hora Shastra',
    ref: 'Karakamsa Phala (effects of the Karakamsa)',
    note: 'Planets in the 12th from the Karakamsa show the deity the native turns to. Numbered as ch. 33 in R. Santhanam\'s translation.',
  },
  bphs_dasha_shanti: {
    id: 'bphs_dasha_shanti',
    work: 'Brihat Parashara Hora Shastra',
    ref: 'Antardasha effects of each graha',
    note: 'Each antardasha passage closes with its shanti: japa of the graha\'s mantra, a homa and a gift. This is the classical basis for mantra and charity as remedies.',
  },
  bphs_bhava_lords: {
    id: 'bphs_bhava_lords',
    work: 'Brihat Parashara Hora Shastra',
    ref: 'Yoga karakas (functional benefics and malefics by lagna)',
    note: 'Trikona lords are auspicious, lords of the 3rd, 6th and 11th are not, and the 8th lord is not unless it also rules the lagna. Used here to decide whether strengthening a planet with a gem is wise.',
  },
  bphs_avatara: {
    id: 'bphs_avatara',
    work: 'Brihat Parashara Hora Shastra',
    ref: 'Avatars of the grahas',
    note: 'Pairs each graha with an avatar of Vishnu: Rama with the Sun, Krishna with the Moon, Narasimha with Mars, Buddha with Mercury, Vamana with Jupiter, Parashurama with Venus, Kurma with Saturn, Varaha with Rahu and Matsya with Ketu.',
  },
  jaimini_sutras: {
    id: 'jaimini_sutras',
    work: 'Jaimini Upadesha Sutras',
    ref: 'Adhyaya 1, pada 2 (results from the Karakamsa)',
    note: 'The sutras read worship and spiritual leaning from the 12th from the Karakamsa. Commentators differ on Saturn and the nodes.',
  },
  yajnavalkya_grahashanti: {
    id: 'yajnavalkya_grahashanti',
    work: 'Yajnavalkya Smriti',
    ref: 'Acharadhyaya, Graha Shanti prakarana',
    note: 'Gives each graha\'s homa wood (samidh) and the gift (dakshina) that closes its shanti: cow, conch, bull, gold, cloth, horse, black cow, iron and goat.',
  },
  rigveda: {
    id: 'rigveda',
    work: 'Rig Veda',
    ref: 'verses cited per graha',
    note: 'The Navagraha Vedic mantras recited in temple graha shanti are Rig and Yajur Veda verses chosen for a word that matches the graha.',
  },
  yajurveda: {
    id: 'yajurveda',
    work: 'Shukla Yajur Veda (Vajasaneyi Samhita)',
    ref: 'verses cited per graha',
  },
  vyasa_stotra: {
    id: 'vyasa_stotra',
    work: 'Navagraha Stotra',
    ref: 'attributed to Vyasa ("Japakusuma sankasham …")',
    note: 'One verse per graha, the most widely recited graha hymn.',
  },
  bija_tradition: {
    id: 'bija_tradition',
    work: 'Tantric bija mantras',
    ref: 'Navagraha puja manuals (lineage tradition)',
    note: 'The "Om Hram Hrim Hraum" family of seed mantras is tantric, not Vedic. Spellings and counts vary between lineages; follow a teacher\'s version if you have one.',
  },
  japa_counts: {
    id: 'japa_counts',
    work: 'Graha shanti practice',
    ref: 'temple and priestly manuals',
    note: 'The full japa counts (Sun 7,000 … Saturn 23,000) are customary, not taken from one text. Some teachers use the graha\'s Vimshottari years × 1,000 instead; both are shown.',
  },
  navagraha_yantra: {
    id: 'navagraha_yantra',
    work: 'Navagraha yantras',
    ref: 'tradition; 3 × 3 number squares',
    note: 'Each graha\'s yantra is a magic square whose rows, columns and diagonals add to 15 (Sun), 18 (Moon) and so on in steps of 3 to 39 (Ketu). Cell layouts vary between makers.',
  },
  gem_tradition: {
    id: 'gem_tradition',
    work: 'Navaratna correspondences',
    ref: 'later tradition, e.g. S. M. Tagore, Mani-Mala (1879)',
    note: 'Classical works (Garuda Purana, Brihat Samhita) discuss gems and how to test them, but the one-gem-per-graha remedy used today is not in BPHS. Treat it as custom.',
  },
  vrata_tradition: {
    id: 'vrata_tradition',
    work: 'Vara vrata custom',
    ref: 'each graha fasted on its weekday',
    note: 'Rahu shares Saturn\'s day and Ketu shares Mars\'s in most households; some fast for Ketu on Thursday.',
  },
};

export const source = (id: SourceId): Source => SOURCES[id];
