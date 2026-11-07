# @vedic/jaimini

The Jaimini layer of the toolkit, computed from an `@vedic/engine` chart.

```ts
import { jaimini, charaDashaAt, charaDashaReading } from '@vedic/jaimini';

const j = jaimini(chart, { karakaScheme: 8 }); // or 7
j.karakas;        // AK, AmK, BK, MK, (PiK), PK, GK, DK
j.arudhaLagna;    // AL, plus j.upapada (UL) and all 12 padas in j.arudhas
j.rashiDrishti;   // sign -> signs it aspects
j.charaDasha;     // sign mahadashas with 12 antardashas each
charaDashaReading(j, charaDashaAt(j.charaDasha).mahadasha!);
```

## Rules used

- **Chara karakas.** Grahas ranked by degree within their sign. The 8 scheme adds Rahu, measured as 30° minus its degree; the 7 scheme drops Rahu and the Pitrikaraka. Ketu is never a karaka. Each karaka reports its `margin` over the next so the UI can flag close calls.
- **Karakamsa.** Navamsa sign of the Atmakaraka.
- **Arudha padas.** Count from the house to its lord, then as far again from the lord. If that lands in the house or its 7th, move to the 10th from there. A1 is the Arudha Lagna, A12 the Upapada.
- **Scorpio and Aquarius.** The stronger of the two lords (Mars/Ketu, Saturn/Rahu): a lord sitting in the sign gives way to the other, then more grahas in company, then better dignity, then higher degree.
- **Rashi drishti.** Movable signs aspect fixed signs except the next; fixed signs aspect movable signs except the previous; dual signs aspect each other.
- **Chara dasha (K. N. Rao's method).** Starts at birth from the lagna; runs forward if the 9th from the lagna is Aries, Taurus, Gemini, Libra, Scorpio or Sagittarius, otherwise backward. A sign's years are the count to its lord (forward for those six signs, backward for the rest) minus one, 12 if the lord is in the sign, +1 for an exalted lord and −1 for a debilitated one. The second cycle gives each sign 12 minus its first-cycle years. Each sign splits into 12 equal antardashas starting from the next sign in the sign's own direction.

Other schools differ on several of these points (dual-lord strength, antardasha order, year length). The choices above are the common teaching and are covered by tests in `test/`.
