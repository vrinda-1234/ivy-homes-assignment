// API client for the Ivy Homes property API.
//
// This encodes several things the documentation gets wrong, discovered by
// actually probing the live API:
//   - API key goes in an X-API-Key header, not a ?api_key= query param.
//   - /v1/* collection endpoints also require a bearer token from login,
//     not just the API key.
//   - Login's token field is `access_token`, not `token`.
//   - Tokens expire in 15 minutes (not 24 hours as documented), but a
//     refresh_token + /auth/refresh DOES exist despite the docs claiming
//     "there is no refresh flow" — so we use it to keep sessions alive.
//   - The documented `page` query param is silently ignored; real
//     pagination is via `offset`, and the server caps page size at 50
//     regardless of the requested `limit`.
//   - The `total` field in collection responses undercounts the real
//     retrievable count — the only trustworthy end-of-data signal is the
//     server returning an empty page.

const BASE_URL = import.meta.env.VITE_IVY_BASE_URL || "https://solve.ivy.homes";
const API_KEY = import.meta.env.VITE_IVY_API_KEY;
const PAGE_SIZE = 50;

const STORAGE_KEY = "ivy_auth_v1";

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

let inMemoryAuth = loadAuth(); // { accessToken, refreshToken, expiresAt, email }

export function getAuth() {
  return inMemoryAuth;
}

export function isLoggedIn() {
  return !!inMemoryAuth?.accessToken;
}

export function logout() {
  inMemoryAuth = null;
  clearAuth();
}

async function rawLogin(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Login failed (${res.status})`);
  }
  return res.json();
}

export async function login(email, password) {
  const data = await rawLogin(email, password);
  inMemoryAuth = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    email,
  };
  saveAuth(inMemoryAuth);
  return inMemoryAuth;
}

async function refresh() {
  if (!inMemoryAuth?.refreshToken) throw new Error("No refresh token available");
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify({ refresh_token: inMemoryAuth.refreshToken }),
  });
  if (!res.ok) {
    // Refresh failed — the session is genuinely over, force re-login.
    logout();
    throw new Error("Session expired, please log in again");
  }
  const data = await res.json();
  inMemoryAuth = {
    ...inMemoryAuth,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || inMemoryAuth.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  saveAuth(inMemoryAuth);
  return inMemoryAuth;
}

async function ensureFreshToken() {
  if (!inMemoryAuth) throw new Error("Not logged in");
  // Refresh proactively if we're within 60s of expiry.
  if (inMemoryAuth.expiresAt - Date.now() < 60_000) {
    await refresh();
  }
  return inMemoryAuth.accessToken;
}

// Core authenticated request. Retries once via refresh on a 401.
async function request(path, { method = "GET", body, params } = {}) {
  const token = await ensureFreshToken();
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }
  }

  const doFetch = async (accessToken) =>
    fetch(url.toString(), {
      method,
      headers: {
        "X-API-Key": API_KEY,
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const fresh = await refresh();
    res = await doFetch(fresh.accessToken);
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Request failed (${res.status}) on ${path}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Pull every record from a collection endpoint by walking `offset` until
// the server returns an empty page. Ignores `total` as a stopping signal
// (it undercounts) and ignores `page` entirely (it's a no-op).
export async function fetchAllPages(path, extraParams = {}, onProgress) {
  const results = [];
  let offset = 0;
  const SAFETY_CAP = 20000; // generous — real datasets here are in the thousands
  while (offset < SAFETY_CAP) {
    const data = await request(path, { params: { ...extraParams, offset, limit: PAGE_SIZE } });
    if (!data.results || data.results.length === 0) break;
    results.push(...data.results);
    offset += data.results.length;
    onProgress?.(results.length);
  }
  // Safety dedupe by common id fields, in case of any server-side overlap.
  const seen = new Set();
  return results.filter((r) => {
    const id = r.listing_id || r.project_id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function getListing(id) {
  return request(`/v1/listing/${id}`);
}

export async function getFavourites() {
  return request("/v1/favourites");
}

export async function addFavourite(id) {
  return request("/v1/favourites", { method: "POST", body: { id } });
}

export async function removeFavourite(id) {
  return request(`/v1/favourites/${id}`, { method: "DELETE" });
}

export async function getAnalyticsSummary() {
  return request("/v1/analytics/summary");
}
