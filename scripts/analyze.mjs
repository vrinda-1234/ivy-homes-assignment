// analyze.mjs
// Run AFTER fetch_data.mjs. Reads ./data/*.json and works through the 10
// questions. This is deliberately NOT "print one number and trust it" —
// several of these are judgment calls, so the script prints its reasoning
// and the flagged records so you can eyeball them before locking an answer.
// That eyeballing is also literally what you'll write up in the README.
//
// Usage: node scripts/analyze.mjs

import { readFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const REFERENCE = new Date("2026-09-10T00:00:00+05:30");
const YOUR_LOCALITY = (process.env.IVY_LOCALITY || "golf course road").toLowerCase();

async function load(file) {
  return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
}

function section(title) {
  console.log("\n" + "=".repeat(70) + `\n${title}\n` + "=".repeat(70));
}

async function main() {
  const listings = await load("listings.json");
  const rentals = await load("rentals.json");
  const projects = await load("projects.json");

  // --- Field inventory first. The docs' sample object may not be the whole
  // shape — is_live is referenced by Q3/Q6 but isn't in the sample listing
  // object in API_REFERENCE.md, so the API returns fields the docs never
  // mention. Print every key you actually got, on record 0, before assuming
  // anything.
  section("0. Field inventory (compare against API_REFERENCE.md's sample)");
  console.log("Listing keys:", Object.keys(listings[0] || {}));
  console.log("Rental keys:", Object.keys(rentals[0] || {}));
  console.log("Project keys:", Object.keys(projects[0] || {}));

  // --- Q1: total_listing_records
  section("Q1 total_listing_records");
  console.log(listings.length);

  // --- Q2: unique_properties
  // Hypothesis: the same physical property gets listed by more than one
  // portal/agent (different listing_id, different website), so grouping by
  // a fingerprint of things that don't change per-listing (location +
  // physical attributes) should collapse duplicates. Rounding lat/long
  // guards against tiny float differences between sources.
  section("Q2 unique_properties (dedup by location + physical attributes)");
  function propertyFingerprint(l) {
    const lat = l.latitude != null ? l.latitude.toFixed(3) : "?"; // ~110m tolerance, was 4dp (~11m, too strict across portals)
    const lon = l.longitude != null ? l.longitude.toFixed(3) : "?";
    const name = (l.apartment_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const areaBucket = l.carpet_area != null ? Math.round(l.carpet_area / 20) * 20 : "?"; // bucket to nearest 20 sqft, portals round differently
    return [lat, lon, l.bedroom, areaBucket, name].join("|");
  }
  const propGroups = new Map();
  for (const l of listings) {
    const fp = propertyFingerprint(l);
    if (!propGroups.has(fp)) propGroups.set(fp, []);
    propGroups.get(fp).push(l.listing_id);
  }
  const dupGroups = [...propGroups.values()].filter((g) => g.length > 1);
  console.log(`Distinct fingerprints: ${propGroups.size} (out of ${listings.length} records)`);
  console.log(`Groups with >1 listing (likely same property, multiple portals): ${dupGroups.length}`);
  console.log("Sample duplicate groups (inspect these manually):");
  console.log(dupGroups.slice(0, 5));

  // --- Q3: active_listings
  section("Q3 active_listings (is_live === true)");
  const active = listings.filter((l) => l.is_live === true);
  const inactive = listings.filter((l) => l.is_live === false);
  console.log(`is_live true: ${active.length}`);
  console.log(`is_live false: ${inactive.length}`);
  console.log(`is_live missing/other: ${listings.length - listings.filter((l) => typeof l.is_live === "boolean").length}`);
  console.log(
    "NOTE: docs claim /v1/listings only returns ACTIVE listings — if is_live=false shows up at all, that's a completeness finding."
  );
  console.log("Sample is_live=false listing_ids (evidence for the finding):", inactive.slice(0, 20).map((l) => l.listing_id));

  // --- Q4: corrupt_listing_ids — records describing something impossible
  section("Q4 corrupt_listing_ids candidates (physically impossible records)");
  const corruptFlags = [];
  for (const l of listings) {
    const reasons = [];
    // bedroom<=0 is only impossible for non-plot property types — a plot is
    // land, it legitimately has 0 bedrooms. Confirmed via property_type
    // breakdown: 103 of 109 "bedroom<=0" flags were plots.
    if (l.bedroom != null && l.bedroom <= 0 && l.property_type !== "plot") {
      reasons.push(`bedroom <= 0 on a non-plot (${l.property_type})`);
    }
    if (l.carpet_area != null && l.super_built_up_area != null && l.carpet_area > l.super_built_up_area) {
      reasons.push("carpet_area > super_built_up_area");
    }
    if (l.floor != null && l.total_floors != null && l.floor > l.total_floors) {
      reasons.push("floor > total_floors");
    }
    if (l.price != null && l.price <= 0) reasons.push("price <= 0");
    if (l.carpet_area != null && l.carpet_area <= 0) reasons.push("carpet_area <= 0");
    if (l.bathroom != null && l.bedroom != null && l.bathroom > l.bedroom + 3) {
      reasons.push("bathroom implausibly high vs bedroom");
    }
    if (
      l.latitude != null &&
      l.longitude != null &&
      (l.latitude < 6 || l.latitude > 37 || l.longitude < 68 || l.longitude > 97)
    ) {
      reasons.push("lat/long outside India");
    }
    if (reasons.length) corruptFlags.push({ listing_id: l.listing_id, reasons });
  }
  console.log(`Flagged (after excluding plots from the bedroom rule): ${corruptFlags.length}`);
  console.log(corruptFlags);
  console.log(
    "This should now be a SMALL list — matches the brief's 'a small number of listing records'. Sanity check each one by hand before finalizing."
  );

  // --- Q5: total_monthly_rent in assigned locality
  section(`Q5 total_monthly_rent (locality = "${YOUR_LOCALITY}")`);
  const localityRentals = rentals.filter((r) => (r.locality || "").toLowerCase() === YOUR_LOCALITY);
  console.log(`Matching rentals: ${localityRentals.length}`);
  const totalRent = localityRentals.reduce((sum, r) => sum + (r.price || 0), 0);
  console.log(`Sum of price: ${totalRent}`);
  console.log(
    "Double-check: confirm 'price' on a rental really is monthly rent and not deposit — and confirm locality strings match exactly (case, spelling, trailing space)."
  );

  // --- Q6: avg_price_per_sqft_2bhk, excluding corrupt (Q4) and fake (Q9) ids
  section("Q6 avg_price_per_sqft_2bhk (is_live=true, bedroom=2, excluding Q4/Q9)");
  const corruptIds = new Set(corruptFlags.map((f) => f.listing_id));
  // fakeIds computed below in Q9 — see combined calc after that section.

  // --- Q7: costliest_project
  section("Q7 costliest_project");
  const sortedByMax = [...projects].sort((a, b) => b.price_max - a.price_max);
  console.log("Top 10 price_max values (checking for a units problem — real rupee prices should be big integers like 89000000, not small decimals):");
  console.log(sortedByMax.slice(0, 10).map((p) => ({ project_id: p.project_id, price_min: p.price_min, price_max: p.price_max })));
  const costliest = sortedByMax[0];
  console.log("\nRaw costliest:", { project_id: costliest.project_id, price_max_inr: costliest.price_max });
  console.log(
    "If these look like crores (small decimals, e.g. 98.9) rather than rupees, the real price_max_inr = price_max * 10,000,000."
  );
  const sampleListingInProject = listings.find((l) => l.project_id === costliest.project_id);
  console.log(
    `\nCross-check (single sample): a listing inside ${costliest.project_id} has price=${sampleListingInProject?.price} rupees.`
  );
  const allListingsInProject = listings.filter((l) => l.project_id === costliest.project_id);
  const projPrices = allListingsInProject.map((l) => l.price).filter((p) => p > 0);
  console.log(
    `\nFULL check: ${allListingsInProject.length} listings under ${costliest.project_id}. Price range among them: min=${Math.min(...projPrices)}, max=${Math.max(...projPrices)}.`
  );
  console.log(`Project's documented price_min/price_max: ${costliest.price_min} / ${costliest.price_max}`);
  console.log(`  If ×1e7 (crores):  ${costliest.price_min * 1e7} / ${costliest.price_max * 1e7}`);
  console.log(`  If ×1e5 (lakhs):   ${costliest.price_min * 1e5} / ${costliest.price_max * 1e5}`);
  console.log(
    "Whichever scale makes the listings' actual min/max fall INSIDE (or close to) the project's documented range is the real conversion. If NEITHER fits well, the project-level price fields may just be inconsistent with /v1/listings entirely (a 'consistency' category finding) rather than a simple unit multiplier."
  );
  console.log(`CONVERTED answer if crore-confirmed: price_max_inr = ${Math.round(costliest.price_max * 1e7)}`);

  // n=4 is thin. Repeat the check on the project with the MOST listings for
  // a more reliable read, and on the top 5 projects by listing count.
  const listingCountByProject = new Map();
  for (const l of listings) {
    if (!l.project_id) continue;
    listingCountByProject.set(l.project_id, (listingCountByProject.get(l.project_id) || 0) + 1);
  }
  const biggestProjects = [...listingCountByProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log("\n--- Same check on the 5 projects with the most listings (bigger sample) ---");
  for (const [pid, count] of biggestProjects) {
    const proj = projects.find((p) => p.project_id === pid);
    if (!proj) continue;
    const prices = listings.filter((l) => l.project_id === pid).map((l) => l.price).filter((p) => p > 0);
    console.log({
      project_id: pid,
      listing_count: count,
      listing_price_min: Math.min(...prices),
      listing_price_max: Math.max(...prices),
      doc_price_min: proj.price_min,
      doc_price_max: proj.price_max,
      doc_min_x1e7: proj.price_min * 1e7,
      doc_max_x1e7: proj.price_max * 1e7,
    });
  }

  // --- Q8: listings_last_7_days
  section("Q8 listings_last_7_days");
  const windowStart = new Date(REFERENCE.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inWindow = listings.filter((l) => {
    const d = new Date(l.posted_at);
    return d >= windowStart && d < REFERENCE;
  });
  console.log(`Window: ${windowStart.toISOString()} to ${REFERENCE.toISOString()}`);
  console.log(`Count: ${inWindow.length}`);
  console.log(
    "CHECK: does posted_at actually parse as documented UTC 'Z', or does it carry an offset / look like IST mislabeled as UTC? Print a few raw posted_at strings and sanity-check against when the doc says listings were posted."
  );
  console.log("Sample raw posted_at values:", listings.slice(0, 5).map((l) => l.posted_at));

  // --- Q9: fake_listing_ids — deliberately not genuine, exist to generate enquiries
  section("Q9 fake_listing_ids candidates");
  // Hypothesis: fake/lead-gen listings reuse the same contact number across
  // many "different" listings (one person fielding enquiries for phantom
  // inventory), often with generic descriptions and round prices.
  const byContact = new Map();
  for (const l of listings) {
    const c = l.posted_by_contact;
    if (!c) continue;
    if (!byContact.has(c)) byContact.set(c, []);
    byContact.get(c).push(l.listing_id);
  }
  const suspiciousContacts = [...byContact.entries()]
    .filter(([, ids]) => ids.length > 5) // threshold to tune after inspecting distribution
    .sort((a, b) => b[1].length - a[1].length);
  console.log("Contacts reused across many listings (top 10):");
  console.log(suspiciousContacts.slice(0, 10).map(([c, ids]) => [c, ids.length]));
  console.log(
    "TUNE THE THRESHOLD: print the full distribution of listings-per-contact before picking a cutoff — one real agent legitimately lists many properties, so 'reused a lot' isn't proof alone. Cross-check with round prices / identical descriptions / missing project_id for corroboration."
  );

  // Corroboration: for the top few contacts, look at posted_by type,
  // description repetition, and whether prices look suspiciously uniform.
  // A legit agent (posted_by: "agent") with many DIFFERENT descriptions and
  // varied prices across DIFFERENT projects is probably fine. A contact
  // where many listings share near-identical descriptions/prices, or where
  // posted_by is "owner" despite dozens of "different" properties, is the
  // real fraud signal.
  const byId = new Map(listings.map((l) => [l.listing_id, l]));
  console.log("\nCorroboration detail for top 5 suspicious contacts:");
  for (const [contact, ids] of suspiciousContacts.slice(0, 5)) {
    const recs = ids.map((id) => byId.get(id)).filter(Boolean);
    const postedByTypes = [...new Set(recs.map((r) => r.posted_by))];
    const distinctDescriptions = new Set(recs.map((r) => r.description)).size;
    const distinctPrices = new Set(recs.map((r) => r.price)).size;
    const distinctProjects = new Set(recs.map((r) => r.project_id)).size;
    console.log({
      contact,
      count: ids.length,
      posted_by_types: postedByTypes,
      distinct_descriptions: distinctDescriptions,
      distinct_prices: distinctPrices,
      distinct_project_ids: distinctProjects,
      sample_description: recs[0]?.description,
    });
  }
  console.log(
    "\nRead this: if distinct_descriptions/distinct_prices are LOW relative to count (i.e. the same description or price repeats across supposedly different properties), that's real fraud corroboration. If they're all different (varied real descriptions, varied prices, varied projects) it's probably just a busy legit agent."
  );

  // Contact-reuse alone didn't pan out (every listing under a busy contact
  // has unique content). Try a different signal: listings priced way below
  // the going rate for their peer group (same locality + bedroom count) are
  // a classic lead-gen bait pattern — attractive enough to trigger calls,
  // not tied to real inventory.
  console.log("\n--- Alternate hypothesis: below-market pricing within peer group ---");
  const peerGroups = new Map(); // key: locality|bedroom -> array of price/sqft
  for (const l of listings) {
    if (!l.locality || !l.bedroom || !l.carpet_area) continue;
    const key = `${l.locality}|${l.bedroom}`;
    if (!peerGroups.has(key)) peerGroups.set(key, []);
    peerGroups.get(key).push({ id: l.listing_id, ppsf: l.price / l.carpet_area });
  }
  const belowMarketFlags = [];
  const ultraLowFlags = []; // near-zero ppsf — this is corruption, not fraud
  for (const [key, entries] of peerGroups) {
    if (entries.length < 5) continue;
    const sorted = [...entries].sort((a, b) => a.ppsf - b.ppsf);
    const median = sorted[Math.floor(sorted.length / 2)].ppsf;
    for (const e of entries) {
      if (e.ppsf > 0 && e.ppsf < 200 && !corruptIds.has(e.id)) {
        // No real listing sells at ₹11-200/sqft — this is a broken price
        // field (Q4 data_quality), not a deliberate fake-to-bait listing.
        ultraLowFlags.push({ id: e.id, key, ppsf: e.ppsf.toFixed(0), peer_median: median.toFixed(0) });
      } else if (e.ppsf >= 200 && e.ppsf < median * 0.4 && !corruptIds.has(e.id)) {
        belowMarketFlags.push({ id: e.id, key, ppsf: e.ppsf.toFixed(0), peer_median: median.toFixed(0) });
      }
    }
  }
  console.log(`Ultra-low (ppsf<200) — these are ADDITIONAL Q4 corrupt candidates, not fake: ${ultraLowFlags.length}`);
  console.log(ultraLowFlags);
  console.log(`\nModerately-below-market (200 <= ppsf < 40% of peer median) — real fake_listing_ids candidates: ${belowMarketFlags.length}`);
  console.log(belowMarketFlags);
  const fakeIdsFinal = new Set(belowMarketFlags.map((f) => f.id));

  // Also check is_verified: does it correlate with anything suspicious?
  const verifiedFalse = listings.filter((l) => l.is_verified === false);
  console.log(`\nis_verified=false count overall: ${verifiedFalse.length} of ${listings.length}`);
  const belowMarketIds = new Set(belowMarketFlags.map((f) => f.id));
  const belowMarketAndUnverified = belowMarketFlags.filter((f) => {
    const l = byId.get(f.id);
    return l && l.is_verified === false;
  });
  console.log(
    `Of the below-market candidates, ${belowMarketAndUnverified.length} are ALSO is_verified=false — that overlap (if strong) is a much better fraud signal than either alone.`
  );

  const fakeIds = fakeIdsFinal; // now populated from the moderate below-market candidates above
  for (const f of ultraLowFlags) corruptIds.add(f.id); // these belong in Q4, not Q9 — merge in before final Q6

  // --- back to Q6 now that fakeIds exists
  const q2bhk = listings.filter(
    (l) => l.is_live === true && l.bedroom === 2 && !corruptIds.has(l.listing_id) && !fakeIds.has(l.listing_id)
  );
  const ratios = q2bhk
    .filter((l) => l.carpet_area > 0)
    .map((l) => l.price / l.carpet_area);
  const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  console.log(`\n(back to Q6) 2BHK live listings after exclusions: ${q2bhk.length}, avg price/sqft: ${avg.toFixed(2)}`);
  console.log("Re-run this once fakeIds is actually populated from Q9.");

  // --- Q10: projects_with_wrong_listing_count
  section("Q10 projects_with_wrong_listing_count");
  // total_listings is documented as "listings currently available" — that
  // implies ACTIVE only. Counting inactive ones too (as a naive pass would)
  // inflates "actual" and makes nearly every project look wrong.
  const listingsByProject = new Map();
  for (const l of listings) {
    if (!l.project_id || l.is_live !== true) continue;
    listingsByProject.set(l.project_id, (listingsByProject.get(l.project_id) || 0) + 1);
  }
  let wrongCount = 0;
  const wrongDetails = [];
  for (const p of projects) {
    const actual = listingsByProject.get(p.project_id) || 0;
    if (actual !== p.total_listings) {
      wrongCount++;
      wrongDetails.push({ project_id: p.project_id, documented: p.total_listings, actual });
    }
  }
  console.log(`Projects with mismatched total_listings (active-only count): ${wrongCount}`);
  console.log(wrongDetails.slice(0, 15));
  console.log(
    "Compare this wrongCount to the earlier all-listings version — if it dropped a lot, that confirms total_listings only counts active ones, and this is the real answer."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
