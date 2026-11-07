# How the good and bad times scores work

Every score runs from −100 (very difficult) to +100 (very favourable). Each one is a sum of named contributions ("reasons"), and the app shows those reasons next to the score, so no number is unexplained. The raw sum goes through `100 · tanh(sum / scale)`. That keeps scores in range, and one strong factor can't swamp all the others.

| Score | Label |
|---|---|
| ≥ 45 | Excellent |
| 15 to 44 | Favourable |
| −14 to 14 | Mixed |
| −44 to −15 | Challenging |
| ≤ −45 | Difficult |

The rules come from the standard Parashari sources:

- **BPHS**: Brihat Parashara Hora Shastra (Santhanam / Sharma translations)
- **LP**: Laghu Parashari (Jataka Chandrika)
- **PD**: Phaladeepika (Mantreswara)

The texts give the rules but not numbers. The weights below are this project's way of putting those rules on one scale, and every weight lives in the code next to the rule it encodes.

---

## 1. Dasha lord strength (`lordStrength` in `src/dasha.ts`)

A dasha gives the results of its lord: what the lord owns, where it sits, and how strong it is (BPHS ch. 46–48).

| Factor | Rule | Points | Source |
|---|---|---|---|
| **Dignity** (compound) | exalted +30, moolatrikona +24, own +20, great friend +14, friend +8, neutral 0, enemy −10, great enemy −16, debilitated −30 | ±30 | BPHS 3 |
| Compound relationship | Panchadha maitri: natural relationship plus temporal relationship. A sign lord in the 2, 3, 4, 10, 11 or 12th from the planet is a temporary friend. | — | BPHS 3.55–57 |
| **Neecha bhanga** | Debilitation is cancelled when the lord of the debilitation sign, or the planet exalted there, is in a kendra from the lagna or the Moon. The penalty then drops to −8. | — | PD 7 |
| **House from lagna** | 1st and 10th +14, 5th and 9th +14, 4th and 7th +10, 11th +9, 2nd +3, 3rd +7 for a malefic, 6th +4 for a malefic but −10 for a benefic, 8th −18, 12th −14 | ±18 | BPHS 47–48 |
| Viparita raja yoga | The lord of the 6th, 8th or 12th placed in the 6th, 8th or 12th gives +6 instead of the dusthana penalty. | +6 | BPHS 41 |
| **Functional nature** for the lagna (× 30) | trikona lords: 9th +1.0, 5th +0.8, lagna lord +0.7; malefic lords: 3rd −0.4, 6th −0.6, 11th −0.7, 8th −0.8 (0 if it also rules the lagna); kendra lords: natural benefics lose 0.2, 0.3 or 0.4 for the 4th, 7th or 10th (kendradhipati dosha, not applied to the lagna lord), natural malefics gain the same; 2nd and 12th lords neutral; yogakaraka (rules a kendra and a trikona) +0.5 | ±30 | BPHS 34, LP 1–2 |
| Natural nature (× 8) | Jupiter +1, Venus +0.8, Mercury +0.4, waxing Moon +0.4, waning Moon −0.2, Sun −0.3, Mars −0.6, Saturn −0.8, Rahu −0.7, Ketu −0.5 | ±8 | BPHS 3 |
| Combustion | Within the classical orbs of the Sun (smaller for retrograde Mercury and Venus) | −10 | Surya Siddhanta orbs |
| Retrograde | Strong in cheshta bala | +4 | BPHS 27 |
| From the Moon | 6th, 8th or 12th from the Moon −5; kendra or trikona from the Moon +4 | ±5 | Chandra lagna principle |
| **Baladi avastha** | Infant ¼, adolescent ½, adult full, old very little, dead nil. The planet's positive points are cut by up to 35% in proportion. | — | BPHS 45 |

