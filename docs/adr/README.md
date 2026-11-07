# Architecture decision records

Short notes on decisions that a newcomer might otherwise undo by accident. Each says what we decided, why, and what we gave up. Future contributors need the reasoning, not just the outcome.

| # | Decision | Status |
|---|---|---|
| [0001](0001-record-decisions.md) | Record decisions as ADRs | accepted |
| [0002](0002-lahiri-default-ayanamsa.md) | Lahiri is the default ayanamsa | accepted |
| [0003](0003-whole-sign-for-yogas.md) | Yogas and doshas are judged by whole-sign houses | accepted |
| [0004](0004-agpl.md) | The project is AGPL-3.0-or-later | accepted |
| [0005](0005-everything-in-the-browser.md) | Charts are calculated in the browser, with no server | accepted |
| [0006](0006-readings-as-yaml.md) | Readings are YAML content, compiled to TypeScript | accepted |
| [0007](0007-squash-merge.md) | Squash-merge only | accepted |

To add one, copy [`template.md`](template.md) to the next number and open a pull request. Do not edit an accepted ADR to change its decision; write a new one that supersedes it.
