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

The frontend displays each cell by clipping and positioning the shared image with CSS. Public player pawns use neutral Lucide symbols and have no relationship to secret roles. Lucide icons use the library's ISC license. UI ornaments and the crown favicon are simple vector geometry.

## Tabletop update — September 6, 2026

- `public/art/tabletop.png`: original overhead walnut table, teal felt and brass rim; used behind the tappable player pawns in every lobby and game phase.
- `public/art/quest-cards.png`: two original chalice illustrations in equal horizontal cells; left Success, right Fail. Used for playable quest cards and revealed results.

Generated with the built-in OpenAI image tool, without subagents. Both outputs were visually inspected. These are newly generated assets, not extractions from the reference rulebook. Existing portrait art is preserved. Public pawn colors depend only on seat order, never secret allegiance. Leader and team coins, vote symbols and pawns use the existing Lucide icon library with CSS material treatments. Labels remain accessible HTML.

### Tabletop generation prompt

Use case: stylized-concept. Asset type: background for a playable mobile medieval board game. Create an original luxurious physical tabletop surface viewed perfectly straight overhead, portrait 1024x1536 composition. Dark warm walnut table fills edges; centered tall oval muted deep teal woven felt playmat takes 92 percent width and 94 percent height, fine aged brass double rim with subtle original ornamental flourishes only at top and bottom, soft natural shadows, tactile fibers and wood grain, warm subdued lighting. Entire interior is empty negative space, uniformly dark and calm for legible interactive game pieces overlaid in code. No cards, no coins, no pawns, no words, no letters, no numbers, no logos. Sophisticated realistic board-game product photography, not busy fantasy illustration. Original materials and ornament, do not copy any published board game.

### Quest card generation prompt

Use case: stylized-concept. Asset type: original digital board-game quest card illustration atlas. Landscape canvas exactly two equally sized portrait illustrations side by side, no gutter, each image fills its half to the edges. LEFT HALF: a beautiful upright antique gold chalice with moonlit clear water, elegant original knotwork, dark muted teal aged parchment background, hopeful soft light. RIGHT HALF: a different cracked tarnished chalice tipped slightly with dark red wine spilling, restrained ominous crimson and charcoal aged parchment background. Both objects centered in their half, occupy central 65 percent height and 60 percent width; generous quiet edges for HTML card border and label overlay. Hand-painted premium Arthurian fantasy board-game art, tactile aged ink and gold leaf, realistic and subtle, coherent restrained palette, strong readable silhouette at small size. No text, no letters, no numbers, no logos, no watermark, no external drop shadow, no copied artwork or published game designs.

## PWA icon set — September 6, 2026

- `public/icons/icon-192.png`: 192 × 192 install icon.
- `public/icons/icon-512.png`: 512 × 512 install icon.
- `public/icons/icon-maskable-512.png`: 512 × 512 maskable Android launcher icon with extra safe-zone padding.
- `public/icons/apple-touch-icon.png`: 180 × 180 iOS home-screen icon.

These PNGs are programmatically rendered derivatives of the repository's existing original crown favicon geometry and teal/gold palette. They add no third-party artwork and are used only for operating-system launcher/install surfaces.