**Rahu and Ketu** have no lordship. Following BPHS 47, they give the results of their dispositor (half its dignity points plus its functional nature × 15) and of any planet they are conjunct (that planet's functional nature × 12). They also get their own house placement and their exaltation in Taurus/Scorpio or debilitation.

### Sub-periods (`pairReasons`)

An antardasha mixes its own lord with the mahadasha lord. A pratyantar mixes three lords, weighted 0.40 / 0.35 / 0.25.

| Relationship of the sub-lord to the main lord | Points (× level weight × 1.6) | Source |
|---|---|---|
| 6th, 8th or 12th from the main lord | −14 | BPHS 52–56 antardasha results |
| 5th or 9th | +10 | ″ |
| conjunct | +8 | ″ |
| 4th, 7th or 10th | +7 | ″ |
| 11th | +8 | ″ |
| 3rd | +2 | ″ |
| Compound friend / great friend | +4 / +8 | BPHS 3 |
| Compound enemy / great enemy | −5 / −9 | ″ |
| A kendra lord and a trikona lord in sambandha (conjunction, exchange or mutual aspect +14; one-way aspect +8) | Raja yoga active in the period | BPHS 39–41, LP |

---

## 2. Transits, or gochara (`transitSnapshot` in `src/transits.ts`)

Transits are counted from the **natal Moon sign** (PD 26).

| Planet | Favourable houses from the Moon (vedha house in brackets) |
|---|---|
| Sun | 3 (9), 6 (12), 10 (4), 11 (5) |
| Moon | 1 (5), 3 (9), 6 (12), 7 (2), 10 (4), 11 (8) |
| Mars, Saturn, Rahu, Ketu | 3 (12), 6 (9), 11 (5) |
| Mercury | 2 (5), 4 (3), 6 (9), 8 (1), 10 (8), 11 (12) |
| Jupiter | 2 (12), 5 (4), 7 (3), 9 (10), 11 (8) |
| Venus | 1 (8), 2 (7), 3 (1), 4 (10), 5 (9), 8 (5), 9 (11), 11 (6), 12 (3) |

- **Weight per planet**: Saturn and Jupiter 22, Rahu 12, Mars and Ketu 9, Sun and Venus 5, Mercury 4, Moon 2. Slow planets dominate.
- **Favourable house**: +weight. **Unfavourable house**: −weight. The named Saturn and Jupiter phases (Sade Sati, Kantaka, Ashtama Shani, Janma Guru, Jupiter 8th or 12th) count ×1.2.
- **Vedha**: a planet in the paired house cancels a favourable transit (result 0). The Sun–Saturn and Moon–Mercury pairs are exempt.
- **Vipareeta vedha**: a planet in the good house paired with an unfavourable house cuts the harm to ¼.
- **Ashtakavarga** (BPHS 66–72): for each planet's own BAV in the transit sign, 0–3 bindus is weak, 4 is average and 5–8 is strong. It adds `(bindus − 4) / 4 × 0.6 × weight`. When ashtakavarga and gochara disagree, ashtakavarga halves the gochara result:
  - a favourable house with ≤3 bindus counts only half;
  - an unfavourable house with ≥5 bindus hurts only half.
- **Kakshya**: in the 3°45′ sub-division ruled by a contributor that gave a bindu, +0.15 × weight; otherwise −0.10 × weight (only for slow planets).
- **Transit dignity**: exalted, own or moolatrikona +0.2 × weight; debilitated −0.2 × weight.
- **Contacts**: conjunction or opposition within 2.5° to a natal planet or the lagna. Jupiter helps; Saturn, Mars and the nodes press. Contacts to the Sun, Moon or ascendant count ×1.4.

**Personal baseline.** Classical gochara has more unfavourable than favourable houses, so raw transit scores lean negative for everyone. The timeline subtracts the chart's own 30-year average, so "challenging" means *worse than usual for this person*. That average is `timeline.transitBaseline`.

## 3. Life weather (`buildTimeline`)

`combined = 0.6 × dasha score + 0.4 × (transit − baseline)`

The dasha gets the larger share following the classical principle that the dasha *promises* and the transit *triggers*: a transit cannot deliver what the running dasha does not support. The **favourable and challenging windows** are stretches of at least three weeks where the lightly smoothed combined score stays at or above +18, or at or below −18.

## 4. Sade Sati

A spell is Saturn's passage through the 12th, 1st and 2nd from the Moon, with retrograde re-entries merged into one spell. Its severity starts at −35. Each phase then adds `(bindus − 4) × 6` from Saturn's BAV in that sign. A Taurus, Libra, Capricorn or Aquarius lagna (Saturn functionally benefic) adds +18, and a Moon in a Saturn-friendly sign adds +8.

## 5. Retrogrades

Retrograde shadow periods are a modern (Western) timing aid, not a Parashari rule, and they are kept separate from the combined score. Each loop's score starts at −12. The natal house it covers adds −6 for a dusthana and −4 for a kendra. Stationing on a natal point adds −8 (or −5 for opposite), ×1.5 for the Sun, Moon or ascendant. If the planet was retrograde at birth, the loop gets +8.

---

## Checks

`test/scoring.test.ts` locks in textbook expectations. If a weight change breaks one of them, the change moved the model away from the texts.

- Yogakarakas for Taurus, Libra, Cancer, Leo and Capricorn
- Jupiter malefic for Taurus (8th and 11th lord) but benefic for Pisces (lagna lord despite the kendra)
- Mars benefic for Aries even though it rules the 8th
- Kendradhipati dosha on Jupiter for Gemini
- Yogakaraka Saturn in own sign in the 10th scores *Excellent*
- A debilitated 8th/11th-lord Jupiter in the 8th scores *Difficult*
- Neecha bhanga improves a debilitated planet's score
- A sub-lord 6/8 from the main lord scores below one in trine
- Rahu follows its dispositor
- Jupiter 11th from the Moon helps and Saturn 8th hurts
- Vedha blocks a good transit
