# Avalon — final Game Studio polish and ship-readiness pass

This is the third and final source-level Game Studio pass before putting Avalon behind HTTPS/Caddy and doing live-device QA. The first pass made the rules and private actions faithful to the physical game. The second pass made the table viable on real phones/PWA sessions. This pass removes the last pieces of digital ceremony and makes the strategically important public information impossible to miss.

## Final UX principles

1. **The table remains the game.** Temporary information may appear over the felt only when it is the current event: quest cards, vote reveal, or the Assassin's final confirmation.
2. **Private before resolution, public after resolution.** Pending votes and individual quest cards remain secret. Once every vote is sealed, the individual votes are public game information and deserve a deliberate reveal.
3. **Strategic choices are not moral colours.** Approve and Reject are neutral tactical choices. Green/red remains reserved for actual Good/Evil allegiance and success/failure outcomes.
4. **Public results should not require five to ten phones to acknowledge them.** The server holds public reveals for a readable interval and then advances automatically.
5. **Irreversible actions require two deliberate gestures.** The Assassin first selects a player on the table, then explicitly confirms that named target.
6. **Do not invent a disconnected player's secret decision.** If a required private chooser disappears, preserve the seat and eventually offer the host an exceptional restart-round recovery instead of auto-voting, auto-playing a quest card, or guessing an assassination target.
7. **Recovery UI is exceptional.** It appears only after a prolonged disconnect, not as permanent host chrome.

---

## Final play-cycle storyboard

### 1. Entry / install

The first screen explains Avalon, then offers Host or Join. Practice, rules, characters, Resume, and PWA installation remain secondary. The first actionable controls fit small phone viewports and iOS inputs avoid focus zoom.

### 2. Lobby

The table, distinct public crests, room invitation, Ready, and host configuration are the only active concepts. Secret roles do not exist yet. Taken crests are visibly unavailable. The host cannot start until the table is legal and everyone is ready.

If the lobby host closes the app and remains offline, host authority can transfer to an online human after a grace period rather than leaving the lobby permanently stranded.

### 3. Private role reveal

Private identity still requires an intentional reveal. Backgrounding the page conceals identity information. A PWA process-kill resume restores the exact secret seat and privacy-locks private UI before it can be shown again.

### 4. Leader builds the quest party

Only the leader's player pieces are selectable. Selected physical crests lift and gain the quest marker. Non-leaders get a clean discussion/wait state rather than fake disabled choices.

If the current leader remains disconnected for a long period, leadership can pass to the next available seat. This changes no secret information and prevents a dead game.

### 5. Team vote — private

The proposed party remains highlighted and a compact text roster mirrors it for tiny screens and assistive technology.

Every player gets two neutral tactical actions:

- Approve
- Reject

They are deliberately **not** green/red because voting against a team does not mean Evil and approving one does not mean Good.

Until everyone has voted, only the anonymous sealed-vote count is public.

### 6. Team vote — public reveal

When the final vote arrives, the game does **not** instantly jump away. It enters a short `vote-result` reveal:

- Team approved / Team rejected
- the proposed team remains identifiable
- every player's Approve/Reject vote becomes visible at the same moment
- a short countdown explains what happens next

The table then advances automatically to the quest, the next leader, or Evil victory after the fifth rejection.

This restores a strategically important part of physical Avalon: players actually get time to see who voted how and discuss it.

### 7. Quest card choice

Every quest member receives the same visible two-card hand: Success + Betray. Position remains independently shuffled for every player/quest. Loyal players must submit Success; Evil may submit either. Individual cards are never published.

The temporary hand occupies the safe centre of the felt and disappears after sealing.

### 8. Quest result

The anonymous result pile and Success/Failure outcome remain visible for a short server-timed result reveal. No one has to press Continue.

This removes a non-strategic ceremony and fixes a major deadlock: a disconnected spectator can no longer stop the next quest just because their phone never acknowledged public information.

After the countdown, the server advances to:

- the next quest,
- Evil victory after three failed quests, or
- assassination after three successful quests.

### 9. Assassination

The Assassin taps a player first. That only selects the target. A separate physical confirmation appears in the centre of the table:

`Confirm <player name>`

with the warning that the final choice cannot be undone. This is intentionally two-step on touch screens.

Everyone else sees only that the Assassin is choosing.

### 10. Finished game / rematch

Winning side and reason dominate first, then every true role is revealed. Host can start a rematch, which returns the same public seats/crests to a clean lobby with all secret round state cleared.

---

# Disconnect and recovery contract

A mobile social game should recover connectivity without fabricating private decisions.

## Automatically recoverable

- PWA/browser process killed: restore the exact seat with the short-lived resume bridge.
- Host disappears: transfer administrative host authority after a substantial offline grace period.
- Current leader disappears during team building: pass leadership after a substantial offline grace period.
- Public quest result: auto-advance after the reveal interval; no acknowledgement is required.
- Public vote result: auto-advance after everyone has had time to see the revealed votes.

## Not safe to fabricate

- a missing private vote
- a missing quest Success/Betray card
- a missing role-reveal confirmation
- a missing Assassin target

For those states, if a human remains disconnected for a prolonged period, the host eventually gets **Restart round**. It is two-step, clearly says it clears the current round, preserves public seats, and returns everyone to the lobby for a fresh secret deal.

That is intentionally more conservative than silently making a strategic decision for another human.

---

# Visual polish completed

- Public vote reveal is a temporary physical event on the felt, not another dashboard panel.
- Approve/Reject uses neutral brass/stone materials instead of Good/Evil semantic colours.
- Proposed teams have a compact textual summary below the table during voting.
- Quest-result Continue/progress controls are removed; a small auto-transition countdown replaces them.
- Assassination confirmation is physically distinct and intentionally irreversible.
- Stalled-table recovery appears only when it is actually legal/useful.
- Focus-visible outlines remain strong for keyboard/accessibility use.
- Existing safe-area, dense 9–10 player layouts, reduced-motion rules, card physicality, private clue labels, and PWA install suppression during play are preserved.

---

# Validation gate before merge

The final branch must pass all of the following before it is considered ship-ready:

1. `npm test`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. Full five-client `tests/api-smoke.mjs` against the production build

The CI workflow now boots the built server and runs the API smoke automatically so future game/API changes cannot accidentally skip the full multiplayer lifecycle check.

---

# Live deployment QA — still required

Source inspection and CI cannot prove pixel-level phone layout. After HTTPS/Caddy deployment, do one short final live pass at:

- 360 × ~667
- 390px wide
- 430px wide
- installed PWA/standalone mode
- 5-player and 10-player tables

Prioritize these rendered states:

1. 10-player lobby with crest picker
2. private reveal, then background/foreground privacy conceal
3. largest team-selection state
4. vote before sealing
5. 10-player public vote reveal
6. Loyal and Evil two-card quest hands
7. Quest IV at 7–10 players
8. quest result with 0/1/2 Betray cards
9. Assassin target selection + confirmation
10. prolonged-disconnect recovery panel
11. game-over role reveal
12. PWA process-kill and exact-seat resume

For every screenshot ask: Is the table dominant? Is exactly one primary action obvious? Is anything colliding? Are private clues safe? Can a thumb reach the action? Does any colour imply incorrect game semantics? Does anything expose pending private information?

Browser/device screenshot QA is intentionally **not claimed** until this live pass is actually performed.
