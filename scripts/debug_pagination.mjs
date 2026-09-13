// debug_pagination.mjs
// Figures out how pagination actually works by trying several conventions
// and comparing the first record's ID each time. Run once, read the output,
// then we fix fetch_data.mjs properly.
//
// Usage: node scripts/debug_pagination.mjs

const BASE_URL = process.env.IVY_BASE_URL || "https://solve.ivy.homes";
const API_KEY = process.env.IVY_API_KEY;
const EMAIL = process.env.IVY_EMAIL || "demo1@ivy.homes";
const PASSWORD = process.env.IVY_PASSWORD;

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json();
  return data.access_token;
}

async function tryUrl(token, url) {
  const res = await fetch(url, {
    headers: { "X-API-Key": API_KEY, Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const firstId = data.results?.[0]?.listing_id;
  const lastId = data.results?.[data.results.length - 1]?.listing_id;
  console.log(
    `${url}\n  -> total=${data.total}, page=${data.page}, page_size=${data.page_size}, count=${data.results?.length}, first=${firstId}, last=${lastId}\n`
  );
}

async function main() {
  const token = await login();

  console.log("--- Testing different pagination conventions on /v1/listings ---\n");

  await tryUrl(token, `${BASE_URL}/v1/listings?page=1&limit=50`);
  await tryUrl(token, `${BASE_URL}/v1/listings?page=2&limit=50`);
  await tryUrl(token, `${BASE_URL}/v1/listings?page=3&limit=50`);

  console.log("--- Trying offset instead of page ---\n");
  await tryUrl(token, `${BASE_URL}/v1/listings?offset=0&limit=50`);
  await tryUrl(token, `${BASE_URL}/v1/listings?offset=50&limit=50`);
  await tryUrl(token, `${BASE_URL}/v1/listings?offset=100&limit=50`);

  console.log("--- page as string vs number, and combined with offset ---\n");
  await tryUrl(token, `${BASE_URL}/v1/listings?page=2&offset=50&limit=50`);

  console.log("--- Trying cursor/skip just in case ---\n");
  await tryUrl(token, `${BASE_URL}/v1/listings?skip=50&limit=50`);
}

main().catch((e) => console.error(e));
