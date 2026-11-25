// Data storage: saved on the device (localStorage) and optionally synced
// to a JSON file in a GitHub repository so it is kept in a real file you can access anywhere.

const KEY = "reptrack.data.v1";
const SYNC_KEY = "reptrack.sync.v1"; // token + repo settings — never exported or synced

export function emptyData(profileDefaults) {
  return {
    app: "RepTrack",
    version: 1,
    updatedAt: 0,
    profile: { ...profileDefaults, _t: 0 },
    days: {}, // "YYYY-MM-DD" -> day record
    shopping: { items: {}, _t: 0 },
  };
}

export function loadData(profileDefaults) {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.days) return normalise(d, profileDefaults);
    }
  } catch (e) {
    console.warn("load failed", e);
  }
  return emptyData(profileDefaults);
}

function normalise(d, profileDefaults) {
  const base = emptyData(profileDefaults);
  return {
    ...base,
    ...d,
    profile: { ...base.profile, ...(d.profile || {}) },
    shopping: { ...base.shopping, ...(d.shopping || {}) },
    days: d.days || {},
  };
}

export function saveLocal(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn("save failed", e);
    return false;
  }
}

// Merge two data sets: each day / section keeps whichever copy was edited last.
export function merge(a, b, profileDefaults) {
  a = normalise(a, profileDefaults);
  b = normalise(b, profileDefaults);
  const days = { ...a.days };
  for (const [k, v] of Object.entries(b.days)) {
    if (!days[k] || (v._t || 0) > (days[k]._t || 0)) days[k] = v;
  }
  return {
    ...a,
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
    profile: (b.profile._t || 0) > (a.profile._t || 0) ? b.profile : a.profile,
    shopping: (b.shopping._t || 0) > (a.shopping._t || 0) ? b.shopping : a.shopping,
    days,
  };
}

/* ---------------- GitHub file sync ---------------- */

export function loadSyncSettings() {
  try {
    return { repo: "", path: "data/reptrack-data.json", branch: "", token: "", auto: true, ...JSON.parse(localStorage.getItem(SYNC_KEY) || "{}") };
  } catch {
    return { repo: "", path: "data/reptrack-data.json", branch: "", token: "", auto: true };
  }
}

export function saveSyncSettings(s) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(s));
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function gh(s, method, body) {
  const url = `https://api.github.com/repos/${s.repo}/contents/${s.path.split("/").map(encodeURIComponent).join("/")}` +
    (method === "GET" && s.branch ? `?ref=${encodeURIComponent(s.branch)}` : "");
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${s.token}`,
      Accept: "application/vnd.github+json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export function syncConfigured(s) {
  return !!(s.repo && s.path && s.token && /^[\w.-]+\/[\w.-]+$/.test(s.repo));
}

// Returns {data, sha} or {data:null, sha:null} if the file doesn't exist yet.
export async function pullRemote(s) {
  const res = await gh(s, "GET");
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) throw new Error(await errText(res));
  const j = await res.json();
  return { data: JSON.parse(b64decode(j.content)), sha: j.sha };
}

export async function pushRemote(s, data, sha) {
  const body = {
    message: `RepTrack: update progress (${new Date().toISOString().slice(0, 16).replace("T", " ")})`,
    content: b64encode(JSON.stringify(data, null, 1)),
  };
  if (sha) body.sha = sha;
  if (s.branch) body.branch = s.branch;
  const res = await gh(s, "PUT", body);
  if (res.status === 409 || res.status === 422) {
    const e = new Error("conflict");
    e.conflict = true;
    throw e;
  }
  if (!res.ok) throw new Error(await errText(res));
  const j = await res.json();
  return j.content.sha;
}

async function errText(res) {
  let msg = `GitHub ${res.status}`;
  try {
    const j = await res.json();
    if (j.message) msg += `: ${j.message}`;
  } catch {}
  if (res.status === 401) msg += " (check your token)";
  if (res.status === 404) msg += " (check repo name and token access)";
  return msg;
}

// Stable JSON string (sorted keys, ignoring updatedAt) for change detection
export function canonical(obj) {
  const sort = (v) =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).filter((k) => k !== "updatedAt").sort().map((k) => [k, sort(v[k])]))
      : v;
  return JSON.stringify(sort(obj));
}
