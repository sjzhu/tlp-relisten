# easy-tlp-tracker

Very simple HTTP API that returns episodes for the schedule week containing:

- today (default), or
- a provided `date` query parameter in `YYYY-MM-DD` format.

For each episode in that week, it returns:

- episode name from `schedule.yml`
- `link` from `episodes.json` (or `null` if no match is found)

## Run

```bash
npm start
```

The server listens on:

```text
http://localhost:3000
```

You can override the port:

```bash
PORT=4000 npm start
```

## Endpoint

`GET /episodes`

Optional query parameter:

- `date=YYYY-MM-DD`

## Examples

Default (uses current date):

```bash
curl -s "http://localhost:3000/episodes"
```

With explicit date:

```bash
curl -s "http://localhost:3000/episodes?date=2026-03-31"
```

Invalid date:

```bash
curl -s -i "http://localhost:3000/episodes?date=bad-date"
```

## Response shape (200)

```json
{
  "requestedDate": "2026-03-31",
  "weekStart": "2026-03-31",
  "weekEndExclusive": "2026-04-07",
  "episodes": [
    {
      "episode": "Interlude 1 - The Multiverse and More",
      "link": "https://theletterspage.libsyn.com/interlude-1-the-multiverse-and-more"
    },
    {
      "episode": "Episode 2 - The Wraith",
      "link": "https://theletterspage.libsyn.com/episode-3-the-wraith"
    }
  ]
}
```

## Error responses

Invalid date format (`400`):

```json
{
  "error": "Invalid date. Use YYYY-MM-DD."
}
```

Out-of-range date (`404`):

```json
{
  "error": "Date is outside the schedule range.",
  "requestedDate": "2025-01-01",
  "firstWeek": "2026-03-24",
  "lastWeek": "2028-09-12"
}
```