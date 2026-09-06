# Validation — September 6, 2026

- Original Camelot landscape and eight-character artwork inspected before integration.
- Native Windows Node 24: all 22 rules, secrecy, and process-restart persistence tests passed.
- TypeScript checks and application lint passed. Unmodified generated UI primitives are excluded from lint.
- Production build passed on Windows and WSL.
- Five independent authenticated clients completed a full game against the Windows production server, including concurrent votes and quest cards, assassination, rematch, and practice.
- Cross-origin requests, invalid seat tokens, oversized requests, and unauthorized actions were rejected.
- Home page and all artwork returned HTTP 200. The private database was not publicly served.
- `npm ci` completed from the lockfile with zero reported vulnerabilities.

The app uses port 4173 because another local application already occupied port 3000. Run `Start Avalon.cmd` or `npm start` to serve it.

Browser interaction and screenshot QA have not been performed. The optional WebMCP rules-opening tool is feature-detected but has not been validated with a supporting browser context. These are remaining verification gaps, not checks claimed as passed.

This repository contains the self-hosted application. It has not been deployed to a public game URL. Internet multiplayer requires a reachable HTTPS host; home-network play can use the host computer's LAN address.
