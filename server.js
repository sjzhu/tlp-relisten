const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const SCHEDULE_PATH = path.join(ROOT, 'schedule.yml');
const EPISODES_PATH = path.join(ROOT, 'episodes.json');

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function parseDateOnly(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));

  // Guard against invalid calendar dates like 2026-02-31.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateOnlyUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function loadEpisodes() {
  const raw = fs.readFileSync(EPISODES_PATH, 'utf8');
  const episodes = JSON.parse(raw);
  const byTitle = new Map();
  const byNormalizedTitle = new Map();

  for (const ep of episodes) {
    if (!ep || typeof ep.title !== 'string') continue;
    byTitle.set(ep.title, ep.link || null);
    byNormalizedTitle.set(normalizeTitle(ep.title), ep.link || null);
  }

  return { byTitle, byNormalizedTitle };
}

function parseScheduleYaml() {
  const raw = fs.readFileSync(SCHEDULE_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  const schedule = new Map();
  let currentDate = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const weekMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}):$/);
    if (weekMatch) {
      currentDate = weekMatch[1];
      if (!schedule.has(currentDate)) {
        schedule.set(currentDate, []);
      }
      continue;
    }

    const episodeMatch = line.match(/^\s*-\s+(.+)$/);
    if (episodeMatch && currentDate) {
      schedule.get(currentDate).push(episodeMatch[1].trim());
    }
  }

  const entries = Array.from(schedule.entries())
    .map(([dateStr, episodeTitles]) => ({
      dateStr,
      startDate: parseDateOnly(dateStr),
      episodeTitles,
    }))
    .filter((entry) => entry.startDate !== null)
    .sort((a, b) => a.startDate - b.startDate);

  return entries;
}

function findWeek(entries, targetDate) {
  for (let i = 0; i < entries.length; i += 1) {
    const current = entries[i];
    const next = entries[i + 1];
    const startsBeforeOrOnTarget = current.startDate <= targetDate;
    const targetIsBeforeNext = !next || targetDate < next.startDate;

    if (startsBeforeOrOnTarget && targetIsBeforeNext) {
      return {
        current,
        next,
      };
    }
  }
  return null;
}

function buildResponse(dateParam) {
  const scheduleEntries = parseScheduleYaml();
  const episodes = loadEpisodes();

  if (scheduleEntries.length === 0) {
    return {
      status: 500,
      body: { error: 'schedule.yml did not contain any valid weeks.' },
    };
  }

  const targetDate = dateParam
    ? parseDateOnly(dateParam)
    : parseDateOnly(formatDateOnlyUTC(new Date()));

  if (!targetDate) {
    return {
      status: 400,
      body: { error: 'Invalid date. Use YYYY-MM-DD.' },
    };
  }

  const match = findWeek(scheduleEntries, targetDate);

  if (!match) {
    return {
      status: 404,
      body: {
        error: 'Date is outside the schedule range.',
        requestedDate: formatDateOnlyUTC(targetDate),
        firstWeek: scheduleEntries[0].dateStr,
        lastWeek: scheduleEntries[scheduleEntries.length - 1].dateStr,
      },
    };
  }

  const items = match.current.episodeTitles.map((title) => {
    const direct = episodes.byTitle.get(title);
    const fallback = episodes.byNormalizedTitle.get(normalizeTitle(title));
    return {
      episode: title,
      link: direct ?? fallback ?? null,
    };
  });

  return {
    status: 200,
    body: {
      requestedDate: formatDateOnlyUTC(targetDate),
      weekStart: match.current.dateStr,
      weekEndExclusive: match.next ? match.next.dateStr : null,
      episodes: items,
    },
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Only GET is supported.' });
  }

  if (url.pathname !== '/' && url.pathname !== '/episodes') {
    return sendJson(res, 404, { error: 'Not found.' });
  }

  const dateParam = url.searchParams.get('date');
  const result = buildResponse(dateParam);
  return sendJson(res, result.status, result.body);
});

server.listen(PORT, () => {
  console.log(`easy-tlp-tracker listening on http://localhost:${PORT}`);
});