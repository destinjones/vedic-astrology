import type { Vocab } from './types';
import { en } from './en';

export const es: Vocab = {
  planets: {
    sun: { name: 'Sol', short: 'So' },
    moon: { name: 'Luna', short: 'Lu' },
    mars: { name: 'Marte', short: 'Ma' },
    mercury: { name: 'Mercurio', short: 'Me' },
    jupiter: { name: 'Júpiter', short: 'Jú' },
    venus: { name: 'Venus', short: 'Ve' },
    saturn: { name: 'Saturno', short: 'Sa' },
    rahu: { name: 'Rahu', short: 'Ra' },
    ketu: { name: 'Ketu', short: 'Ke' },
  },
  signs: ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'],
  nakshatras: en.nakshatras,
  houses: ['Yo', 'Riqueza', 'Valor', 'Hogar', 'Creatividad', 'Obstáculos', 'Pareja', 'Transformación', 'Fortuna', 'Carrera', 'Ganancias', 'Liberación'],
  bhavas: en.bhavas,
  vargas: en.vargas,
  dignity: {
    exalted: 'Exaltado', moolatrikona: 'Moolatrikona', own: 'Signo propio', great_friend: 'Gran amigo', friend: 'Amistoso',
    neutral: 'Neutral', enemy: 'Enemigo', great_enemy: 'Gran enemigo', debilitated: 'Debilitado',
  },
  nature: { benefic: 'benéfico', malefic: 'maléfico', neutral: 'neutral', variable: 'variable' },
  element: { fire: 'Fuego', earth: 'Tierra', air: 'Aire', water: 'Agua' },
  modality: { movable: 'Móvil', fixed: 'Fijo', dual: 'Doble' },
  gana: en.gana,
  houseGroups: en.houseGroups,
  strength: { strong: 'fuerte', moderate: 'moderado', weak: 'débil' },
  severity: { high: 'alta', moderate: 'moderada', low: 'baja', cancelled: 'anulada' },
  tone: { benefic: 'favorable', mixed: 'mixto', challenging: 'difícil' },
  ordinal: (n) => `${n}.ª`,
};
