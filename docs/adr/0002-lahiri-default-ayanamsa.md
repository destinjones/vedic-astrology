# 0002. Lahiri is the default ayanamsa

- Status: accepted
- Date: 2026-11-07

## Context

A sidereal chart subtracts an ayanamsa (the drift between the tropical and sidereal zodiacs) from every longitude. Schools disagree on its value by up to a few degrees, which can move a planet into another sign or nakshatra. The engine supports a dozen; the explorer offers four (Lahiri, True Chitra, Raman, Krishnamurti).

## Decision

Default to Lahiri (Chitrapaksha), Swiss Ephemeris `SE_SIDM_LAHIRI`.

- It was adopted by the Government of India's Calendar Reform Committee (1955) and is used in the official Indian Astronomical Ephemeris, so it is the closest thing to a standard.
- It is the default in most Jyotish software and in most printed panchangas, so a visitor comparing our chart with another program, or with a chart an astrologer gave them, will usually see the same signs and nakshatras.
- The rules and worked examples we test against (for example B. V. Raman's Shadbala example, which uses Raman's own ayanamsa and is tested with it) state their ayanamsa, and we follow it in those tests.

## Consequences

KP practitioners must switch to Krishnamurti, and some will prefer True Chitra; both are one click away and are kept in share links. A user's chosen ayanamsa is always shown with the chart so a mismatch is visible.
