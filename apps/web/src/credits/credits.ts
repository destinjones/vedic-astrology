import '../fonts';
import '../landing/landing.css';
import './credits.css';
import { READING_CREDITS } from '@vedic/interpretations/credits';
import data from './people.json';

interface Person { name: string; github?: string; url?: string; roles?: string[]; for?: string }

const KINDS: Record<string, string> = { sign: 'planet in sign', house: 'planet in house', nakshatra: 'planet in nakshatra' };

function item(name: string, href: string | undefined, note: string): HTMLLIElement {
  const li = document.createElement('li');
  const b = document.createElement(href ? 'a' : 'b');
  b.textContent = name;
  if (href && b instanceof HTMLAnchorElement) b.href = href;
  li.append(b);
  if (note) {
    const s = document.createElement('span');
    s.textContent = note;
    li.append(s);
  }
  return li;
}

function fill(id: string, people: Person[], empty: string) {
  const ul = document.getElementById(id)!;
  if (!people.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.innerHTML = empty;
    ul.append(li);
    return;
  }
  for (const p of people) ul.append(item(p.name, p.github ? `https://github.com/${p.github}` : p.url, [p.roles?.join(', '), p.for].filter(Boolean).join(' · ')));
}

fill('people', data.people as Person[], 'No one yet.');
fill('practitioners', data.practitioners as Person[], 'No one yet. If you practise Jyotish and would check a chart against your own method, <a href="https://github.com/destinjones/vedic-astrology/discussions">we would love to hear from you</a>.');
fill('translators', data.translators as Person[], 'No one yet. Seven languages are waiting: see <a href="https://github.com/destinjones/vedic-astrology/blob/main/packages/interpretations/content/COVERAGE.md">what needs translating</a>.');
const authors = document.getElementById('reading-authors')!;
if (READING_CREDITS.length) for (const c of READING_CREDITS) authors.append(item(c.name, undefined, `${c.readings} reading${c.readings === 1 ? '' : 's'}: ${c.kinds.map((k) => KINDS[k] ?? k).join(', ')}`));
else fill('reading-authors', [], 'Be the first: <a href="https://github.com/destinjones/vedic-astrology/blob/main/packages/interpretations/content/README.md">write a nakshatra reading</a>.');
