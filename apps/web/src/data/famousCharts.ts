import type { BirthInput } from '../types/chart';

/**
 * Famous charts library: public figures whose birth data is publicly documented.
 *
 * Every entry carries its Rodden rating, the standard scale astrologers use for
 * how reliable a birth time is:
 *   AA  from a birth certificate or official birth record
 *   A   from the person, family or an official news report ("from memory")
 *   B   from a biography or autobiography
 *   C   caution: the source is vague, or the time was rectified
 * People rated DD (conflicting times) or X (no time) are left out on purpose.
 *
 * Data, ratings and source types are as published by Astrotheme, whose records
 * follow Lois Rodden's Astro-Databank. `utcOffsetMinutes` is set only where the
 * clock at the birthplace differed from the IANA zone's rules (a town that did
 * not follow its zone's daylight saving, for example). Before standard time the
 * engine uses the birthplace's own local mean time automatically.
 */

export type FamousCountry = 'IN' | 'US' | 'GB';
export type RoddenRating = 'AA' | 'A' | 'B' | 'C';

export interface FamousChart {
  /** stable slug, used in /app/#famous=<id> */
  id: string;
  /** display name */
  label: string;
  country: FamousCountry;
  /** what they are known for, a few words */
  field: string;
  input: BirthInput;
  rodden: RoddenRating;
  /** where the birth time comes from, in plain words */
  source: string;
  /** who collected the data, as credited by the source */
  collector?: string;
  sourceUrl?: string;
  note?: string;
  /**
   * The day the birth data and the `field` line were last checked against the
   * source, YYYY-MM-DD. Roles change (a president's term, a new title), so the
   * card shows this date beside them.
   */
  asOf: string;
}

/** When the whole list was last checked against its sources. A row can carry a later `asOf` of its own. */
export const FAMOUS_CHECKED = '2026-11-07';

/**
 * A pre-filled GitHub issue for a wrong birth time, place, source or role.
 * It names the chart and its current data so the report can be checked.
 */
export function famousErrorReportUrl(c: FamousChart): string {
  const title = `Famous chart correction: ${c.label}`;
  const body = [
    `Chart: ${c.label} (${c.id})`,
    `Data shown: ${c.input.date} ${c.input.time}, ${c.input.place}, Rodden ${c.rodden}`,
    `Role shown: ${c.field} (as of ${c.asOf})`,
    `Source shown: ${c.sourceUrl ?? c.source}`,
    '',
    'What is wrong:',
    '',
    'What it should be, and a link to the source:',
    '',
  ].join('\n');
  const q = new URLSearchParams({ title, body, labels: 'famous-charts' });
  return `https://github.com/destinjones/vedic-astrology/issues/new?${q}`;
}

export const COUNTRY_NAMES: Record<FamousCountry, string> = {
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
};

export const RODDEN_MEANING: Record<RoddenRating, string> = {
  AA: 'Birth certificate or official birth record',
  A: 'Quoted by the person, their family or an official announcement',
  B: 'From a biography or autobiography',
  C: 'Caution: vague source or a rectified time',
};

const AT = (slug: string) => `https://www.astrotheme.com/astrology/${slug}`;

const BC = 'Birth certificate or birth record';
const MEM = 'From the person or their family';
const NEWS = 'Official announcement reported in the news';
const BIO = 'Biography';

type Row = Omit<FamousChart, 'input' | 'asOf'> & { asOf?: string } & {
  date: string; time: string; place: string; lat: number; lon: number; tz: string; utcOffsetMinutes?: number;
};

