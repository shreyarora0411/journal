# Design brief

Externally maintained — the canonical brief lives in the design tool used by the product designer. This file mirrors the parts the codebase needs to be authoritative about.

## Aesthetic posture

Literary magazine, photographer's notebook, well-kept journal. Not Instagram. Not Airbnb. Not Tripadvisor. Quiet, considered, slightly insider.

## The five hero flows

These are the flows that need to feel right before TestFlight. Manual QA before each build covers all five.

1. **Onboarding** — phone OTP → framing → Instagram (skippable) → friends → welcome → home.
2. **Logging a trip** — Quick mode for the impatient case; Detailed mode for the thoughtful case. Both must feel light.
3. **Reading a trip** — your own and a friend's. Cover photo, italic-serif title, prose, framed photos, entity sections.
4. **Searching the friend graph** — the WhatsApp-replacement test. Type a place, see friends' notes, faster than asking in chat.
5. **Following a new friend** — visit a profile, follow, immediately see their existing trips in your feed.

## Wireframes

Linked from the design tool; not duplicated here. When implementing a screen, reference the wireframe by name (e.g. "Wireframe: Onboarding/Phone").

## Typography behaviour

- Trip titles always Newsreader medium italic.
- Friend voice quotes always Newsreader italic, never sans.
- Body and UI copy in Inter.

## Photo treatment

- Framed (4px paper padding inside a 1px hairline).
- Aspect-preserving — never forced square.
- Cover photo on a card capped at 220px wide.

## Empty states

- Feed empty (no friends followed): the welcome message + "find friends" CTA.
- Feed empty (no trips logged anywhere): the welcome message + "log your first trip" CTA.
- Search empty: a single faint line — "Type a place. Your friends have probably been."

## Out of scope (v0)

See CLAUDE.md §12.
