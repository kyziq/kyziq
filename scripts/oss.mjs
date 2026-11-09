// Rewrites the recent open source list in README.md from my merged PRs to other people's repos.
// Usage: GH_TOKEN=$(gh auth token) node scripts/oss.mjs
import { readFileSync, writeFileSync } from "node:fs";

const USER = "kyziq";
const SKIP_OWNERS = new Set(["kyziq", "learnifai"]); // my own repos and my startup's
const MIN_STARS = 500; // well-known projects...
const MIN_PRS = 10; // ...or a project I contributed to steadily
const SHOW = 6;

const date = (pr) => pr.pull_request?.merged_at ?? pr.closed_at;
// "docs(tanstack): fix errors" -> "Fix errors"; also drops leading emoji such as gitmoji.
const tidy = (title) => {
  const t = title.replace(/^[^\p{L}\p{N}]+/u, "").replace(/^\w+(\([^)]*\))?!?:\s*/, "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GH_TOKEN}` };
async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} on ${path}`);
  return res.json();
}

const prs = [];
for (let page = 1; ; page++) {
  const { items } = await api(`/search/issues?q=type:pr+author:${USER}+is:merged&per_page=100&page=${page}`);
  prs.push(...items);
  if (items.length < 100) break;
}

const repos = new Map(); // "owner/name" -> my merged PRs there
for (const pr of prs) {
  const name = pr.repository_url.split("/repos/")[1];
  if (SKIP_OWNERS.has(name.split("/")[0].toLowerCase())) continue;
  repos.set(name, [...(repos.get(name) ?? []), pr]);
}

const picked = [];
for (const [name, list] of repos) {
  const { stargazers_count: stars } = await api(`/repos/${name}`);
  if (stars < MIN_STARS && list.length < MIN_PRS) continue;
  const latest = list.reduce((a, b) => (date(b) > date(a) ? b : a));
  picked.push({ name, pr: latest });
}
// An empty result means the API misbehaved; keep the current README rather than wipe the list.
if (picked.length === 0) throw new Error("no contributions found");

// The latest PR from each of the most recently active repos.
const recent = picked.sort((a, b) => date(b.pr).localeCompare(date(a.pr))).slice(0, SHOW);
const month = (iso) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const line = recent
  .map(({ name, pr }) => `- [${name}](${pr.html_url}) · ${tidy(pr.title)} · ${month(date(pr))}`)
  .join("\n");

const readme = new URL("../README.md", import.meta.url);
const text = readFileSync(readme, "utf8");
const block = /<!-- oss:start -->[\s\S]*<!-- oss:end -->/;
if (!block.test(text)) throw new Error("README is missing the oss markers");
writeFileSync(readme, text.replace(block, `<!-- oss:start -->\n${line}\n<!-- oss:end -->`));
console.log(line);
