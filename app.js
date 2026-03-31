const dateInput = document.getElementById('date-input');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const results = document.getElementById('results');
const requestedDateEl = document.getElementById('requested-date');
const weekRangeEl = document.getElementById('week-range');
const episodesListEl = document.getElementById('episodes-list');

let scheduleData = null;
let episodesData = null;

function formatDateOnlyUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateForInput(date) {
  return formatDateOnlyUTC(date);
}

function parseDateOnly(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseScheduleYaml(raw) {
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
      endDate: parseDateOnly(dateStr),
      episodeTitles,
    }))
    .filter((entry) => entry.endDate !== null)
    .sort((a, b) => a.endDate - b.endDate);

  return entries;
}

function findWeek(entries, targetDate) {
  for (let i = 0; i < entries.length; i += 1) {
    const current = entries[i];
    const prev = i > 0 ? entries[i - 1] : null;
    const endsOnOrAfterTarget = current.endDate >= targetDate;
    const targetIsAfterPrev = !prev || targetDate > prev.endDate;

    if (endsOnOrAfterTarget && targetIsAfterPrev) {
      return {
        prev,
        current,
      };
    }
  }
  return null;
}

async function loadData() {
  loading.classList.add('show');
  error.classList.remove('show');

  try {
    const ymlResponse = await fetch('schedule.yml');
    if (!ymlResponse.ok) throw new Error('Could not load schedule.yml');
    const ymlText = await ymlResponse.text();
    scheduleData = parseScheduleYaml(ymlText);

    const jsonResponse = await fetch('episodes.json');
    if (!jsonResponse.ok) throw new Error('Could not load episodes.json');
    episodesData = await jsonResponse.json();

    loading.classList.remove('show');
    showMessage(null);
    return true;
  } catch (err) {
    loading.classList.remove('show');
    showMessage(`Error loading data: ${err.message}`);
    return false;
  }
}

function showMessage(msg) {
  if (msg) {
    error.textContent = msg;
    error.classList.add('show');
  } else {
    error.classList.remove('show');
  }
}

function buildEpisodeLookup() {
  const byTitle = new Map();
  const byNormalizedTitle = new Map();

  for (const ep of episodesData) {
    if (!ep || typeof ep.title !== 'string') continue;
    byTitle.set(ep.title, ep.link || null);
    byNormalizedTitle.set(normalizeTitle(ep.title), ep.link || null);
  }

  return { byTitle, byNormalizedTitle };
}

function displayResults(targetDateStr) {
  const targetDate = parseDateOnly(targetDateStr);

  if (!targetDate) {
    showMessage('Invalid date. Use YYYY-MM-DD.');
    results.classList.remove('show');
    return;
  }

  if (scheduleData.length === 0) {
    showMessage('Schedule is empty.');
    results.classList.remove('show');
    return;
  }

  const match = findWeek(scheduleData, targetDate);

  if (!match) {
    showMessage(
      `Date is outside the schedule range. First week: ${scheduleData[0].dateStr}, Last week: ${scheduleData[scheduleData.length - 1].dateStr}`
    );
    results.classList.remove('show');
    return;
  }

  showMessage(null);

  const episodeLookup = buildEpisodeLookup();
  const items = match.current.episodeTitles.map((title) => {
    const direct = episodeLookup.byTitle.get(title);
    const fallback = episodeLookup.byNormalizedTitle.get(normalizeTitle(title));
    return {
      episode: title,
      link: direct ?? fallback ?? null,
    };
  });

  const weekStartStr = match.prev ? match.prev.dateStr : '(start of schedule)';
  requestedDateEl.textContent = `Requested date: ${formatDateOnlyUTC(targetDate)}`;
  weekRangeEl.textContent = `Week ending ${match.current.dateStr}`;

  episodesListEl.innerHTML = items
    .map(
      (item) => `
    <div class="episode-item">
      <div class="episode-name">${escapeHtml(item.episode)}</div>
      <div class="episode-link">
        ${
          item.link
            ? `<a href="${escapeHtml(item.link)}" target="_blank">${escapeHtml(item.link)}</a>`
            : '<span class="no-link">No link available</span>'
        }
      </div>
    </div>
  `
    )
    .join('');

  results.classList.add('show');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

submitBtn.addEventListener('click', () => {
  const dateValue = dateInput.value;
  const targetDate = dateValue
    ? dateValue
    : formatDateForInput(new Date());

  displayResults(targetDate);
});

resetBtn.addEventListener('click', () => {
  dateInput.value = '';
  results.classList.remove('show');
  error.classList.remove('show');
  dateInput.focus();
});

dateInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    submitBtn.click();
  }
});

// Load data on page load
loadData();

// Set today's date as default in the input
window.addEventListener('load', () => {
  const today = formatDateForInput(new Date());
  dateInput.value = today;
});
