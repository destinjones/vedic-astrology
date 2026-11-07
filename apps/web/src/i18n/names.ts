import type { Ayanamsa } from '../types/chart';
import type { I18n } from './index';

const KEY = { lahiri: 'form.ayanamsaLahiri', true_chitra: 'form.ayanamsaTrueChitra', raman: 'form.ayanamsaRaman', krishnamurti: 'form.ayanamsaKp' } as const;

/** Display name of an ayanamsa, e.g. 'Lahiri (Chitrapaksha)'. */
export const ayanamsaName = (t: I18n['t'], a: Ayanamsa | string) => (a in KEY ? t(KEY[a as Ayanamsa]) : a);
