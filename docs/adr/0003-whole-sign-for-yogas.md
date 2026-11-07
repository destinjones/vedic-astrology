# 0003. Yogas and doshas are judged by whole-sign houses

- Status: accepted
- Date: 2026-11-07

## Context

The engine can compute houses as whole sign, equal, Sripati, Placidus, Koch and others, and the explorer can display several. A yoga rule such as "Jupiter in a kendra from the Moon" depends on which houses you mean. Under a quadrant system, the same chart can gain or lose a yoga depending on house cusps, which shift a lot with birth time and latitude.

## Decision

The default house system is whole sign, and every yoga and dosha detector judges houses by whole sign from the ascendant (or from the Moon or Sun where the rule says so), whatever house system the user picks for display.

- Parashari texts state these rules in terms of rashis (signs) counted from the lagna, which is whole sign.
- It makes detection reproducible: a yoga found today is found tomorrow, in any browser, regardless of display settings, and our results can be checked by hand from a sign chart.
- It is less sensitive to an uncertain birth time.

## Consequences

Someone who reads bhava chalit or Sripati houses may see a planet in a different house in the display than the one a yoga reason mentions. The reason text says "house" in the whole-sign sense, and the interpretations README says so. A future option to detect by another system would need its own ADR and test fixtures.
