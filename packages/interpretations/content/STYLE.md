# Style guide for readings

A reading is for someone who wants to understand their own chart, not for an astrologer checking our maths. Write for that person. CI checks some of this; the rest is for reviewers.

## Voice

- **Second person, present tense.** "You lead by caring for people", not "The native will be a caring leader".
- **Plain English.** If a Sanskrit term matters, gloss it the first time in brackets: "dig bala (directional strength)". The readability check ignores a term that is glossed this way.
- **Tendencies, not verdicts.** "can", "tends to", "may" are honest. "will", "always", "guaranteed" are not. Never predict death, illness, divorce or ruin as a certainty. CI rejects a few of the worst phrasings.
- **Balanced.** Every placement has a gift and a cost. Give both, and end on what the person can do with it.
- **Original.** Write in your own words. Do not paste or closely paraphrase a book, a website or another program's output, even with credit. Classical *rules* are fine to state; someone else's *prose* is not.
- **No advice in disguise.** Not medical, legal or financial advice. "Heat or blood pressure issues" names a tendency; "stop taking your medication" is never acceptable.
- **Spelling.** British spelling, as the rest of the text uses (organise, colour, favour). Curly apostrophes and quotes (’ “ ”); CI flags a straight apostrophe inside a word.

## Shape

| Field | What it is | Rules |
|---|---|---|
| `summary` | The headline, shown first | One sentence, under 120 characters, ends with a full stop. Usually "Placement: the gist." |
| `detail` | The reading | One paragraph for sign and house; one to three for nakshatra. Each ends with a full stop. Aim for 40 to 120 words. |
| `strengths` | Short phrases | One to six, lower case, no full stop: `courage`, `financial sense` |
| `challenges` | Short phrases | Up to six, same form |
| `score` | Classical weighting, −3 to +3 | Planet in house only (required there). Optional for nakshatra. Never for sign, where dignity sets it. |
| `credit` | Your name as you want it shown | Optional. Appears on the credits page. |

## Readability limits

`test/readability.test.ts` holds every English reading (summary plus detail) to:

- no sentence over 40 words;
- for readings of 30 words or more, a Flesch–Kincaid grade of 13 or under and at most 5 unglossed technical terms per 100 words;
- for shorter readings, at most 2 unglossed technical terms;
- an average grade over the whole corpus of 9.5 or under.

If your reading fails, split the longest sentence, swap a long word for a short one, or gloss a term. The list of terms is in `src/qa/readability.ts`.

## Yogas

Every yoga in `src/yogas.ts` needs, in `yogas.yaml`:

- `citation.source` and, where known, `citation.ref` (chapter or verse). Leave `verified: false` unless you have checked the reference in a printed translation; then set it to `true` and fill in `edition` (translator, publisher, year) and `verifiedBy`.
- `cancellation`: what weakens or cancels the yoga, and say whether the detector checks it. If tradition disagrees, say so.

It also needs a positive test chart in `test/fixtures/yoga-charts.json`. `npx tsx scripts/find-yoga-fixtures.ts <yoga-id>` searches for one.
