# Avalon mobile play-cycle UX storyboard

This document is the state-by-state UX contract for the mobile game. It is intentionally stricter than a feature list: every state should answer **what do I know, what am I waiting for, and what can I do now?** without exposing private information or turning the table into a dashboard.

## Product rules for the UI

1. **The table is the game.** During play, the round table and the current decision are the dominant surfaces. History, rules, character reference, and other secondary information stay collapsed.
2. **One primary decision at a time.** A player should never have to choose between unrelated primary actions.
3. **Identical public behaviour must not leak allegiance.** In particular, every quest member receives the same two-card presentation. Loyal players must submit Success; evil players may submit Success or Betray. The card order is independently shuffled for every player and every quest.
4. **Private information stays private.** Other players' roles, individual pending votes, individual quest cards, and secret knowledge must never be published. Private role/knowledge can be hidden instantly when passing or lowering a phone.
5. **Don't show dead actions.** Room sharing is useful in the lobby and useless after the game starts because mid-game joins are rejected. Game settings are lobby-only. History is reference-only and collapsed.
6. **Mobile first.** Important controls sit inside the thumb-reachable game flow, use large hit areas, respect safe areas, and do not rely on hover or tiny icon-only affordances for the current action.
7. **Server state is authoritative.** UI animation and optimistic feedback may make interaction feel immediate, but game rules and accepted actions remain owned by the game engine.

## Persistent mobile hierarchy

During an active game the screen should read in this order:

1. Compact header: Avalon, rules/characters, step-away action.
2. Private identity strip when intentionally visible.
3. Round table: players, leader/team markers, private clues, quest track, rejection track.
4. Current action surface: only the decision/wait state for this phase.
5. Collapsed History.

The room invitation code belongs to the lobby only. Active play should not carry an invitation CTA that cannot be used.

---

## Storyboard 0 — Entry / newcomer

**Player sees**
- Avalon hero framing and a one-line explanation of hidden roles, quests, and deception.
- Host / Join as the two obvious paths.
- Name input; room code only when Join is selected.
- Practice as a secondary option.
- Resume only when this browser actually has a remembered seat.

**Primary action**
- Create room or Join room.

**Secondary**
- Practice, How to play, Character guide, Resume.

**Do not show**
- Lobby settings, role configuration, history, quest mechanics, or install guidance at equal visual weight with Host/Join.

**Exit**
- Successful create/join enters the lobby.

**Mobile note**
- Keyboard opening must not bury the submit button below the viewport.

---

## Storyboard 1 — Lobby: normal player

**Player sees**
- Round table with filled/open seats.
- Public avatar picker.
- Host marker.
- Ready state of each player.
- Own Ready up control.
- Room invitation/code because new players can still join.
- Settings collapsed; non-host controls inside are disabled/read-only where appropriate.

**Primary action**
- Ready up / unready.

**Secondary**
- Pick public avatar, copy invite, read rules/characters.

**Do not show**
- Any secret-role content; roles have not been dealt.
- Kick/remove actions to non-hosts.

**Exit**
- Host starts after at least five players and everyone is ready.

---

## Storyboard 2 — Lobby: host

Same as a normal player, plus:

**Host-only secondary tools**
- Table capacity 5–10.
- Optional characters.
- Remove another human player.

**Primary action once ready**
- Start.

**Guardrails**
- Start is disabled until rules permit it, with an explicit reason such as `3/5 ready` or `2 more needed` rather than a mysterious disabled button.
- Role configuration is never accessible once play begins.

---

## Storyboard 3 — Private role reveal

**Player sees before reveal**
- A private card back and explicit `Reveal` action.
- Progress indicating how many players have confirmed, without saying who is slow unless that becomes an intentional social feature.

**After tapping Reveal**
- Character portrait.
- Good/evil allegiance.
- Concise role goal.
- Only the knowledge this character is entitled to.

**Role-specific knowledge**
- Merlin: evil except Mordred.
- Percival: Merlin/Morgana candidates look identical and are attached to the relevant player avatars.
- Evil except Oberon: known evil teammates, excluding Oberon.
- Oberon: no evil-team knowledge.
- Loyal Servant / other roles with no knowledge: explicit `You have no knowledge of other identities` rather than an unexplained empty space.

**Primary action**
- Ready / conceal the reveal.

**Privacy behaviour**
- Backgrounding the tab hides private information.
- Hide Role remains available after reveal.
- Private labels on table avatars disappear when the role is concealed.

**Exit**
- All players confirmed → team selection.

---

## Storyboard 4 — Team selection: leader

**Player sees**
- Current quest highlighted.
- Exact party size on the quest tile and in the action copy.
- Leader marker on their own avatar.
- Tappable player avatars; selected players visibly lift/highlight and receive the team marker.
- `Propose X/Y` as the only primary action.

**Primary action**
- Tap exactly the required number of players, then Propose.

**Secondary**
- Rules, character reference, history.

**Do not show**
- Vote buttons before proposal.
- Controls unrelated to team selection.
- The word `pawn`; people are selecting players/avatars.

**Exit**
- Proposal submitted → everyone votes.

