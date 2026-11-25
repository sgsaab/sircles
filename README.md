# Sircles

Map out your social life!

This project handles the following:

- Skippable onboarding based on Dunbar's layers, revealing the map one ring at a time
- A 2D map with you at the center, where closer people sit closer together
- Romantic relationships, current and ended
- Automatic friend group clustering, editable as well
- People can belong to more than one group; groups can be created and edited
- Center on anyone to see the map from their point of view
- Shift-click to define a relationship or select and drag a group together
- Move, drag, and relax to place or release people
- Shuffle setup to explore a fresh formula-aligned layout without pinning people
- Text-entry relationship tiers (including decimals, with colors assigned by whole-number band), plus romantic and ended relationship buttons
- Guided setup reveals the social map one ring at a time
- Appearance controls for tier colors, ring-number visibility, name size, line thickness, and ring spacing
- Hide relationship lines or anonymize map labels (while keeping You visible)
- Return home and continue a saved map
- Right-click the map for quick actions such as fit, relax, and reset groups
- Resizable side panel (expandable to full screen): People, Groups, Appearance, Data
- CSV import/export (single file), plus autosave to `localStorage`.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npm start
```

The only runtime dependency is [d3](https://d3js.org/), loaded from cdnjs.

## Project structure

- `index.html` contains the page structure.
- `favicon.svg` contains the five-ring red-to-blue app icon.
- `styles.css` contains the app styles.
- `app.js` contains map layout, rendering, and pointer interactions.
- `data.js` contains CSV import/export and example data.
- `ui.js` contains the side panel, appearance controls, graph menu, and onboarding.

## Tests

The tests run the real `index.html` in jsdom (with a stub canvas) and cover onboarding, linking, fractional tiers, group dragging, appearance controls, grouping, centering, drawing helpers, and CSV round-trips.

```bash
npm install
npm run format
npm test
```

## CSV format

One file, header `kind,id,name,tier,a,b,x,y,group,color,groups`. Row kinds:

| kind       | fields used                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tier`     | `id` = tier number, `name` = label, `color` = optional line color                                                                                       |
| `gradient` | `id` = `a` (closest) or `b` (furthest), `color` = gradient endpoint                                                                                     |
| `group`    | `id`, `name`, `color` (manual groups)                                                                                                                   |
| `person`   | `id`, `name`, `tier` = tier to You (positive number, including decimals, `heart`, `broken` or blank), `x`/`y` = fixed position (optional), `group` = primary manual group id or `-` for none, `groups` = `|`-separated additional group ids |
| `link`     | `a`, `b` = person ids (or names), `tier` = positive number (including decimals), `heart` or `broken` (`0`)                                                                            |

Older exports (without `tier` rows) still import: `0` is read as a romantic partner and `6` as broken up.

## Deploy to GitHub Pages

The included workflow (`.github/workflows/pages.yml`) runs the tests and deploys all app files on every push to `main`. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

## License

No license has been selected for this project.
