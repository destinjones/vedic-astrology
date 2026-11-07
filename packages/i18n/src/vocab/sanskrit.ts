/**
 * The classical Sanskrit names, for readers who want the terms as the texts write them,
 * whatever language the rest of the page is in. Two spellings of the same words:
 *   iast        International Alphabet of Sanskrit Transliteration (Sūrya, Kṛttikā, Navāṃśa)
 *   devanagari  the original script (सूर्य, कृत्तिका, नवांश)
 *
 * Only the technical vocabulary is replaced. Words that are ordinary language in the reader's
 * tongue (house themes, "strong", "mixed", ordinals) stay translated, so sentences still read.
 */
import type { Vocab } from './types';

export type TermScript = 'iast' | 'devanagari';

type SanskritPart = Pick<Vocab, 'planets' | 'signs' | 'nakshatras' | 'bhavas' | 'vargas' | 'dignity' | 'element' | 'modality' | 'gana' | 'houseGroups'>;

export const SANSKRIT: Record<TermScript, SanskritPart> = {
  iast: {
    planets: {
      sun: { name: 'Sūrya', short: 'Sū' },
      moon: { name: 'Candra', short: 'Ca' },
      mars: { name: 'Maṅgala', short: 'Ma' },
      mercury: { name: 'Budha', short: 'Bu' },
      jupiter: { name: 'Guru', short: 'Gu' },
      venus: { name: 'Śukra', short: 'Śu' },
      saturn: { name: 'Śani', short: 'Śa' },
      rahu: { name: 'Rāhu', short: 'Rā' },
      ketu: { name: 'Ketu', short: 'Ke' },
    },
    signs: ['Meṣa', 'Vṛṣabha', 'Mithuna', 'Karkaṭa', 'Siṃha', 'Kanyā', 'Tulā', 'Vṛścika', 'Dhanus', 'Makara', 'Kumbha', 'Mīna'],
    nakshatras: [
      'Aśvinī', 'Bharaṇī', 'Kṛttikā', 'Rohiṇī', 'Mṛgaśirā', 'Ārdrā', 'Punarvasu', 'Puṣya', 'Āśleṣā',
      'Maghā', 'Pūrva Phalgunī', 'Uttara Phalgunī', 'Hasta', 'Citrā', 'Svātī', 'Viśākhā', 'Anurādhā', 'Jyeṣṭhā',
      'Mūla', 'Pūrva Āṣāḍhā', 'Uttara Āṣāḍhā', 'Śravaṇa', 'Dhaniṣṭhā', 'Śatabhiṣaj', 'Pūrva Bhādrapadā', 'Uttara Bhādrapadā', 'Revatī',
    ],
    bhavas: ['Tanu', 'Dhana', 'Sahaja', 'Sukha', 'Putra', 'Ari', 'Kalatra', 'Āyus', 'Dharma', 'Karma', 'Lābha', 'Vyaya'],
    vargas: {
      D1: 'Rāśi', D2: 'Horā', D3: 'Drekkāṇa', D4: 'Caturthāṃśa', D7: 'Saptāṃśa', D9: 'Navāṃśa', D10: 'Daśāṃśa', D12: 'Dvādaśāṃśa',
      D16: 'Ṣoḍaśāṃśa', D20: 'Viṃśāṃśa', D24: 'Caturviṃśāṃśa', D27: 'Bhāṃśa', D30: 'Triṃśāṃśa', D40: 'Khavedāṃśa', D45: 'Akṣavedāṃśa', D60: 'Ṣaṣṭyaṃśa',
    },
    dignity: {
      exalted: 'Ucca', moolatrikona: 'Mūlatrikoṇa', own: 'Svakṣetra', great_friend: 'Adhimitra', friend: 'Mitra',
      neutral: 'Sama', enemy: 'Śatru', great_enemy: 'Adhiśatru', debilitated: 'Nīca',
    },
    element: { fire: 'Agni', earth: 'Pṛthvī', air: 'Vāyu', water: 'Jala' },
    modality: { movable: 'Cara', fixed: 'Sthira', dual: 'Dvisvabhāva' },
    gana: { deva: 'Deva', manushya: 'Manuṣya', rakshasa: 'Rākṣasa' },
    houseGroups: { kendra: 'Kendra', trikona: 'Trikoṇa', dusthana: 'Duḥsthāna', upachaya: 'Upacaya', maraka: 'Māraka', panaphara: 'Paṇaphara', apoklima: 'Āpoklima' },
  },
  devanagari: {
    planets: {
      sun: { name: 'सूर्य', short: 'सू' },
      moon: { name: 'चन्द्र', short: 'च' },
      mars: { name: 'मङ्गल', short: 'मं' },
      mercury: { name: 'बुध', short: 'बु' },
      jupiter: { name: 'गुरु', short: 'गु' },
      venus: { name: 'शुक्र', short: 'शु' },
      saturn: { name: 'शनि', short: 'श' },
      rahu: { name: 'राहु', short: 'रा' },
      ketu: { name: 'केतु', short: 'के' },
    },
    signs: ['मेष', 'वृषभ', 'मिथुन', 'कर्कट', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनुः', 'मकर', 'कुम्भ', 'मीन'],
    nakshatras: [
      'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा', 'पुनर्वसु', 'पुष्य', 'आश्लेषा',
      'मघा', 'पूर्वफल्गुनी', 'उत्तरफल्गुनी', 'हस्त', 'चित्रा', 'स्वाती', 'विशाखा', 'अनुराधा', 'ज्येष्ठा',
      'मूल', 'पूर्वाषाढा', 'उत्तराषाढा', 'श्रवण', 'धनिष्ठा', 'शतभिषज्', 'पूर्वभाद्रपदा', 'उत्तरभाद्रपदा', 'रेवती',
    ],
    bhavas: ['तनु', 'धन', 'सहज', 'सुख', 'पुत्र', 'अरि', 'कलत्र', 'आयुस्', 'धर्म', 'कर्म', 'लाभ', 'व्यय'],
    vargas: {
      D1: 'राशि', D2: 'होरा', D3: 'द्रेक्काण', D4: 'चतुर्थांश', D7: 'सप्तांश', D9: 'नवांश', D10: 'दशांश', D12: 'द्वादशांश',
      D16: 'षोडशांश', D20: 'विंशांश', D24: 'चतुर्विंशांश', D27: 'भांश', D30: 'त्रिंशांश', D40: 'खवेदांश', D45: 'अक्षवेदांश', D60: 'षष्ट्यंश',
    },
    dignity: {
      exalted: 'उच्च', moolatrikona: 'मूलत्रिकोण', own: 'स्वक्षेत्र', great_friend: 'अधिमित्र', friend: 'मित्र',
      neutral: 'सम', enemy: 'शत्रु', great_enemy: 'अधिशत्रु', debilitated: 'नीच',
    },
    element: { fire: 'अग्नि', earth: 'पृथ्वी', air: 'वायु', water: 'जल' },
    modality: { movable: 'चर', fixed: 'स्थिर', dual: 'द्विस्वभाव' },
    gana: { deva: 'देव', manushya: 'मनुष्य', rakshasa: 'राक्षस' },
    houseGroups: { kendra: 'केन्द्र', trikona: 'त्रिकोण', dusthana: 'दुःस्थान', upachaya: 'उपचय', maraka: 'मारक', panaphara: 'पणफर', apoklima: 'आपोक्लिम' },
  },
};

/** The vocabulary with its technical terms written in Sanskrit; 'local' (or nothing) returns it unchanged. */
export function withSanskritTerms(base: Vocab, script: TermScript | 'local' | undefined): Vocab {
  if (script !== 'iast' && script !== 'devanagari') return base;
  return { ...base, ...SANSKRIT[script] };
}
