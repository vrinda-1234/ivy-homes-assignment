# Ivy Homes assignment — data tooling

## 1. Pull your data (run this first, once)

```
cd ivy-homes
IVY_API_KEY=IVY26-50D79A344D4E node scripts/fetch_data.mjs
```

This writes `data/listings.json`, `data/rentals.json`, `data/projects.json` —
your full dataset, no more API calls needed after this.

## 2. Run the analysis

```
IVY_LOCALITY="golf course road" node scripts/analyze.mjs
```

This prints, section by section, a first pass at all 10 questions —
some are final numbers (Q1, Q3, Q5, Q7, Q8, Q10), some are candidate
lists you need to eyeball and confirm (Q2 duplicate groups, Q4 corrupt
flags, Q9 fake-listing contacts, Q6 which depends on Q4+Q9 being locked
first).

**Do not paste the printed numbers straight into submission.json.**
Read the console warnings — they tell you exactly where a judgment call
is still open (thresholds to tune, assumptions to verify against a raw
record). That's the actual work the assignment is scoring.

## 3. What's next

- Once Q4/Q9 candidate lists look right to you, hardcode `corruptIds`/
  `fakeIds` properly in analyze.mjs (right now `fakeIds` is an empty
  placeholder Set — Q9's detection needs a threshold you pick after
  looking at the printed distribution).
- Cross-check a handful of flagged records against `/v1/listing/{id}`
  by hand before finalizing — this is also your evidence list for the
  findings.
- Frontend (the 6 required screens) comes after this, once you know
  the real field names/behavior (e.g. `is_live` exists but isn't in the
  documented sample object — that's a documentation finding on its own).
