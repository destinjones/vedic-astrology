# 0001. Record decisions as ADRs

- Status: accepted
- Date: 2026-11-07

## Context

The project has one maintainer and a lot of choices that look arbitrary from outside: which ayanamsa, which house system, which licence, why there is no server. Without the reasons written down, a well-meaning contributor will "fix" one of them.

## Decision

Record each such decision as a numbered, short Markdown file in `docs/adr/`, in the format of `template.md`. Accepted records are not rewritten; a new one supersedes an old one.

## Consequences

Reviewers can point to a record instead of re-arguing. Writing one costs ten minutes.