const ROWS: Row[] = [
  // ── India ──────────────────────────────────────────────
  { id: 'jawaharlal-nehru', label: 'Jawaharlal Nehru', country: 'IN', field: 'First Prime Minister of India',
    date: '1889-11-14', time: '23:30', place: 'Allahabad (Prayagraj), India', lat: 25.4358, lon: 81.8463, tz: 'Asia/Kolkata',
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('Jawaharlal_Nehru'),
    note: 'Local mean time of Allahabad, as clocks read before Indian Standard Time.' },
  { id: 'indira-gandhi', label: 'Indira Gandhi', country: 'IN', field: 'Prime Minister of India',
    date: '1917-11-19', time: '23:11', place: 'Allahabad (Prayagraj), India', lat: 25.4358, lon: 81.8463, tz: 'Asia/Kolkata',
    rodden: 'A', source: MEM, collector: 'Robert Jansky', sourceUrl: AT('Indira_Gandhi') },
  { id: 'rajiv-gandhi', label: 'Rajiv Gandhi', country: 'IN', field: 'Prime Minister of India',
    date: '1944-08-20', time: '06:34', place: 'Mumbai, India', lat: 18.975, lon: 72.8258, tz: 'Asia/Kolkata', utcOffsetMinutes: 330,
    rodden: 'AA', source: BC, collector: 'Frank C. Clifford', sourceUrl: AT('Rajiv_Gandhi'),
    note: 'Read as Indian Standard Time (UTC+5:30), not the wartime +6:30, which gives the Leo lagna his chart is known for.' },
  { id: 'subhas-chandra-bose', label: 'Subhas Chandra Bose', country: 'IN', field: 'Independence leader',
    date: '1897-01-23', time: '12:00', place: 'Cuttack, India', lat: 20.4625, lon: 85.883, tz: 'Asia/Kolkata',
    rodden: 'AA', source: BC, collector: 'Sy Scholfield', sourceUrl: AT('Subhas_Chandra_Bose') },
  { id: 'mahatma-gandhi', label: 'Mahatma Gandhi', country: 'IN', field: 'Leader of Indian independence',
    date: '1869-10-02', time: '07:08', place: 'Porbandar, India', lat: 21.6417, lon: 69.6293, tz: 'Asia/Kolkata',
    rodden: 'C', source: 'Rectified from an approximate time', collector: 'Isaac Starkman', sourceUrl: AT('Mahatma_Gandhi'),
    note: 'Only the approximate hour is documented, so astrologers differ by some minutes. Read the lagna with care.' },
  { id: 'b-r-ambedkar', label: 'B. R. Ambedkar', country: 'IN', field: 'Architect of the Indian Constitution',
    date: '1891-04-14', time: '12:00', place: 'Mhow, India', lat: 22.5524, lon: 75.7565, tz: 'Asia/Kolkata',
    rodden: 'B', source: BIO, collector: 'Sy Scholfield', sourceUrl: AT('B._R._Ambedkar') },
  { id: 'swami-vivekananda', label: 'Swami Vivekananda', country: 'IN', field: 'Monk and philosopher',
    date: '1863-01-12', time: '06:33', place: 'Kolkata, India', lat: 22.5726, lon: 88.3639, tz: 'Asia/Kolkata',
    rodden: 'AA', source: BC, collector: 'Lois Rodden', sourceUrl: AT('Swami_Vivekananda') },
  { id: 'sri-aurobindo', label: 'Sri Aurobindo', country: 'IN', field: 'Yogi, poet and freedom fighter',
    date: '1872-08-15', time: '05:00', place: 'Kolkata, India', lat: 22.5726, lon: 88.3639, tz: 'Asia/Kolkata',
    rodden: 'B', source: BIO, collector: 'Marion March', sourceUrl: AT('Sri_Aurobindo') },
  { id: 'ramana-maharshi', label: 'Ramana Maharshi', country: 'IN', field: 'Sage of Arunachala',
    date: '1879-12-30', time: '01:00', place: 'Tiruchuli, near Aruppukkottai, India', lat: 9.5333, lon: 78.2, tz: 'Asia/Kolkata',
    rodden: 'B', source: BIO, collector: 'Sy Scholfield', sourceUrl: AT('Ramana_Maharshi') },
  { id: 'jiddu-krishnamurti', label: 'Jiddu Krishnamurti', country: 'IN', field: 'Philosopher and teacher',
    date: '1895-05-12', time: '00:30', place: 'Madanapalle, India', lat: 13.5503, lon: 78.5029, tz: 'Asia/Kolkata',
    rodden: 'B', source: BIO, collector: 'Marcello Borges', sourceUrl: AT('Jiddu_Krishnamurti') },
  { id: 'srinivasa-ramanujan', label: 'Srinivasa Ramanujan', country: 'IN', field: 'Mathematician',
    date: '1887-12-22', time: '18:00', place: 'Erode, India', lat: 11.341, lon: 77.7172, tz: 'Asia/Kolkata',
    rodden: 'B', source: BIO, collector: 'Lois Rodden', sourceUrl: AT('Srinivasa_Ramanujan') },
  { id: 'lata-mangeshkar', label: 'Lata Mangeshkar', country: 'IN', field: 'Playback singer',
    date: '1929-09-28', time: '22:30', place: 'Indore, India', lat: 22.7196, lon: 75.8577, tz: 'Asia/Kolkata',
    rodden: 'B', source: BIO, collector: 'Sy Scholfield', sourceUrl: AT('Lata_Mangeshkar') },
  { id: 'sachin-tendulkar', label: 'Sachin Tendulkar', country: 'IN', field: 'Cricketer',
    date: '1973-04-24', time: '13:00', place: 'Mumbai, India', lat: 19.076, lon: 72.8777, tz: 'Asia/Kolkata',
    rodden: 'A', source: MEM, collector: 'Sy Scholfield', sourceUrl: AT('Sachin_Tendulkar') },

  // ── United States ──────────────────────────────────────
  { id: 'abraham-lincoln', label: 'Abraham Lincoln', country: 'US', field: '16th US President',
    date: '1809-02-12', time: '06:54', place: 'Hodgenville, Kentucky, USA', lat: 37.5737, lon: -85.74, tz: 'America/Kentucky/Louisville',
    rodden: 'B', source: BIO, collector: 'Lois Rodden', sourceUrl: AT('Abraham_Lincoln'),
    note: 'Local mean time, before time zones existed.' },
  { id: 'franklin-d-roosevelt', label: 'Franklin D. Roosevelt', country: 'US', field: '32nd US President',
    date: '1882-01-30', time: '20:45', place: 'Hyde Park, New York, USA', lat: 41.7848, lon: -73.9332, tz: 'America/New_York',
    rodden: 'AA', source: BC, collector: 'Lois Rodden', sourceUrl: AT('Franklin_D._Roosevelt'),
    note: 'Local mean time, before time zones existed.' },
  { id: 'john-f-kennedy', label: 'John F. Kennedy', country: 'US', field: '35th US President',
    date: '1917-05-29', time: '15:00', place: 'Brookline, Massachusetts, USA', lat: 42.3318, lon: -71.1212, tz: 'America/New_York',
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('John_Fitzgerald_Kennedy') },
  { id: 'martin-luther-king-jr', label: 'Martin Luther King Jr.', country: 'US', field: 'Civil rights leader',
    date: '1929-01-15', time: '12:00', place: 'Atlanta, Georgia, USA', lat: 33.749, lon: -84.388, tz: 'America/New_York', utcOffsetMinutes: -360,
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('Martin_Luther_King'),
    note: 'Recorded as Central Standard Time (UTC-6), as Astro-Databank gives it.' },
  { id: 'marilyn-monroe', label: 'Marilyn Monroe', country: 'US', field: 'Actress',
    date: '1926-06-01', time: '09:30', place: 'Los Angeles, California, USA', lat: 34.0522, lon: -118.2437, tz: 'America/Los_Angeles',
    rodden: 'AA', source: BC, collector: 'Bob Garner', sourceUrl: AT('Marilyn_Monroe') },
  { id: 'elvis-presley', label: 'Elvis Presley', country: 'US', field: 'Singer',
    date: '1935-01-08', time: '04:35', place: 'Tupelo, Mississippi, USA', lat: 34.2576, lon: -88.7034, tz: 'America/Chicago',
    rodden: 'AA', source: BC, collector: 'Eugene Moore', sourceUrl: AT('Elvis_Presley') },
  { id: 'bob-dylan', label: 'Bob Dylan', country: 'US', field: 'Singer-songwriter',
    date: '1941-05-24', time: '21:05', place: 'Duluth, Minnesota, USA', lat: 46.7867, lon: -92.1005, tz: 'America/Chicago', utcOffsetMinutes: -360,
    rodden: 'AA', source: BC, collector: 'Bob Garner', sourceUrl: AT('Bob_Dylan'),
    note: 'Minnesota did not keep daylight saving in 1941, so this is Central Standard Time (UTC-6).' },
  { id: 'muhammad-ali', label: 'Muhammad Ali', country: 'US', field: 'Boxer',
    date: '1942-01-17', time: '18:35', place: 'Louisville, Kentucky, USA', lat: 38.2527, lon: -85.7585, tz: 'America/Kentucky/Louisville',
    rodden: 'AA', source: BC, collector: 'Michel Gauquelin', sourceUrl: AT('Muhammad_Ali') },
  { id: 'joe-biden', label: 'Joe Biden', country: 'US', field: '46th US President',
    date: '1942-11-20', time: '08:30', place: 'Scranton, Pennsylvania, USA', lat: 41.409, lon: -75.6624, tz: 'America/New_York',
    rodden: 'A', source: MEM, collector: 'Marion March', sourceUrl: AT('Joe_Biden') },
  { id: 'donald-trump', label: 'Donald Trump', country: 'US', field: '45th and 47th US President',
    date: '1946-06-14', time: '10:54', place: 'Jamaica, Queens, New York, USA', lat: 40.7027, lon: -73.789, tz: 'America/New_York',
    rodden: 'AA', source: BC, collector: 'Lois Rodden', sourceUrl: AT('Donald_Trump') },
  { id: 'bill-clinton', label: 'Bill Clinton', country: 'US', field: '42nd US President',
    date: '1946-08-19', time: '08:51', place: 'Hope, Arkansas, USA', lat: 33.6671, lon: -93.5916, tz: 'America/Chicago', utcOffsetMinutes: -360,
    rodden: 'A', source: MEM, collector: 'Shelley Ackerman', sourceUrl: AT('Bill_Clinton'),
    note: 'Arkansas did not keep daylight saving in 1946, so this is Central Standard Time (UTC-6).' },
  { id: 'oprah-winfrey', label: 'Oprah Winfrey', country: 'US', field: 'Broadcaster',
    date: '1954-01-29', time: '04:30', place: 'Kosciusko, Mississippi, USA', lat: 33.0579, lon: -89.5876, tz: 'America/Chicago',
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('Oprah_Winfrey') },
  { id: 'steve-jobs', label: 'Steve Jobs', country: 'US', field: 'Co-founder of Apple',
    date: '1955-02-24', time: '19:15', place: 'San Francisco, California, USA', lat: 37.7749, lon: -122.4194, tz: 'America/Los_Angeles',
    rodden: 'AA', source: BC, collector: 'Lois Rodden', sourceUrl: AT('Steve_Jobs') },
  { id: 'madonna', label: 'Madonna', country: 'US', field: 'Singer',
    date: '1958-08-16', time: '07:05', place: 'Bay City, Michigan, USA', lat: 43.5945, lon: -83.8889, tz: 'America/Detroit', utcOffsetMinutes: -300,
    rodden: 'AA', source: BC, collector: 'Lois Rodden', sourceUrl: AT('Madonna'),
    note: 'Michigan did not keep daylight saving in 1958, so this is Eastern Standard Time (UTC-5).' },
  { id: 'michael-jackson', label: 'Michael Jackson', country: 'US', field: 'Singer',
    date: '1958-08-29', time: '19:33', place: 'Gary, Indiana, USA', lat: 41.5934, lon: -87.3464, tz: 'America/Chicago',
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('Michael_Jackson') },
  { id: 'barack-obama', label: 'Barack Obama', country: 'US', field: '44th US President',
    date: '1961-08-04', time: '19:24', place: 'Honolulu, Hawaii, USA', lat: 21.3069, lon: -157.8583, tz: 'Pacific/Honolulu',
    rodden: 'AA', source: BC, collector: 'Pat Taglilatelo', sourceUrl: AT('Barack_Obama') },
  { id: 'kamala-harris', label: 'Kamala Harris', country: 'US', field: '49th US Vice President',
    date: '1964-10-20', time: '21:28', place: 'Oakland, California, USA', lat: 37.8044, lon: -122.2712, tz: 'America/Los_Angeles',
    rodden: 'AA', source: BC, collector: 'Steven Stuckey', sourceUrl: AT('Kamala_Harris') },

  // ── United Kingdom ─────────────────────────────────────
  { id: 'winston-churchill', label: 'Winston Churchill', country: 'GB', field: 'Prime Minister of the UK',
    date: '1874-11-30', time: '01:30', place: 'Blenheim Palace, Woodstock, England', lat: 51.8413, lon: -1.361, tz: 'Europe/London',
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('Winston_Churchill') },
  { id: 'margaret-thatcher', label: 'Margaret Thatcher', country: 'GB', field: 'Prime Minister of the UK',
    date: '1925-10-13', time: '09:00', place: 'Grantham, England', lat: 52.9119, lon: -0.6426, tz: 'Europe/London',
    rodden: 'A', source: MEM, collector: 'Charles Harvey, Lois Rodden', sourceUrl: AT('Margaret_Thatcher') },
  { id: 'queen-elizabeth-ii', label: 'Queen Elizabeth II', country: 'GB', field: 'Queen of the United Kingdom',
    date: '1926-04-21', time: '02:40', place: 'Mayfair, London, England', lat: 51.5104, lon: -0.1446, tz: 'Europe/London',
    rodden: 'AA', source: BC, collector: 'Didier Geslain', sourceUrl: AT('Elizabeth_II') },
  { id: 'paul-mccartney', label: 'Paul McCartney', country: 'GB', field: 'Musician, The Beatles',
    date: '1942-06-18', time: '14:00', place: 'Liverpool, England', lat: 53.4084, lon: -2.9916, tz: 'Europe/London',
    rodden: 'A', source: MEM, collector: 'Sy Scholfield', sourceUrl: AT('Paul_McCartney') },
  { id: 'mick-jagger', label: 'Mick Jagger', country: 'GB', field: 'Singer, The Rolling Stones',
    date: '1943-07-26', time: '02:30', place: 'Dartford, England', lat: 51.4462, lon: 0.2169, tz: 'Europe/London',
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('Mick_Jagger') },
  { id: 'david-bowie', label: 'David Bowie', country: 'GB', field: 'Musician',
    date: '1947-01-08', time: '09:00', place: 'Brixton, London, England', lat: 51.4613, lon: -0.1156, tz: 'Europe/London',
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('David_Bowie') },
  { id: 'king-charles-iii', label: 'King Charles III', country: 'GB', field: 'King of the United Kingdom',
    date: '1948-11-14', time: '21:14', place: 'Buckingham Palace, London, England', lat: 51.5014, lon: -0.1419, tz: 'Europe/London',
    rodden: 'A', source: NEWS, collector: 'Lois Rodden', sourceUrl: AT('Charles_III') },
  { id: 'tony-blair', label: 'Tony Blair', country: 'GB', field: 'Prime Minister of the UK',
    date: '1953-05-06', time: '06:10', place: 'Edinburgh, Scotland', lat: 55.9533, lon: -3.1883, tz: 'Europe/London',
    rodden: 'AA', source: BC, collector: 'Caroline Gerard', sourceUrl: AT('Tony_Blair') },
  { id: 'diana-princess-of-wales', label: 'Diana, Princess of Wales', country: 'GB', field: 'Princess of Wales',
    date: '1961-07-01', time: '19:45', place: 'Sandringham, England', lat: 52.8283, lon: 0.5106, tz: 'Europe/London',
    rodden: 'A', source: MEM, collector: 'Lois Rodden', sourceUrl: AT('Diana,_Princess_of_Wales') },
  { id: 'prince-william', label: 'William, Prince of Wales', country: 'GB', field: 'Heir to the throne',
    date: '1982-06-21', time: '21:03', place: 'Paddington, London, England', lat: 51.5167, lon: -0.172, tz: 'Europe/London',
    rodden: 'AA', source: BC, collector: 'The Wilsons', sourceUrl: AT('William,_Prince_of_Wales') },
  { id: 'prince-harry', label: 'Prince Harry, Duke of Sussex', country: 'GB', field: 'Member of the royal family',
    date: '1984-09-15', time: '16:20', place: 'Paddington, London, England', lat: 51.5167, lon: -0.172, tz: 'Europe/London',
    rodden: 'A', source: NEWS, collector: 'Dana Holliday', sourceUrl: AT('Prince_Harry,_Duke_of_Sussex') },

  // ── Nations (mundane charts) ───────────────────────────
  // A country's chart is cast for the moment its founding act took effect.
  { id: 'india-1947', label: 'India (independence)', country: 'IN', field: 'Nation: the Indian Independence Act took effect at midnight',
    date: '1947-08-15', time: '00:00', place: 'New Delhi, India', lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata',
    rodden: 'AA', source: 'Indian Independence Act 1947, effective from the start of 15 August 1947',
    note: 'The chart most Indian astrologers use for the nation: Taurus lagna, five planets in Cancer.' },
  { id: 'india-republic-1950', label: 'India (republic)', country: 'IN', field: 'Nation: the Constitution came into force',
    date: '1950-01-26', time: '10:18', place: 'New Delhi, India', lat: 28.6139, lon: 77.209, tz: 'Asia/Kolkata',
    rodden: 'B', source: 'The widely cited time of the proclamation of the Republic by C. Rajagopalachari, 10:18 a.m.',
    note: 'Some astrologers use this chart for the Indian state rather than the 1947 chart.' },
  { id: 'usa-1776', label: 'United States (Sibly chart)', country: 'US', field: 'Nation: the Declaration of Independence',
    date: '1776-07-04', time: '17:10', place: 'Philadelphia, Pennsylvania, USA', lat: 39.9526, lon: -75.1652, tz: 'America/New_York',
    rodden: 'C', source: 'Ebenezer Sibly, 1787; the hour of signing was not recorded, so the time is a tradition, not a record',
    note: 'Local mean time of Philadelphia. Several other times are in use; this is the most common.' },
  { id: 'uk-1801', label: 'United Kingdom', country: 'GB', field: 'Nation: the Acts of Union 1800 took effect',
    date: '1801-01-01', time: '00:00', place: 'London, England', lat: 51.5074, lon: -0.1278, tz: 'Europe/London',
    rodden: 'AA', source: 'Union with Ireland Act 1800, effective from 1 January 1801',
    note: 'Local mean time of London (Greenwich time was not yet standard).' },
];

export const FAMOUS_CHARTS: FamousChart[] = ROWS.map(({ date, time, place, lat, lon, tz, utcOffsetMinutes, asOf, ...rest }) => ({
  ...rest,
  asOf: asOf ?? FAMOUS_CHECKED,
  input: {
    name: rest.label, date, time, place, latitude: lat, longitude: lon, timezone: tz, ayanamsa: 'lahiri',
    ...(utcOffsetMinutes !== undefined ? { utcOffsetMinutes } : {}),
  },
}));

export const famousChartById = (id: string): FamousChart | undefined => FAMOUS_CHARTS.find((c) => c.id === id);
