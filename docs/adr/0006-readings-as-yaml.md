# 0006. Readings are YAML content, compiled to TypeScript

- Status: accepted
- Date: 2026-11-07

## Context

The reading text started as TypeScript tuples in `packages/interpretations/src/data/`. That kept everything type-checked, but it meant a writer or an astrologer had to edit TypeScript, escape apostrophes and count array positions to fix a sentence. The readings are the part of the project most open to non-programmers, and 242 of 243 planet-in-nakshatra cells are still composed rather than written.

## Decision

Keep reading text in `packages/interpretations/content/*.yaml`, one file per planet and table, validated by JSON Schemas and a style check, and compile it to `src/data/generated/content.ts` with `npm run content`. The generated file is committed, and CI fails if it is stale. The runtime and the web app import TypeScript as before and do not parse YAML.

## Consequences

- Contributors edit readable files with editor completion, and errors name the file and the reading.
- Two sources must be kept in step; `npm run content:check` in CI enforces it.
- Translations still live in TypeScript packs (`src/locales/`). Moving them to YAML, so a translation platform can manage them, is the next step and needs its own change.
