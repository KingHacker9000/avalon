# Avalon mobile web / PWA storyboard — pass 2

This is the second Game Studio UX audit. The first pass made the core game understandable and fixed role-telling quest interactions. This pass assumes the rules work and asks a more practical question:

> **What happens when ten people are actually standing around a table, holding phones, switching apps, losing signal, tapping quickly, and trying to read the game in one hand?**

The target is a mobile-first social board-game companion, not a dashboard. At any moment a player should be able to glance at the screen and answer:

1. **Where are we?**
2. **What matters right now?**
3. **Is it my turn to do something?**
4. **What information on my screen is private?**

---

## Pass-2 visual direction

### Fantasy

A warm, physical Arthurian table: walnut, worn felt, brass, painted cards, wax-like tokens and heraldic player crests. UI should feel laid onto the table rather than floating above it like a web admin panel.

### Persistent mobile UI budget

During active play:

- compact app header
- compact private-role rail only when intentionally visible
- round table and quest pieces
- one contextual action surface
- collapsed history

Everything else is disclosure-on-demand.

### Motion language

Use motion only for meaningful state changes:

- a selected player lifts slightly
- the current quest arrives/glows once
- sealed choices pop into place
- result cards deal onto the table
- phase/action surface eases in

Do **not** keep decorative elements constantly bouncing or pulsing. Reduced-motion users must get the same information without animation.

---

# Storyboards

## P2-01 — Fresh launch on a small phone

### Player sees

- Camelot framing and one concise explanation.
- Host / Join immediately available.
- Name field.
- Room code only after choosing Join.
- Practice is clearly secondary.

### Primary action

Create room or Join room.

### Mobile requirements

- The useful form should fit within a normal phone viewport without an artificial 760–820px minimum-height scroll.
- Inputs are at least 16px on iOS so focusing does not zoom the page.
- Keyboard opening must not push the submit action into an unreachable area.
- Safe-area inset is respected in installed PWA mode.

### Pass-2 change

The landing stage now follows the small viewport instead of forcing the old oversized hero height.

---

## P2-02 — Installable PWA prompt

### Before joining

The install prompt may appear as a secondary action.

### Once inside a room

The install prompt disappears.

### Why

A floating install CTA over a live team vote or quest-card decision is dead chrome and can physically cover the thumb zone.

### Pass-2 change

The PWA install control is hidden whenever the active game shell exists.

---

## P2-03 — Reopen the PWA after the OS killed it

This is a real mobile failure mode, not an edge case.

### Previous problem

The authenticated seat token lived only in `sessionStorage`. If Android/iOS killed the PWA/browser tab and the player reopened Avalon, the player could lose the only credential that reconnects to their secret seat. Mid-game joining is intentionally blocked, so that could strand the whole table.

### New flow

1. Active seat is mirrored to a short-lived local resume record.
2. Reopening the same room restores that seat token into the normal session channel.
3. Server remains authoritative and confirms whether the room/seat still exists.
4. Any private role UI is privacy-locked during restoration and is immediately concealed before the player resumes.
5. Explicitly leaving a lobby/finished room clears the normal session and therefore clears the persisted resume record.
6. The local resume credential expires after 24 hours.

### Primary action

None if recovery succeeds; the player resumes the exact seat.

### Security note

The resume record deliberately trades a small amount of local persistence for mobile recoverability. It expires and remains same-origin only. A future server-managed secure-cookie design would be cleaner, but this is substantially safer for actual play than silently losing the only seat token on PWA termination.

---

## P2-04 — Lobby with five players

### Player sees

- five distinct public crests around the table
- open seats if capacity is larger
- host marker
- ready markers
- avatar customization
- room code / invite

### Primary action

Ready up.

### Pass-2 refinement

Occupied table seats must remain full-opacity even while they are not clickable. The global disabled-button opacity previously made most player pieces look inactive/dull outside selection phases.

---

