# Mobile lobby UX fix

Real-device production testing identified three related issues that this branch fixes:

- Character atlas cells were stretched vertically in the small-screen character detail layout. Mobile detail cards now preserve each square atlas cell and stack artwork above the text.
- Standard multiplayer rooms no longer ask the host to choose a player count. Rooms accept up to 10 players, the lobby/table expands with joined players, and the actual joined count determines allegiance and quest rules when the game starts. Optional roles are constrained to combinations that fit the current lobby size.
- The room-code control copies the full `?room=CODE` invitation URL. Opening that URL enters a dedicated invite state with the room already selected, so the invitee only needs to enter their name and join.
