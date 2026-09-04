import { mkdir, writeFile } from 'node:fs/promises';

const username = process.env.GITHUB_USERNAME || 'QuangVuDuc006';
const token = process.env.GITHUB_TOKEN;
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'profile-metrics-generator' };
if (token) headers.Authorization = `Bearer ${token}`;

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

const [user, repos, events] = await Promise.all([
  github(`/users/${username}`), github(`/users/${username}/repos?per_page=100&sort=updated`), github(`/users/${username}/events/public?per_page=30`),
]);
const languages = new Map();
for (const repo of repos.filter((repo) => !repo.fork).slice(0, 30)) {
  const data = await github(`/repos/${username}/${repo.name}/languages`);
  for (const [name, bytes] of Object.entries(data)) languages.set(name, (languages.get(name) || 0) + bytes);
}
const topLanguages = [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
const eventCounts = events.reduce((counts, event) => { counts[event.type] = (counts[event.type] || 0) + 1; return counts; }, {});
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, value, size = 14, fill = '#cbd5e1', weight = 400) => `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial,sans-serif" font-size="${size}px" font-weight="${weight}">${esc(value)}</text>`;
await mkdir('assets', { recursive: true });
const metricRows = [['Public repositories', user.public_repos], ['Followers', user.followers], ['Following', user.following], ['Recent public events', events.length]];
const languageLine = topLanguages.length ? topLanguages.map(([name, bytes]) => `${name} (${Math.round(bytes / 1024)} KB)`).join('  |  ') : 'No language data available';
const metricsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="205" viewBox="0 0 700 205"><rect width="700" height="205" rx="10" fill="#0f172a"/><rect x="1" y="1" width="698" height="203" rx="9" fill="none" stroke="#334155"/><circle cx="36" cy="35" r="8" fill="#14b8a6"/>${text(58, 41, 'GitHub snapshot', 20, '#f8fafc', 700)}${metricRows.map(([label, value], i) => `${text(34 + (i % 2) * 330, 84 + Math.floor(i / 2) * 45, label, 12, '#94a3b8')}${text(34 + (i % 2) * 330, 106 + Math.floor(i / 2) * 45, value, 22, '#f8fafc', 700)}`).join('')}${text(34, 190, `Top languages: ${languageLine}`, 11, '#94a3b8')}</svg>`;
const eventLine = Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, count]) => `${name.replace('Event', '')}: ${count}`).join('  |  ') || 'No recent public activity';
const activitySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="130" viewBox="0 0 700 130"><rect width="700" height="130" rx="10" fill="#111827"/><rect x="1" y="1" width="698" height="128" rx="9" fill="none" stroke="#334155"/>${text(34, 40, 'Recent public activity', 18, '#f8fafc', 700)}${text(34, 70, `Last ${events.length} events from the GitHub public events API`, 12, '#94a3b8')}${text(34, 103, eventLine, 13, '#5eead4', 600)}</svg>`;
await writeFile('assets/metrics.svg', metricsSvg);
await writeFile('assets/activity.svg', activitySvg);
