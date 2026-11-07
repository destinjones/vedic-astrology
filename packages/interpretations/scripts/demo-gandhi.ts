import { createEngine } from '@vedic/engine';
import { fromEngineChart, interpretChart } from '../src';
const e = await createEngine();
const c = e.computeChart({ date: '1869-10-02', time: '07:11', place: { latitude: 21.6417, longitude: 69.6293 } });
const i = fromEngineChart(c);
for (const [k,v] of Object.entries(i.planets)) console.log(k, v.sign, v.longitude.toFixed(2), v.dignity, v.combust);
const r = interpretChart(i);
for (const y of r.yogas) console.log('Y', y.name, y.strength, '-', y.reason);
for (const d of r.doshas) console.log('D', d.name, d.present, d.severity, d.reason, d.cancellations.join('; '));
