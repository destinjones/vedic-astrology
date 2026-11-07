# Discussion seeds

Posts to open once GitHub Discussions is turned on, so the first visitor finds conversations rather than an empty room. Each case study uses a chart from the app's Famous charts library, where the birth data and its Rodden rating are shown. Post them as the maintainer; edit freely.

Yoga lists below are what the detector found with Lahiri ayanamsa and whole-sign houses on 2026-11-07. Check them in the app before posting, in case a later change moved them.

---

## Announcements: Welcome, and what this space is for

Jyotisha Explorer is a free, open-source Vedic chart explorer that runs entirely in your browser. This is the place to ask about a chart or a reading, argue about a rule, or propose an idea. Bugs and planned work stay in Issues.

A few ground rules: share only your own birth details or a public figure's, never someone else's without their permission. Readings are for reflection, not medical, legal or financial advice. And disagreement about rules is welcome, especially with a source: that is how the rules get better.

If you practise Jyotish and would be willing to check one of our calculations or rules against your own method, please say so in the Practitioners thread. Every checker is named on the credits page.

---

## Q&A: How is a chart calculated here, step by step?

Pinned explainer. Birth time to UTC with the IANA time zone database (or a local mean time offset you give), Swiss Ephemeris 2.10.03 for tropical positions, subtract the chosen ayanamsa (Lahiri by default, see docs/adr/0002), whole-sign houses from the ascendant (docs/adr/0003), then dignities, vargas, dashas and the yoga and dosha rules in `packages/interpretations/src`. Ask about any step below.

---

## Show and tell: Case study, Mahatma Gandhi (Libra rising)

Libra lagna with Venus, its lord, in Libra, which makes **Malavya**, the Venus Mahapurusha yoga. Saturn rules the 4th and 5th for Libra and is the **yogakaraka**. Jupiter in a kendra from the Moon gives **Gaja Kesari**, and Mercury, Venus and Jupiter together form **Saraswati**. The Manglik check finds Mars but cancels it, with Jupiter among the reasons.

The birth time is only approximately documented (Rodden C), so the lagna is debated. Questions: does a few minutes either way change the vargas you would read? And how much weight do you give a Mahapurusha yoga in a chart with this many raja yogas?

---

## Show and tell: Case study, Srinivasa Ramanujan (Gemini rising)

Gemini lagna with a Pisces Moon in Uttara Bhadrapada. The detector finds **Amala** (a benefic in the 10th) as strong, **Chandra-Mangala**, two **Dhana** links, a **Dainya Parivartana** sign exchange, and a high **Manglik** score without cancellation.

Ramanujan's genius and his short life are both famous. How would you read the mind (Moon, Mercury, the 5th) in this chart, and do you read the Dainya exchange as the hardship or as the way out of it?

---

## Show and tell: Case study, Swami Vivekananda (Sagittarius rising)

Sagittarius lagna with the Moon in Virgo in Hasta, an AA-rated birth time. The detector finds a **Maha Parivartana** exchange as strong, a **Raja** yoga, **Sunapha**, **Vesi**, and **Pasha**, a Sankhya Nabhasa yoga, but no Pravrajya (renunciation) yoga, since it needs four planets in one sign.

A monk without a Pravrajya yoga: what in this chart would you point to for renunciation? Is our detector missing a rule here?

---

## General: Practitioners, would you check our work?

We test against published values (Mercury stations, ingresses, Sade Sati dates, B. V. Raman's Shadbala example), but a practising astrologer comparing a chart against their own hand calculation or software is the check we value most. If you will take one chart and tell us where we match and where we do not, reply here. You will be named on the credits page, and anything you find becomes an issue.

---

## Ideas: What should come next?

The public roadmap is on the project board. Vote with a 👍 on the ideas you want, or add one here.