## P2-05 — Lobby with nine or ten players

### Risk

Dense circular seating creates three common mobile collisions:

- neighbouring names
- private clue badges
- own-role text below the local player

### Player sees

- slightly wider seat circumference
- smaller dense-table crests while the **button hit area** remains usable
- one-line ellipsized names instead of multi-line collisions
- shorter private clue labels on small screens (`Merlin?` / `Evil`) while the full clue remains in the accessibility label/title

### Pass-2 change

The seat radius and dense-table styling now adapt at 9–10 players.

---

## P2-06 — Public avatar choice

### Previous issue

Customization existed, but the game only exposed eight crests for a game that supports ten players, and duplicate choices were permitted. A ten-player game could therefore recreate the exact identification problem avatars were meant to solve.

### New contract

- twelve public crests are available
- joining players are assigned an unused crest when possible
- a player cannot select another occupied player's crest
- taken crests are visibly unavailable in the picker
- avatar identity stays public and completely independent of secret role

### Why twelve instead of ten

A little spare capacity keeps the picker from feeling artificially exact and leaves room for future lobby customization without immediately reintroducing duplicates.

---

## P2-07 — Private role already revealed

### Previous problem

The persistent role strip repeated information already shown beneath the local player's table avatar and consumed too much vertical space on a phone.

### New mobile hierarchy

- small portrait
- role name / allegiance
- hide button
- detailed role description remains in the private identity modal
- table-attached clue markers carry relevant private knowledge

### Primary action

None; this is reference information.

### Privacy

The rail can still be hidden instantly. PWA resume starts concealed.

---

## P2-08 — Leader builds a team

### Player sees

- current quest piece
- leader marker
- full-opacity table
- only actually selectable players respond visually to touch
- selected players lift and carry the quest marker
- compact action dock with `Propose X/Y`

### Primary action

Choose the exact team, then Propose.

### Fluidity requirement

The action surface must not be a 280px empty panel below the table. On mobile it behaves like a compact sticky contextual dock.

---

## P2-09 — Non-leader waits during team construction

### Player sees

- who the leader is
- current quest requirement
- table remains visually alive for discussion

### Primary action

None.

### Important visual rule

Non-actionable player seats still look like players. Disabled state is functional, not a visual grey-out of the whole table.

---

## P2-10 — Team vote

### Player sees

- approved candidate team highlighted
- phase eyebrow: Team vote
- Approve and Reject as equal thumb-sized actions
- anonymous submission progress

### Primary action

Approve or Reject.

### Pass-2 refinement

On a phone, the vote control is a compact sticky action dock so it remains reachable after the player studies the table.

---

## P2-11 — Quest member chooses a card

### Critical physical layout issue found

The first-pass quest hand was anchored near the bottom of the table. On 8–10 player phone layouts, that can overlap the player seated around six o'clock.

### New layout

- the two cards are placed in the safe centre of the felt
- the quest board recedes temporarily behind the cards
- player avatars remain unobstructed
- card order is still independently shuffled per player and quest
- the card hand disappears after submission

### Loyal player

Both cards are visible, matching everyone else's physical action. Tapping Betray is refused privately and locally with a concise explanation rather than making a noisy failed API round trip.

### Evil player

Success or Betray is accepted.

### Public information

Nobody else receives the selected card.

---

## P2-12 — Quest spectator

### Player sees

- approved quest party
- current quest piece
- anonymous sealed-card count

### Primary action

None.

### Do not show

- disabled fake cards
- somebody else's card animation
- which player has or has not chosen a specific card

---

## P2-13 — Quest board atmosphere

The board should feel like a game board rather than five generic status boxes.

### Pass-2 additions

- subtle felt lighting / depth
- current quest receives one restrained focus effect
- quest pieces have story names:
  - Whispering Woods
  - Broken Crossing
  - Forgotten Chapel
  - Shadowed Keep
  - Gates of Camelot
