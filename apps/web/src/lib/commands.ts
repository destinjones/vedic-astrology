/**
 * Commands for the quick switcher (Ctrl/Cmd+K) and the keyboard shortcuts.
 *
 * Anything the app can do from the keyboard is a Command. Features add their
 * own by passing more commands to <QuickSwitch> (client tabs, saved charts and
 * so on), so the palette, the shortcuts and the help overlay stay in one place.
 */
export interface Command {
  id: string;
  /** What the palette shows, e.g. "Navamsha (D9)". */
  title: string;
  /** Heading the command is listed under in the palette and the help overlay. */
  group: string;
  /** Extra words the palette matches on, e.g. Sanskrit names or "marriage". */
  keywords?: string;
  /** Muted text after the title, e.g. the area a divisional chart covers. */
  hint?: string;
  /**
   * Key that runs the command without opening the palette, in the format
   * `matchStep` reads: "v", "?", "Alt+1", "Mod+K", "]",
   * or a two-key sequence such as "g p". Mod is Cmd on a Mac and Ctrl elsewhere.
   */
  shortcut?: string;
  /** Marks the current choice (the open chart, the selected style). */
  active?: boolean;
  run: () => void;
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Shortcut as it reads on a key cap: "⌘K" on a Mac, "Ctrl K" elsewhere. */
export function shortcutLabel(s: string): string[] {
  if (s.includes(' ')) return s.split(' ').flatMap((p, i) => (i ? ['then', ...shortcutLabel(p)] : shortcutLabel(p)));
  return s.split('+').map((p) => {
    if (p === 'Mod') return isMac ? '⌘' : 'Ctrl';
    if (p === 'Alt') return isMac ? '⌥' : 'Alt';
    if (p === 'Shift') return '⇧';
    if (p === 'Escape') return 'Esc';
    return p.length === 1 ? p.toUpperCase() : p;
  });
}

/** True for a key press typed into a field, which shortcuts must leave alone. */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (t as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'color'].includes(type);
  }
  return false;
}

/** Does this key press match one step ("v", "?", "Alt+1", "Mod+K") of a shortcut? */
export function matchStep(step: string, e: KeyboardEvent): boolean {
  const parts = step.split('+');
  const key = parts.pop()!;
  const mod = parts.includes('Mod');
  const alt = parts.includes('Alt');
  const wantMod = isMac ? e.metaKey : e.ctrlKey;
  if (mod !== wantMod || alt !== e.altKey) return false;
  if (!mod && (isMac ? e.ctrlKey : e.metaKey)) return false;
  // Alt changes the character on a Mac (Alt+1 types ¡), so match the physical key.
  if (alt && /^[0-9]$/.test(key)) return e.code === `Digit${key}`;
  if (alt && /^[a-z]$/i.test(key)) return e.code === `Key${key.toUpperCase()}`;
  if (alt && (key === '[' || key === ']')) return e.code === (key === '[' ? 'BracketLeft' : 'BracketRight');
  return e.key.toLowerCase() === key.toLowerCase();
}

/**
 * Score a command against what was typed in the palette. Every typed word has
 * to appear; words that start a word in the title score higher. 0 is no match.
 */
export function scoreCommand(c: Command, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const title = c.title.toLowerCase();
  const hay = `${title} ${c.group.toLowerCase()} ${(c.keywords ?? '').toLowerCase()} ${(c.hint ?? '').toLowerCase()}`;
  let score = 0;
  for (const w of q.split(/\s+/)) {
    const i = hay.indexOf(w);
    if (i < 0) return 0;
    const inTitle = title.indexOf(w);
    if (inTitle === 0) score += 6;
    else if (inTitle > 0 && /[\s(]/.test(title[inTitle - 1])) score += 4;
    else if (inTitle > 0) score += 2;
    else score += 1;
  }
  if (title === q) score += 10;
  return score;
}
