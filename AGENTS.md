# Working on Avalon

Read `ASSETS.md` and the artwork before changing the visual direction. This project is an unofficial Avalon adaptation with original Arthurian illustrations.

## User priorities

- Prioritize character design, art consistency, visual polish, and simple game UX.
- Work directly in this repository. Do not spawn subagents unless the user explicitly requests them or a task absolutely requires one; they consume the user's usage allowance.
- Preserve original generated art. Add separately named variants when improving an illustration.
- Keep all consumed assets in `public/art`, with their inventory and generation notes in `ASSETS.md`.

## Architecture

- `app/page.tsx`: entry screen, lobby, game board, character guide, private reveals.
- `app/globals.css`: shared teal/gold theme, responsive layouts, card presentation.
- `lib/game/roles.ts`: character definitions, artwork-cell mapping, quest sizes.
- `lib/game/engine.ts`: authoritative game transitions and per-player views.
- `lib/game/store.ts`: SQLite storage and authentication using hashed seat tokens.
- `app/api/game/route.ts`: bounded same-origin JSON endpoint.
- `tests`: rules, secrecy, persistence, and multi-client API smoke checks.

Use Node 24 or newer, `npm ci`, then `npm run dev` for local development. For a production check use `npm run build` and `npm start`. This is a Node application with persistent SQLite, not a static site.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for relevant code changes. Run `node tests/api-smoke.mjs` against a running server when changing game or API behavior. Lint excludes unchanged generated UI primitives.

Never expose other players' roles before the end of the game, pending votes, individual quest cards, seat tokens, or the private database. Do not commit `.data`, environment secrets, runtime output, or `node_modules`.

Do not imply that UI screenshots, browser interactions, or WebMCP have been tested unless those checks were actually performed. Preserve the separate-screen assumption for secret identities. Voice discussion happens outside this application.