- on small phones only the current quest's name stays visible to avoid clutter

The names are flavour, never required rule information.

---

## P2-14 — Quest result

### Player sees

- result first: succeeded / failed
- anonymous card pile
- fail count
- updated quest track

### Previous presentation issue

The result renderer constructed all Fail cards first. Even though no submitter ordering existed, deterministic left-to-right grouping could look meaningful to players.

### Pass-2 change

Cards are visually interleaved and dealt with slight physical offsets. This is presentation-only and is still derived solely from the anonymous counts.

### Primary action

Continue under the current rules.

---

## P2-15 — Rejection danger

### Player sees

- rejection tokens integrated with the quest board
- at four rejections: unmistakable `Next rejection: evil wins`

### Primary action

None during the result itself; the next leader builds the next proposal.

### Motion

Filled rejection marks may gain subtle emphasis, but no continuous flashing.

---

## P2-16 — Assassination

### Assassin

- eligible targets on the table
- selected target visibly marked
- action dock remains reachable

### Everyone else

- `The Assassin is choosing`
- no target controls

### Remaining high-priority issue

Assassination is irreversible and currently submits on one button press after target selection. On a small touch screen, that deserves a deliberate confirmation step (`Confirm <name>` or press-and-hold) before final submission.

This pass documents the issue but does not silently change the game protocol.

---

## P2-17 — Finished game

### Player sees

- winning side and reason
- all identities revealed
- good character names green / evil red
- rematch for host

### Visual goal

This should feel like a reveal/reward state rather than another settings page. Result cards and role portraits can enter with restrained one-time motion.

---

## P2-18 — Reconnecting during an active phase

### Player sees

One compact reconnecting notice. The table stays visible.

### Must preserve

- exact secret seat
- private role
- existing vote/card state
- current team selection / server phase

### No duplicate controls

Do not stack connection banners, install prompts and action errors over one another.

---

## P2-19 — Reduced motion

When the OS asks for reduced motion:

- no dealing animation is required
- no lift/arrival animation is required
- transitions become effectively instantaneous
- all colour, labels, progress and focus states still communicate the same information

---

# Pass-2 findings

## Critical — fixed

### C1. Installed/mobile app restart could lose the only active seat token

`sessionStorage` alone is not robust to mobile process termination. Because active games reject replacement joins, losing the token can strand the player and block the game.

**Fix:** short-lived persisted resume bridge + privacy lock on restoration.

### C2. Public avatar system did not guarantee distinct players

The game supported ten players but only eight public crests, and duplicates were legal.

**Fix:** twelve crests, automatic unused assignment and server-enforced uniqueness.

---

## High — fixed

### H1. Quest hand could cover a player on dense mobile tables

**Fix:** move the temporary card hand to the centre of the felt and recede the quest board during the decision.

### H2. Non-actionable player seats inherited global 45% disabled opacity

This made the round table look dead in most phases.

**Fix:** table seats remain fully legible; only interaction affordance changes.

### H3. PWA install CTA could sit over live game controls

**Fix:** hide it after entering a room.

### H4. Action panels were too tall for one-handed mobile play

**Fix:** compact phase surfaces and sticky action docks for reveal, team selection, voting and assassination.

### H5. Dense private labels could collide at 9–10 players

**Fix:** adjusted seating radius, dense crest sizing, shorter visual clues and one-line names.

### H6. Private role strip duplicated too much information

**Fix:** compact mobile identity rail.

---

## Medium — fixed

### M1. Loyal Betray tap produced a server-style error path

The rule was correct but the interaction felt broken.

**Fix:** identical hand remains visible, but the illegal choice is refused privately and immediately on the local screen.

### M2. Result cards looked ordered

**Fix:** visually interleave and physically offset the anonymous pile.

### M3. Game state changes felt static

**Fix:** one-time phase arrival, selection, sealing and result-deal motion with reduced-motion fallback.

