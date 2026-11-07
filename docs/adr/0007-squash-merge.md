# 0007. Squash-merge only

- Status: accepted
- Date: 2026-11-07

## Context

The history on `main` is full of merge commits from long-lived branches, with conflict lists in their messages. `git log` does not tell a reader what changed or why, and bisecting lands on merges.

## Decision

Merge pull requests with **Squash and merge** only. The squash commit title is a sentence a changelog reader understands; the body keeps the pull request's summary. The repository settings allow only squash merging and delete branches after merge.

## Consequences

`main` reads as one line per change and every commit on it passed CI. Contributors' intermediate commits are not preserved on `main`, but remain in the pull request.
