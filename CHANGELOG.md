# Changelog

## Unreleased

- Annotated case studies on four famous charts (Indira Gandhi, Rajiv Gandhi, John F. Kennedy, Martin Luther King Jr.): what the rules engine finds, what the classical texts say about it, where a practitioner would push back, and the dashas running at well-documented public events. A test checks every annotation against the engine.
- Classical citations on every yoga, dosha and reading family: a nullable `source` field with text, chapter and verse (BPHS, Phaladeepika, Saravali), shown as a superscript link, plus notes where the texts disagree with each other or with how the app reads them. Rules with no verified classical source say so instead of guessing.
- Shadbala (six-fold planet strength) and Bhava Bala (house strength) in the engine as `chart.strength`, with charts and explanations in the explorer.

## 1.0.0

First public release: chart engine, explorer with 16 vargas, 3D sky view, readings with yoga and dosha detection, timing dashboard, landing page. Licensed AGPL-3.0-or-later.
