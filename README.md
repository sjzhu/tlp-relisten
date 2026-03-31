# easy-tlp-tracker

Find episodes for any week in **The Letters Page** relisten schedule.

Enter a date (or leave blank for today), and the app displays all episodes scheduled for that week along with their direct links from `episodes.json`.

## Features

- **No backend required** — runs entirely in the browser
- **Works on GitHub Pages** — static files only
- **Responsive design** — works on mobile and desktop
- **Handles edge cases** — validates dates, matches weeks correctly

## Development

### Run locally

For local development with live file changes, use Python's built-in server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Alternatively, use Node's simple HTTP server:

```bash
npx http-server
```

### Server (Node.js)

If you prefer the backend API approach, the `server.js` file provides a REST endpoint:

```bash
npm start
```

Endpoint: `GET http://localhost:3000/episodes?date=YYYY-MM-DD` (date optional)

## Deploy to GitHub Pages

1. Push your repository to GitHub
2. Go to **Settings** → **Pages**
3. Under "Build and deployment", select:
   - **Source**: Deploy from a branch
   - **Branch**: `main` (or your default branch)
4. Save — your app will be live at `https://<username>.github.io/<repo-name>/`

That's it! GitHub Pages will serve `index.html` automatically.

## How it works

1. Loads `schedule.yml` and `episodes.json` from the static files
2. Parses the YAML schedule — dates represent **week-end dates**
3. For a given date, finds the earliest week that ends on or after that date
4. Looks up episode links from `episodes.json`
5. Displays results in a clean, interactive UI

### Schedule semantics

Dates in `schedule.yml` represent the **end** of each week:

```yaml
2026-03-31:
  - Interlude 1 - The Multiverse and More
  - Episode 2 - The Wraith
```

This means the week containing March 24–31, 2026 includes those two episodes. A query for any date from March 24 to March 31 will return this week's episodes.

## Files

- `index.html` — HTML + CSS for the UI
- `app.js` — Client-side logic for parsing and lookup
- `schedule.yml` — Weekly episode schedule
- `episodes.json` — Episode metadata with links
- `server.js` — Optional Node.js backend API (for reference)