---

## Storyboard 5 — Team selection: non-leader

**Player sees**
- `Alice is choosing a team` (or equivalent) and leader marker.
- Current quest requirements.
- Table remains readable for discussion.

**Primary action**
- None. This is a social discussion/wait state.

**Do not show**
- Disabled fake selection controls that look actionable.

**Exit**
- Leader submits proposal.

---

## Storyboard 6 — Team vote: not yet voted

**Player sees**
- Proposed team highlighted on table.
- Clear `Approve team?` question.
- Two equally reachable actions: Approve / Reject.
- Submission progress as anonymous count only.

**Primary action**
- Approve or Reject.

**Security**
- No individual pending vote is visible.
- A vote cannot be changed after it is sealed.

**Exit**
- Player submits → sealed wait state. All votes submitted → resolution.

---

## Storyboard 7 — Team vote: vote sealed

**Player sees**
- `Vote sealed` confirmation.
- Proposed team and table remain visible for conversation.
- Anonymous submission count.

**Primary action**
- None.

**Exit**
- All votes resolve.

**Resolution**
- Majority approves → quest.
- Tie or majority reject → rejection track advances, leadership rotates, back to team selection.
- Fifth consecutive rejection → immediate evil victory.

---

## Storyboard 8 — Quest member: loyal character

This state must be visually indistinguishable from the evil quest-member state to anybody observing the player's gesture.

**Player sees**
- Two physical cards on the table: **Success** and **Betray**.
- The left/right position is independently shuffled for this player for this quest.
- Copy: `Choose one card`.
- General rule reminder: `Loyal characters must submit Success. Evil may submit either card.`

**Primary action**
- Choose a card.

**Authoritative rule**
- Success is accepted.
- Betray is rejected privately by the server for a loyal character. The public table learns nothing from that rejected local attempt.

**Why both cards are shown**
- In the tabletop game, every quest participant performs the same physical card-selection ritual. Rendering only one option to good players is a role tell and is therefore incorrect UX for this adaptation.

**Exit**
- Accepted card → `Card sealed` wait state.

---

## Storyboard 9 — Quest member: evil character

**Player sees and does exactly the same thing as Storyboard 8.**

**Primary action**
- Success or Betray; either is legal.

**Critical anti-tell rule**
- Do not place Betray on a fixed side.
- Do not make one allegiance's hand animate differently.
- Do not label the surface `Evil choice` or expose any role-specific instruction near the cards.

**Exit**
- Accepted card → sealed wait state.

---

## Storyboard 10 — Quest non-member

**Player sees**
- Approved party highlighted.
- `Quest in progress`.
- Anonymous number of cards sealed.

**Primary action**
- None.

**Do not show**
- Quest cards or fake disabled quest choices to a non-member.

**Exit**
- Every quest member submits.

---

## Storyboard 11 — Quest four, 7–10 players

Everything above still applies, plus an unmistakable but compact rule marker:

- Quest IV requires **two Betray/Fail cards** to fail.
- One Betray still results in a successful quest.

The warning belongs on the quest tile and current-action area; it should not become a modal the player must dismiss.

---

## Storyboard 12 — Quest result

**Player sees**
- Success or failure as the dominant result.
- Number of Betray/Fail cards, never who submitted them.
- Anonymous result cards/pile.
- Overall quest track updated.

**Primary action**
- Continue / acknowledge.

**Privacy**
- Result cards must never retain submitter ordering or be visually positioned next to the players who supplied them.

**Exit**
- Everyone acknowledges → next quest, evil victory after three failed quests, or assassination after three successes.

**Follow-up hardening**
- Consider a host recovery/force-advance path after a disconnected player has blocked acknowledgement for a reasonable grace period. It must not be a normal always-visible control.

---

## Storyboard 13 — Assassination: Assassin

**Player sees**
- Three successful quests are already visible.
- `Who is Merlin?`
- Eligible player avatars become selectable.
- Selected target is explicit.

**Primary action**
- Assassinate selected target.

**Guardrails**
- Cannot target self.
- No UI hint may reveal which eligible target is actually Merlin.

**Exit**
- One irreversible target submission → final result.

---

## Storyboard 14 — Assassination: everyone else

**Player sees**
- `The Assassin is choosing`.
- Table remains visible.

**Primary action**
- None.

**Do not show**
- Target selection controls.
- Merlin hints beyond the private knowledge the player already had.

---

## Storyboard 15 — Game over

**Player sees**
- Winning side and reason first.
- All players' true characters now revealed.
- Character names retain good/evil colour treatment.

**Primary action**
- Host: Play again.
- Non-host: wait for host or leave.

**Rematch contract**
- Return to lobby.
- Clear all prior secret roles, votes, quest cards, quest/history state, winner/reason.
- Keep public identity choices unless intentionally changed in the lobby.

---

## Storyboard 16 — Disconnect / step away

**Temporary network loss**
- Show one compact reconnecting notice.
- Seat stays reserved.
- Existing private identity is not exposed to other clients.

**User leaves the active screen intentionally**
- Copy must say `Step away` rather than imply the active seat is being destroyed.
- Returning on the same browser should reconnect to the reserved seat.

