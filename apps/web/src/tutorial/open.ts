// Opens the tutorial from anywhere in the app: a button, a command or a "watch this part" link.
export const TUTORIAL_EVENT = 'vedic:tutorial';

/** Opens the tutorial player, at a chapter (an id from chapters.json) or where the viewer left off. */
export function openTutorial(chapter?: string) {
  window.dispatchEvent(new CustomEvent(TUTORIAL_EVENT, { detail: chapter ?? null }));
}