### M4. Quest pieces lacked story texture

**Fix:** subtle physical depth and quest names, with mobile disclosure kept sparse.

---

# High-priority follow-ups found in pass 2

These should be separate deliberate rule/flow changes rather than CSS patches.

## F1. Result acknowledgement requires every player

Every quest result currently waits for all players to press Continue. That is extra digital ceremony that does not add strategy and creates a deadlock when one phone disconnects.

**Recommended redesign:** show the result for a short minimum interval, then let the next leader/host continue, or auto-advance after a clearly visible grace period. Do not require N acknowledgements forever.

## F2. An offline current leader can stall team selection indefinitely

The game preserves the seat correctly, but there is no social recovery mechanism if the current leader's phone dies permanently.

**Recommended redesign:** after a substantial offline grace period, expose a host recovery action that passes leadership without leaking or replacing the secret seat.

## F3. An offline Assassin can stall the ending indefinitely

Same category as F2, but at the final phase.

**Recommended redesign:** secure seat-resume first; only then consider a host-assisted recovery path with explicit table consent.

## F4. Assassination needs deliberate confirmation

Target selection + irreversible submit is too easy to mis-tap on mobile.

**Recommended redesign:** select target → explicit `Confirm <name>` step or press-and-hold.

## F5. Lobby role configuration lets the host attempt impossible combinations

The server correctly rejects too many special good/evil roles for the chosen player count, but the UI should prevent impossible toggles before the request is sent.

**Recommended redesign:** grey out only the role toggles that would exceed the available allegiance slots, with a short reason.

## F6. Host can disappear in the lobby without formally leaving

If the host simply closes the page, other players can remain ready but unable to configure/start.

**Recommended redesign:** after an offline grace period in the lobby, allow deterministic host transfer to another human player.

## F7. Legacy `pawn` source wording is still patched at runtime

The visible copy is corrected, but a DOM text-rewrite effect remains technical debt.

**Recommended cleanup:** replace the two source strings in `app/page.tsx` and remove the mutation code from the table component.

## F8. Proposed-team text summary could help accessibility and tiny screens

The table highlight is good visually, but a compact textual roster in the vote phase would help screen readers and players with very long/dense seating layouts.

**Recommended enhancement:** `Quest team: Alice · Bob · Chen` near the vote question, without adding another card/panel.

---

# Device QA matrix for the next live pass

Source/CI validation is not a substitute for rendered phone QA. After deployment, exercise these exact states on the live HTTPS PWA:

### Widths

- 360px
- 390px
- 430px
- tablet portrait

### Heights

- short ~667px viewport
- modern tall phone
- installed PWA with top/bottom safe areas
- keyboard open on Host and Join forms

### Player densities

- 5
- 7
- 10

### Private roles

- Merlin with multiple evil clues
- Percival with two Merlin candidates
- Oberon with no ally knowledge
- Assassin
- ordinary Loyal Servant

### Game states

- lobby with open seats
- lobby full / all ready
- reveal hidden / revealed
- leader selecting maximum team
- non-leader waiting
- vote before and after sealing
- four rejected proposals
- loyal quest hand
- evil quest hand
- 10-player quest hand with a bottom seat
- Quest IV two-fail warning
- quest result with 0, 1 and 2+ Betray cards
- assassination target selection
- reconnect notice
- PWA kill/relaunch active-seat recovery
- game over with 10 revealed roles

### Screenshot questions

For every state, ask:

1. Is the table still the dominant object?
2. Is one primary action obvious?
3. Is any inactive control competing with it?
4. Are all player names/clues readable without collisions?
5. Does private information have an obvious conceal affordance?
6. Can the primary action be reached with one thumb?
7. Does anything touch the notch/home indicator?
8. Are images/cards preserving aspect ratio?
9. Does the result look like physical game state rather than generic web cards?
10. Could any visible difference leak allegiance or a private choice?