**Lobby / finished leave**
- The seat can actually be released.

**Do not do**
- Offer a mid-game replacement join that could inherit a secret seat without an explicit secure handoff design.

---

## Storyboard 17 — Practice game

Practice should teach the exact same interaction model as multiplayer:

- Same reveal flow.
- Same team selection.
- Same voting.
- Same two-card quest hand and randomized card order.
- Same assassination flow.

Bots may make their decisions automatically, but the human's controls must not be simplified in a way that teaches a different game.

---

# Control inventory

## Keep visible/contextual

- Rules and Characters in compact header access.
- Hide/show role once private role has been revealed.
- Current phase's one primary decision.
- Quest/rejection state on the physical table.
- Reconnect notice only while reconnecting.

## Lobby only

- Room code / copy invite.
- Capacity.
- Optional characters.
- Manage players.
- Public avatar customization.
- Start.

## Keep collapsed

- History / vote history.
- Character details.
- Full rules.

## Never add as persistent chrome

- Public chat (voice/in-person discussion is the social layer for this project).
- Individual quest-card history.
- Pending individual votes.
- Public role/allegiance indicators during the game.
- Mid-game settings.
- Mid-game invitation/share CTA.
- A permanent tutorial box covering the playfield.

---

# Audit findings

## Critical — fixed in this pass

### C1. Quest card UI leaked role capability
Previously, good quest members only saw Success while evil members saw Success + Fail. That creates an unnecessary allegiance-dependent interaction. The engine correctly prevented loyal characters from submitting a Fail, but the visible UI did not reproduce the common physical action.

**Resolution:** every quest member now sees the same Success and Betray cards; the server remains authoritative about whether the submitted card is legal.

### C2. Fixed card position could become a behavioural tell
If Success were always left and Betray always right, repeated hand movement could become observable in an in-person game.

**Resolution:** order is independently randomized per player and quest, then kept stable for that choice so the cards do not jump while the player is deciding.

### C3. Quest choice felt detached from the table
The earlier choice was a generic action-panel button pair below the board.

**Resolution:** the two cards are now presented as physical selectable pieces on the felt. The action panel simply directs the player to the table.

## High — fixed in this pass

### H1. Room-code action stayed present during active play
Mid-game joins are rejected, so continuing to advertise a share/copy affordance after the lobby is dead chrome.

**Resolution:** room invitation control is hidden once the game is active.

## Medium — follow-up candidates

### M1. Result acknowledgement can be stalled by a disconnected player
The engine waits for everyone to confirm a result. This is good for ordinary pacing but can deadlock a real game when someone loses their device/network.

**Recommendation:** add a delayed host-only recovery action after a clear grace period; do not expose it during normal operation.

### M2. Result card display should look explicitly mixed
The server only exposes the count of fails and not submitter identity, which is correct. The visual result should also avoid presenting a deterministic order that players might incorrectly interpret as meaningful.

**Recommendation:** render the public result as a shuffled pile/order or an abstract count. This is presentation-only; it must never derive from submitter order.

### M3. Legacy `pawn` wording is rewritten at runtime
The table component currently patches old `pawn` copy in the DOM to say `player`. It works visually but is brittle.

**Recommendation:** replace the source strings in the page and remove the DOM text-rewrite effect in a cleanup pass.

### M4. Active leave semantics can be even clearer
The modal already explains that an active seat remains reserved, but the header icon still reads like a normal leave action.

**Recommendation:** use `Step away` language in the active-game confirmation and reserve `Leave table` for lobby/finished state.

---

# Rules/secrecy checklist

The UI must continue matching these engine contracts:

- 5–10 players and correct quest sizes.
- Strict majority approves a proposed team; ties reject.
- Leadership rotates after rejection.
- Five consecutive rejected proposals → evil wins.
- Only approved quest members submit quest cards.
- Loyal characters may only submit Success.
- Evil characters may submit Success or Betray/Fail.
- Quest IV at 7–10 players requires two Betray/Fail cards to fail.
- Individual quest submissions are never public, including after game end.
- Three failed quests → evil wins.
- Three successful quests → Assassin gets one Merlin target.
- Only after the game finishes are all roles public.

---

# Required post-deploy device pass

This audit is a state-machine/code/storyboard review, not a claim of browser screenshot QA. After deployment, do one real-device pass at roughly 390px and 430px widths and verify:

1. Entry form with keyboard open.
2. 5-player and 10-player lobby seat readability.
3. Every role reveal variant, especially Percival, Merlin, Oberon, and Assassin.
4. Team selection at smallest and largest quest sizes.
5. Vote controls reachable one-handed.
6. Good and evil quest members receive visually identical two-card hands.
7. Success/Betray order differs across repeated players/quests and does not reshuffle while deciding.
8. Cards do not collide with player avatars, quest track, or mobile safe area.
9. Quest IV two-fail warning is obvious but not obstructive.
10. Result, assassination, finish, reconnect, and rematch states.
11. PWA standalone mode with notches/status bars.
12. Reduced-motion and orientation/resize sanity.
