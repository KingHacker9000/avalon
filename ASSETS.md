# Original asset inventory

| File                        | Dimensions | Use                                        |
| --------------------------- | ---------- | ------------------------------------------ |
| `public/art/camelot.png`    | 1672 × 941 | Moonlit Camelot game entry backdrop        |
| `public/art/characters.png` | 1774 × 887 | Eight character portraits in a 4 × 2 sheet |
| `public/favicon.svg`        | Vector     | Crown favicon                              |

The two paintings were created using OpenAI's built-in image generation tool for this project on September 6, 2026 and visually inspected before integration. They are original interpretations of Arthurian characters, not reproductions of the commercial game's illustrations.

## Visual direction

Cinematic, hand-painted Arthurian fantasy with deep teal shadows, moonlit stone, restrained antique gold, expressive faces, and finely detailed clothing and armor. No text is embedded in the paintings; all interface labels remain real HTML text.

The landscape places Camelot on the right, with lake, mist, and dark open space to the left for the host/join controls.

The portrait sheet uses equal cells with no gutters. Reading left to right:

1. Merlin — silver beard, blue robes, magical staff.
2. Percival — young Black knight, ornate gold armor.
3. Loyal Servant — auburn-haired female knight, teal cloak.
4. Assassin — masked rogue, crimson hood.
5. Morgana — raven-haired sorceress, amethyst and gold.
6. Mordred — crowned dark king, black armor.
7. Oberon — wild fae, antler crown.
8. Minion of Mordred — scarred, armored warrior.

The frontend displays each cell by clipping and positioning the shared image with CSS. Public player avatars use neutral Lucide symbols and have no relationship to secret roles. Lucide icons use the library's ISC license. UI ornaments and the crown favicon are simple vector geometry.
