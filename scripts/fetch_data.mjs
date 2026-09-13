// fetch_data.mjs
// Pulls the ENTIRE dataset for your API key: all listings, rentals, and projects.
// Usage:  IVY_API_KEY=IVY26-XXXX node scripts/fetch_data.mjs
//
// Why one script for all three: the assignment's own advice is "pull the whole
// dataset down early... then stop reading it one record at a time." Everything
// downstream (the 10 answers, the findings) should be analysis on this local
// dump, not live calls — faster to iterate, and you're not re-hitting the API
// every time you tweak a hypothesis.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.IVY_BASE_URL || "https://solve.ivy.homes";
const API_KEY = process.env.IVY_API_KEY;
const LIMIT = 50; // documented max is 200, but the server caps actual page size at 50 regardless

if (!API_KEY) {
  console.error("Set IVY_API_KEY env var first.");
  process.exit(1);
}

const DATA_DIR = path.join(process.cwd(), "data");

const EMAIL = process.env.IVY_EMAIL || "demo1@ivy.homes";
const PASSWORD = process.env.IVY_PASSWORD;

if (!PASSWORD) {
  console.error("Set IVY_PASSWORD env var (the password from your assignment email).");
  process.exit(1);
}

let TOKEN = null;

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`login failed -> ${res.status}: ${body}`);
  }
  const data = await res.json();
  console.log("Raw login response:", JSON.stringify(data, null, 2));
  TOKEN = data.access_token;
  console.log(`Logged in as ${EMAIL}, token expires_in=${data.expires_in}s`);
}

async function fetchPage(endpoint, offset) {
  const url = `${BASE_URL}${endpoint}?offset=${offset}&limit=${LIMIT}`;
  const res = await fetch(url, {
    headers: { "X-API-Key": API_KEY, Authorization: `Bearer ${TOKEN}` },
  });
  if (res.status === 429) {
    console.warn(`429 on ${endpoint} offset ${offset}, waiting 2s...`);
    await new Promise((r) => setTimeout(r, 2000));
    return fetchPage(endpoint, offset);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${endpoint} offset ${offset} -> ${res.status}: ${body}`);
  }
  return res.json();
}

async function fetchAll(endpoint, label, idField) {
  console.log(`Fetching ${label} from ${endpoint} ...`);
  const first = await fetchPage(endpoint, 0);
  const claimedTotal = first.total;
  const results = [...first.results];
  console.log(`  claimed total=${claimedTotal}, page_size returned=${first.results.length}`);

  // Do NOT stop when results.length reaches claimedTotal — total has been
  // shown to undercount. Keep requesting until the server itself returns an
  // empty page, which is the only trustworthy end-of-data signal.
  let offset = first.results.length;
  const SAFETY_CAP = claimedTotal * 3 + 500; // generous upper bound so a bug can't loop forever
  while (offset < SAFETY_CAP) {
    const data = await fetchPage(endpoint, offset);
    if (!data.results || data.results.length === 0) {
      console.log(`\n  offset ${offset} returned 0 results — reached the real end.`);
      break;
    }
    results.push(...data.results);
    offset += data.results.length;
    process.stdout.write(`  fetched offset ${offset}, running total ${results.length} (claimed total was ${claimedTotal})\r`);
  }
  if (offset >= SAFETY_CAP) {
    console.warn(`  HIT SAFETY CAP at offset ${offset} without an empty page — something's off, stopped early. Investigate before trusting this count.`);
  }
  console.log(`\n  got ${results.length} raw records (server's total field claimed ${claimedTotal})`);

  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    const id = r[idField];
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(r);
  }
  if (deduped.length !== results.length) {
    console.warn(`  Removed ${results.length - deduped.length} duplicate ${idField}s.`);
  }
  console.log(`  FINAL unique count (this is the real retrievable count): ${deduped.length}`);
  if (deduped.length !== claimedTotal) {
    console.warn(`  Differs from claimed total (${claimedTotal}) by ${deduped.length - claimedTotal} — this is the pagination finding, already logged.`);
  }
  return { total: claimedTotal, results: deduped };
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const health = await fetch(`${BASE_URL}/health`).then((r) => r.json());
  console.log("Health check:", health);

  await login();

  const listings = await fetchAll("/v1/listings", "listings", "listing_id");
  await writeFile(
    path.join(DATA_DIR, "listings.json"),
    JSON.stringify(listings.results, null, 2)
  );

  const rentals = await fetchAll("/v1/rentals", "rentals", "listing_id");
  await writeFile(
    path.join(DATA_DIR, "rentals.json"),
    JSON.stringify(rentals.results, null, 2)
  );

  const projects = await fetchAll("/v1/projects", "projects", "project_id");
  await writeFile(
    path.join(DATA_DIR, "projects.json"),
    JSON.stringify(projects.results, null, 2)
  );

  console.log("\nDone. Files written to ./data/*.json");
  console.log(
    `Totals — listings: ${listings.results.length}, rentals: ${rentals.results.length}, projects: ${projects.results.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
