/**
 * Former and alternate names of places, so a birth certificate that says
 * "Bombay" or "Pondicherry" still finds the right city. Open-Meteo (GeoNames)
 * only matches current official names well, so we look the old name up here
 * and search for the modern one.
 *
 * Keys are lower-case, accent-free. `country` narrows the search so that
 * "Madras" means Chennai and not Madras, Oregon (the US town is still shown).
 */
export interface PlaceAlias {
  /** Current name to search for */
  modern: string;
  /** Country name as Open-Meteo returns it, to pick the right match */
  country: string;
}

const A = (modern: string, country: string): PlaceAlias => ({ modern, country });
const IN = 'India';

export const PLACE_ALIASES: Record<string, PlaceAlias> = {
  // India
  bombay: A('Mumbai', IN),
  calcutta: A('Kolkata', IN),
  madras: A('Chennai', IN),
  pondicherry: A('Puducherry', IN),
  pondichery: A('Puducherry', IN),
  pondy: A('Puducherry', IN),
  bangalore: A('Bengaluru', IN),
  poona: A('Pune', IN),
  benares: A('Varanasi', IN),
  banaras: A('Varanasi', IN),
  kashi: A('Varanasi', IN),
  baroda: A('Vadodara', IN),
  trivandrum: A('Thiruvananthapuram', IN),
  cochin: A('Kochi', IN),
  calicut: A('Kozhikode', IN),
  cannanore: A('Kannur', IN),
  quilon: A('Kollam', IN),
  alleppey: A('Alappuzha', IN),
  trichur: A('Thrissur', IN),
  palghat: A('Palakkad', IN),
  mysore: A('Mysuru', IN),
  mangalore: A('Mangaluru', IN),
  belgaum: A('Belagavi', IN),
  hubli: A('Hubballi', IN),
  gulbarga: A('Kalaburagi', IN),
  bellary: A('Ballari', IN),
  shimoga: A('Shivamogga', IN),
  tumkur: A('Tumakuru', IN),
  bijapur: A('Vijayapura', IN),
  tanjore: A('Thanjavur', IN),
  trichy: A('Tiruchirappalli', IN),
  trichinopoly: A('Tiruchirappalli', IN),
  tuticorin: A('Thoothukudi', IN),
  conjeevaram: A('Kanchipuram', IN),
  ootacamund: A('Udhagamandalam', IN),
  ooty: A('Udhagamandalam', IN),
  vizag: A('Visakhapatnam', IN),
  waltair: A('Visakhapatnam', IN),
  vizagapatam: A('Visakhapatnam', IN),
  bezwada: A('Vijayawada', IN),
  rajahmundry: A('Rajamahendravaram', IN),
  cawnpore: A('Kanpur', IN),
  allahabad: A('Prayagraj', IN),
  simla: A('Shimla', IN),
  gurgaon: A('Gurugram', IN),
  jubbulpore: A('Jabalpur', IN),
  gauhati: A('Guwahati', IN),
  ahmadabad: A('Ahmedabad', IN),
  broach: A('Bharuch', IN),
  faizabad: A('Ayodhya', IN),
  aurangabad: A('Chhatrapati Sambhajinagar', IN),
  osmanabad: A('Dharashiv', IN),
  'new bombay': A('Navi Mumbai', IN),
  'old delhi': A('Delhi', IN),
  panjim: A('Panaji', IN),
  'nova goa': A('Panaji', IN),
  pondicheri: A('Puducherry', IN),
  hardwar: A('Haridwar', IN),
  muttra: A('Mathura', IN),
  monghyr: A('Munger', IN),
  // Neighbours and the wider world
  dacca: A('Dhaka', 'Bangladesh'),
  chittagong: A('Chattogram', 'Bangladesh'),
  rangoon: A('Yangon', 'Myanmar'),
  ceylon: A('Colombo', 'Sri Lanka'),
  lyallpur: A('Faisalabad', 'Pakistan'),
  peking: A('Beijing', 'China'),
  canton: A('Guangzhou', 'China'),
  saigon: A('Ho Chi Minh City', 'Vietnam'),
  batavia: A('Jakarta', 'Indonesia'),
  constantinople: A('Istanbul', 'Turkey'),
  leningrad: A('Saint Petersburg', 'Russia'),
  stalingrad: A('Volgograd', 'Russia'),
  leopoldville: A('Kinshasa', 'DR Congo'),
  bombai: A('Mumbai', IN),
  kolkatta: A('Kolkata', IN),
};

/** Lower-case, strip accents and punctuation so "Pondichéry" matches. */
export function normalizePlaceName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The modern name for a former or alternate one, if we know it. A partly typed
 * name ("Pondich") also matches once it is 4+ letters and points to one city.
 */
export function placeAlias(name: string): (PlaceAlias & { former: string }) | undefined {
  const key = normalizePlaceName(name);
  if (PLACE_ALIASES[key]) return { ...PLACE_ALIASES[key], former: key };
  if (key.length < 4) return undefined;
  const keys = Object.keys(PLACE_ALIASES).filter((k) => k.startsWith(key));
  if (!keys.length || keys.some((k) => PLACE_ALIASES[k].modern !== PLACE_ALIASES[keys[0]].modern)) return undefined;
  // the first-listed spelling is the usual one (pondicherry before pondichery)
  const former = keys[0];
  return { ...PLACE_ALIASES[former], former };
}
