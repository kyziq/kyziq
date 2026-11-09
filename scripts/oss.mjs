// Rewrites the open source line in README.md from my merged PRs to other people's repos.
// Usage: GH_TOKEN=$(gh auth token) node scripts/oss.mjs
import { readFileSync, writeFileSync } from "node:fs";

const USER = "kyziq";
const SKIP_OWNERS = new Set(["kyziq", "learnifai"]); // my own repos and my startup's
const MIN_STARS = 500; // well-known projects...
const MIN_PRS = 10; // ...or a project I contributed to steadily

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

const repos = new Map(); // "owner/name" -> PR urls
for (const pr of prs) {
  const name = pr.repository_url.split("/repos/")[1];
  if (SKIP_OWNERS.has(name.split("/")[0].toLowerCase())) continue;
  repos.set(name, [...(repos.get(name) ?? []), pr.html_url]);
}

const picked = [];
for (const [name, urls] of repos) {
  const { stargazers_count: stars } = await api(`/repos/${name}`);
  if (stars >= MIN_STARS || urls.length >= MIN_PRS) picked.push({ name, urls, stars });
}
// An empty result means the API misbehaved; keep the current README rather than wipe the line.
if (picked.length === 0) throw new Error("no contributions found");
picked.sort((a, b) => b.stars - a.stars);

const link = ({ name, urls }) =>
  urls.length === 1
    ? `[${name}](${urls[0]})`
    : `[${name}](https://github.com/${name}/pulls?q=is%3Apr+author%3A${USER}+is%3Amerged)`;
const list = picked.map(link);
const line = `Merged into ${list.slice(0, -1).join(", ")} and ${list.at(-1)}.`;

const readme = new URL("../README.md", import.meta.url);
const text = readFileSync(readme, "utf8");
const block = /<!-- oss:start -->[\s\S]*<!-- oss:end -->/;
if (!block.test(text)) throw new Error("README is missing the oss markers");
writeFileSync(readme, text.replace(block, `<!-- oss:start -->\n${line}\n<!-- oss:end -->`));
console.log(`${picked.length} repos: ${picked.map((p) => p.name).join(", ")}`);
