import { PLAN } from "./plan.js";
import * as S from "./store.js";

/* ================= state ================= */
let data = S.loadData(PLAN.profileDefaults);
let sync = S.loadSyncSettings();
let syncState = { sha: null, status: "off", msg: "" };
let tab = sessionGet("tab") || "today";
let curDate = todayKey();
let progressEx = sessionGet("progressEx") || "machine-chest-press";

const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");

function sessionGet(k) { try { return sessionStorage.getItem("rt." + k); } catch { return null; } }
function sessionSet(k, v) { try { sessionStorage.setItem("rt." + k, v); } catch {} }

/* ================= dates ================= */
function todayKey() { return toKey(new Date()); }
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(k, n) { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); }
function weekStart(k) { const d = fromKey(k); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return toKey(d); }
function dayDiff(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 86400000); }
function fmtDate(k, opts = { weekday: "long", day: "numeric", month: "long" }) {
  return fromKey(k).toLocaleDateString(undefined, opts);
}

/* ================= data helpers ================= */
function getDay(k) { return data.days[k] || {}; }
function editDay(k, fn) {
  const d = data.days[k] || (data.days[k] = {});
  fn(d);
  d._t = Date.now();
  persist();
}
function persist() {
  data.updatedAt = Date.now();
  S.saveLocal(data);
  scheduleSync();
}
/* ---- workouts: your edited copy (data.plan) or the original plan ---- */
function workouts() { return (data.plan || PLAN).workouts; }
function schedule() { return (data.plan || PLAN).schedule; }
function editablePlan() {
  if (!data.plan) data.plan = JSON.parse(JSON.stringify({ workouts: PLAN.workouts, schedule: PLAN.schedule, archive: {} }));
  data.plan.archive ||= {};
  return data.plan;
}
function touchPlan() { data.plan._t = Date.now(); persist(); }
function exById(id) {
  for (const w of Object.values(workouts())) { const e = w.exercises.find((x) => x.id === id); if (e) return e; }
  return data.plan?.archive?.[id] || null;
}
function tutorialUrl(e) {
  return e.video || `https://www.youtube.com/results?search_query=${encodeURIComponent(e.name + " exercise proper form tutorial")}`;
}
function plannedType(k) { const t = schedule()[fromKey(k).getDay()]; return t && workouts()[t] ? t : "rest"; }
function dayType(k) { const t = getDay(k).type; return t && (t === "rest" || workouts()[t]) ? t : plannedType(k); }

function num(v) { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtNum(n, d = 1) { return n == null ? "—" : (Math.round(n * 10 ** d) / 10 ** d).toString(); }


function setHasData(s) { return s && (s.done || num(s.w) != null || num(s.r) != null); }

// Previous session for an exercise before date k
function lastSession(exId, k) {
  const keys = Object.keys(data.days).filter((d) => d < k).sort().reverse();
  for (const d of keys) {
    const e = data.days[d].ex?.[exId];
    if (e && e.sets?.some((s) => s.done)) return { date: d, sets: e.sets.filter((s) => s.done) };
  }
  return null;
}

function progressionHint(ex, last) {
  if (!last) return null;
  const sets = last.sets;
  const topHit = sets.length >= ex.sets && sets.every((s) => (num(s.r) ?? 0) >= ex.max);
  if (!topHit) return null;
  if (ex.assisted) return "Hit the top of the range on every set — try a little less assistance.";
  if (ex.bodyweight) return ex.unit === "sec" ? "Hit the top of the range — add a few seconds if it feels solid." : "Hit the top of the range — add reps or slow the tempo.";
  return "Hit the top of the range on every set — increase the load slightly today.";
}

function dayNutrition(day) {
  let kcal = 0, protein = 0;
  for (const m of PLAN.meals) if (day.meals?.[m.id]) { kcal += m.kcal; protein += m.protein; }
  if (day.supp?.whey) protein += 22;
  kcal += num(day.extraKcal) || 0;
  protein += num(day.extraProtein) || 0;
  return { kcal, protein };
}

function workoutProgress(k) {
  const day = getDay(k), type = dayType(k);
  if (type === "rest" || !workouts()[type].exercises.length) return null;
  const exs = workouts()[type].exercises;
  let done = 0, total = 0;
  for (const e of exs) {
    total += e.sets;
    done += Math.min(e.sets, (day.ex?.[e.id]?.sets || []).filter((s) => s.done).length);
  }
  return { done, total };
}
function isWorkoutDone(k) {
  const day = getDay(k);
  if (day.workoutDone) return true;
  const p = workoutProgress(k);
  return !!p && p.done >= p.total;
}
function trainedOn(k) {
  const day = getDay(k);
  return day.workoutDone || Object.values(day.ex || {}).some((e) => e.sets?.some((s) => s.done));
}

/* ================= rendering ================= */
function render() {
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === (tab === "edit" ? "plan" : tab)));
  const scroll = window.scrollY;
  if (tab === "today") app.innerHTML = renderToday();
  else if (tab === "progress") app.innerHTML = renderProgress();
  else if (tab === "plan") app.innerHTML = renderPlan();
  else if (tab === "edit") app.innerHTML = renderEditor();
  else app.innerHTML = renderSettings();
  renderSyncBadge();
  return scroll;
}
function rerender() {
  const y = window.scrollY;
  const open = [...document.querySelectorAll(".ed-ex")].filter((el) => el.querySelector(".ed-more[open]")).map((el) => el.querySelector(".ed-name")?.dataset.e);
  render();
  for (const id of open) document.querySelector(`.ed-name[data-e="${id}"]`)?.closest(".ed-ex")?.querySelector(".ed-more")?.setAttribute("open", "");
  window.scrollTo(0, y);
}

function section(title, body, extra = "", id = "") {
  return `<section class="card" ${id ? `id="${id}"` : ""}><div class="card-h"><h2>${title}</h2>${extra}</div>${body}</section>`;
}

/* ---------- TODAY ---------- */
function renderToday() {
  const k = curDate, day = getDay(k), type = dayType(k);
  const isToday = k === todayKey();
  const chips = [...Object.keys(workouts()), "rest"].map((t) =>
    `<button class="chip ${type === t ? "on" : ""}" data-action="set-type" data-type="${t}">${t === "rest" ? "Rest" : esc(workouts()[t].name)}${plannedType(k) === t ? '<span class="dot"></span>' : ""}</button>`
  ).join("");

  let html = `
  <div class="datebar">
    <button class="icon-btn" data-action="date" data-d="-1" aria-label="Previous day">‹</button>
    <div class="date-mid">
      <div class="date-main">${isToday ? "Today" : fmtDate(k, { weekday: "long" })}</div>
      <div class="date-sub">${fmtDate(k, { day: "numeric", month: "long", year: "numeric" })}${isToday ? "" : ` · <a href="#" data-action="go-today">back to today</a>`}</div>
    </div>
    <button class="icon-btn" data-action="date" data-d="1" aria-label="Next day">›</button>
  </div>
  <div class="chips">${chips}</div>`;

  html += renderSummary(k);

  if (type !== "rest") html += renderWorkout(k, type);
  else html += section("Rest day", `<p class="muted">Recovery day. Easy walking is fine. Sleep 7–9 hours and stay hydrated.</p>
    <p class="muted small">Missed a session? Pick Push, Pull or Legs above to log it today.</p>`);

  html += renderSupplements(k);
  html += renderMeals(k);
  html += renderHabits(k);
  return html;
}

function renderSummary(k) {
  const day = getDay(k);
  const wp = workoutProgress(k);
  const sup = PLAN.supplements.filter((s) => !s.optional);
  const supDone = sup.filter((s) => day.supp?.[s.id]).length;
  const n = dayNutrition(day);
  const ring = (pct, label, val) => `
    <div class="ring-item">
      <svg viewBox="0 0 36 36" class="ring"><circle cx="18" cy="18" r="15.9" class="ring-bg"/><circle cx="18" cy="18" r="15.9" class="ring-fg" stroke-dasharray="${Math.min(100, pct).toFixed(1)} 100"/></svg>
      <div class="ring-val">${val}</div><div class="ring-label">${label}</div>
    </div>`;
  return `<section class="card summary">
    ${wp ? ring((wp.done / wp.total) * 100, "Sets", `${wp.done}/${wp.total}`) : ring(100, "Rest", "✓")}
    ${ring((supDone / sup.length) * 100, "Supps", `${supDone}/${sup.length}`)}
    ${ring((n.kcal / PLAN.nutrition.kcalMin) * 100, "kcal", n.kcal)}
    ${ring((n.protein / PLAN.nutrition.proteinMin) * 100, "Protein", `${n.protein}g`)}
  </section>`;
}

function renderWorkout(k, type) {
  const w = workouts()[type], day = getDay(k);
  const warm = PLAN.warmup.map((t, i) => `<label class="check"><input type="checkbox" data-action="warmup" data-i="${i}" ${day.warmup?.[i] ? "checked" : ""}><span>${esc(t)}</span></label>`).join("");
  const exHtml = w.exercises.map((e) => renderExercise(k, e)).join("");
  const done = isWorkoutDone(k);
  if (!w.exercises.length) return section(esc(w.name), `<p class="muted">No exercises in this workout yet.</p><button class="btn btn-primary full" data-action="edit-open">Add exercises</button>`);
  return section(`${esc(w.name)} <span class="muted small">${esc(w.focus || "")}</span>`,
    `<details class="warmup" ${Object.keys(day.warmup || {}).length < PLAN.warmup.length ? "open" : ""}><summary>Warm-up</summary>${warm}</details>
     ${exHtml}
     <label class="field"><span>Workout notes</span><textarea data-field="workoutNotes" rows="2" placeholder="How did it feel? Shoulder OK?">${esc(day.workoutNotes || "")}</textarea></label>
     <button class="btn ${done ? "btn-done" : "btn-primary"} full" data-action="finish">${done ? "✓ Workout complete" : "Mark workout complete"}</button>`
  );
}

function renderExercise(k, e) {
  const day = getDay(k);
  const rec = day.ex?.[e.id] || {};
  const last = lastSession(e.id, k);
  const sets = rec.sets && rec.sets.length ? rec.sets : Array.from({ length: e.sets }, () => ({}));
  const hint = progressionHint(e, last);
  const range = e.min === e.max ? `${e.min}` : `${e.min}–${e.max}`;
  const wLabel = e.assisted ? "assist kg" : e.bodyweight ? "+kg" : "kg";
  const rLabel = e.unit === "sec" ? "sec" : "reps";
  const doneCount = sets.filter((s) => s.done).length;
  const lastTxt = last ? `Last (${fmtDate(last.date, { day: "numeric", month: "short" })}): ` + last.sets.map((s) => `${num(s.w) != null ? s.w + "×" : ""}${s.r ?? "?"}`).join(", ") : "No previous log yet";

  const rows = sets.map((s, i) => {
    const ls = last?.sets[i] || last?.sets[last.sets.length - 1];
    const phW = ls && num(ls.w) != null ? ls.w : (e.bodyweight ? "0" : "");
    const phR = ls && num(ls.r) != null ? ls.r : String(e.max);
    return `<div class="set-row ${s.done ? "done" : ""}">
      <span class="set-n">${i + 1}</span>
      <input inputmode="decimal" class="in" data-set="${e.id}" data-i="${i}" data-k="w" value="${esc(s.w ?? "")}" placeholder="${esc(phW)}" aria-label="Set ${i + 1} ${wLabel}">
      <span class="unit">${wLabel}</span>
      <input inputmode="numeric" class="in" data-set="${e.id}" data-i="${i}" data-k="r" value="${esc(s.r ?? "")}" placeholder="${esc(phR)}" aria-label="Set ${i + 1} ${rLabel}">
      <span class="unit">${rLabel}</span>
      <button class="tick ${s.done ? "on" : ""}" data-action="tick" data-ex="${e.id}" data-i="${i}" aria-label="Set ${i + 1} done">✓</button>
    </div>`;
  }).join("");

  return `<div class="exercise ${doneCount >= e.sets ? "complete" : ""}">
    <div class="ex-h">
      <div><div class="ex-name">${esc(e.name)}${e.shoulder ? ' <span class="tag warn" title="Check with your shoulder specialist">shoulder</span>' : ""}</div>
      <div class="ex-target">${e.sets} × ${range} ${e.unit} · <a class="howto" href="${esc(tutorialUrl(e))}" target="_blank" rel="noopener">▶ How to do it</a></div></div>
      <div class="ex-count">${doneCount}/${e.sets}</div>
    </div>
    <div class="ex-last">${esc(lastTxt)}</div>
    ${hint ? `<div class="hint">⬆ ${esc(hint)}</div>` : ""}
    ${rows}
    <div class="ex-actions"><button class="link" data-action="add-set" data-ex="${e.id}">+ set</button>${sets.length > 1 ? `<button class="link" data-action="del-set" data-ex="${e.id}">− set</button>` : ""}</div>
  </div>`;
}

function renderSupplements(k) {
  const day = getDay(k);
  const items = PLAN.supplements.map((s) => `
    <label class="check big ${day.supp?.[s.id] ? "on" : ""}">
      <input type="checkbox" data-action="supp" data-id="${s.id}" ${day.supp?.[s.id] ? "checked" : ""}>
      <span><b>${esc(s.name)}</b><br><span class="muted small">${esc(s.dose)}</span></span>
    </label>`).join("");
  return section("Supplements", `<div class="grid2">${items}</div>`, `<button class="link" data-action="supp-all">All taken</button>`);
}

function renderMeals(k) {
  const day = getDay(k), n = dayNutrition(day);
  const items = PLAN.meals.map((m) => `
    <label class="check meal ${day.meals?.[m.id] ? "on" : ""}">
      <input type="checkbox" data-action="meal" data-id="${m.id}" ${day.meals?.[m.id] ? "checked" : ""}>
      <span class="meal-time">${m.time}</span>
      <span class="meal-body"><b>${esc(m.name)}</b> <span class="muted small">~${m.kcal} kcal · ~${m.protein} g protein</span><br><span class="small">${esc(m.desc)}</span></span>
    </label>`).join("");
  return section("Meals",
    `${items}
     <div class="row2">
       <label class="field"><span>Extra kcal</span><input inputmode="numeric" data-field="extraKcal" value="${esc(day.extraKcal ?? "")}" placeholder="0"></label>
       <label class="field"><span>Extra protein g</span><input inputmode="numeric" data-field="extraProtein" value="${esc(day.extraProtein ?? "")}" placeholder="0"></label>
     </div>
     <p class="muted small" id="nutri-line">Logged ≈ <b>${n.kcal}</b> kcal · <b>${n.protein}</b> g protein. Target ${PLAN.nutrition.calories} · ${PLAN.nutrition.protein} protein.</p>`);
}

function renderHabits(k) {
  const day = getDay(k);
  return section("Body & recovery", `
    <div class="row3">
      <label class="field"><span>Weight (kg)</span><input inputmode="decimal" data-field="weight" value="${esc(day.weight ?? "")}" placeholder="${esc(latestWeight()?.w ?? PLAN.profileDefaults.startWeight)}"></label>
      <label class="field"><span>Sleep (h)</span><input inputmode="decimal" data-field="sleep" value="${esc(day.sleep ?? "")}" placeholder="8"></label>
      <label class="field"><span>Water (glasses)</span>
        <div class="stepper"><button data-action="water" data-d="-1">−</button><b id="water-val">${day.water || 0}</b><button data-action="water" data-d="1">+</button></div></label>
    </div>
    <label class="field"><span>Notes</span><textarea data-field="notes" rows="2" placeholder="Energy, appetite, shoulder…">${esc(day.notes || "")}</textarea></label>
    <p class="muted small">Weigh in the morning after the bathroom, before breakfast.</p>`);
}

/* ---------- PROGRESS ---------- */
function weightEntries() {
  return Object.entries(data.days).filter(([, d]) => num(d.weight) != null).map(([k, d]) => ({ k, w: num(d.weight) })).sort((a, b) => (a.k < b.k ? -1 : 1));
}
function latestWeight() { const e = weightEntries(); return e[e.length - 1] || null; }
function weeklyAverages() {
  const map = {};
  for (const e of weightEntries()) (map[weekStart(e.k)] ||= []).push(e.w);
  return Object.entries(map).sort().map(([wk, ws]) => ({ wk, avg: ws.reduce((a, b) => a + b, 0) / ws.length, n: ws.length }));
}

function weightAdvice(weeks) {
  if (weeks.length < 2) return { cls: "info", text: "Log 3–7 morning weights per week. After two weeks you'll see your weekly trend and a calorie recommendation here." };
  const d1 = weeks[weeks.length - 1].avg - weeks[weeks.length - 2].avg;
  if (weeks.length >= 3) {
    const d0 = weeks[weeks.length - 2].avg - weeks[weeks.length - 3].avg;
    if (d0 <= 0 && d1 <= 0) return { cls: "warn", text: "Weekly average hasn't risen for 2 weeks → add about 150–200 kcal per day (extra bread, oats, rice or olive oil)." };
    if (d0 > 0.5 && d1 > 0.5) return { cls: "warn", text: "Gaining faster than planned (>0.5 kg/week) → reduce calories slightly." };
  }
  if (d1 >= 0.15 && d1 <= 0.4) return { cls: "good", text: `On track: +${fmtNum(d1, 2)} kg vs last week (target 0.2–0.3 kg/week). Keep going.` };
  if (d1 <= 0) return { cls: "info", text: `Weekly average ${fmtNum(d1, 2)} kg vs last week. If it doesn't rise next week either, add 150–200 kcal/day.` };
  return { cls: "info", text: `${d1 > 0 ? "+" : ""}${fmtNum(d1, 2)} kg vs last week. Target is about 0.2–0.3 kg/week — judge the trend over several weeks.` };
}

function renderProgress() {
  const p = data.profile;
  const weeks = weeklyAverages();
  const latest = latestWeight();
  const cur = weeks.length ? weeks[weeks.length - 1].avg : latest?.w ?? num(p.startWeight);
  const toGo = num(p.targetWeight) - cur;
  const startW = num(p.startWeight);
  const pct = Math.max(0, Math.min(100, ((cur - startW) / (num(p.targetWeight) - startW)) * 100)) || 0;
  let rate = null;
  if (weeks.length >= 2) rate = (weeks[weeks.length - 1].avg - weeks[0].avg) / Math.max(1, dayDiff(weeks[0].wk, weeks[weeks.length - 1].wk) / 7);
  const etaWeeks = toGo > 0 ? toGo / (rate && rate > 0.05 ? rate : 0.25) : 0;
  const adv = weightAdvice(weeks);

  // weight chart
  const entries = weightEntries().slice(-120);
  const chart = entries.length
    ? lineChart({
        series: [
          { pts: entries.map((e) => ({ x: dayDiff(entries[0].k, e.k), y: e.w })), cls: "s-dots", dots: true, line: false },
          { pts: weeks.filter((w) => w.wk >= weekStart(entries[0].k)).map((w) => ({ x: dayDiff(entries[0].k, w.wk) + 3, y: w.avg })), cls: "s-line", line: true, dots: true },
        ],
        target: num(p.targetWeight),
        xLabel: (x) => fmtDate(addDays(entries[0].k, x), { day: "numeric", month: "short" }),
      })
    : `<p class="muted">No weights yet. Add your morning weight below or on the Today tab.</p>`;

  const wForm = `<div class="weight-form"><div class="row2">
      <label class="field"><span>Date</span><input type="date" id="w-date" value="${todayKey()}" max="${todayKey()}"></label>
      <label class="field"><span>Weight kg</span><input inputmode="decimal" id="w-val" placeholder="${esc(latest?.w ?? startW)}"></label>
    </div><button class="btn btn-primary full" data-action="add-weight">Save weight</button></div>`;

  const recent = weightEntries().slice(-10).reverse().map((e) => `<tr><td>${fmtDate(e.k, { weekday: "short", day: "numeric", month: "short" })}</td><td>${e.w} kg</td><td><button class="link danger" data-action="del-weight" data-k="${e.k}">delete</button></td></tr>`).join("");

  let html = section("Weight",
    `<div class="stats">
      <div class="stat"><div class="stat-v">${fmtNum(cur)}</div><div class="stat-l">weekly avg kg</div></div>
      <div class="stat"><div class="stat-v">${toGo > 0 ? fmtNum(toGo) : "🎉"}</div><div class="stat-l">${toGo > 0 ? "kg to " + p.targetWeight : "target reached"}</div></div>
      <div class="stat"><div class="stat-v">${rate == null ? "—" : (rate > 0 ? "+" : "") + fmtNum(rate, 2)}</div><div class="stat-l">kg / week</div></div>
      <div class="stat"><div class="stat-v">${toGo > 0 ? Math.ceil(etaWeeks) : "0"}</div><div class="stat-l">weeks to go*</div></div>
    </div>
    <div class="bar"><div class="bar-fg" style="width:${pct}%"></div></div>
    <div class="bar-l small muted"><span>${startW} kg start</span><span>${p.targetWeight} kg target</span></div>
    <div class="advice ${adv.cls}">${esc(adv.text)}</div>
    ${chart}
    <div class="legend small muted"><span><i class="lg-dot"></i>daily</span><span><i class="lg-line"></i>weekly average</span><span><i class="lg-target"></i>target</span></div>
    ${wForm}
    ${recent ? `<details class="mt"><summary>Recent entries</summary><table class="tbl">${recent}</table></details>` : ""}
    <p class="muted small">*Estimate based on your trend (or 0.25 kg/week until there's enough data).</p>`);

  html += renderConsistency();
  html += renderExerciseProgress();
  return html;
}

function renderConsistency() {
  const today = todayKey();
  const ws = weekStart(today);
  let wDone = 0, sDays = 0, mealsSum = 0, sleepArr = [], kcalArr = [];
  const coreSupp = PLAN.supplements.filter((s) => !s.optional);
  for (let i = 0; i < 7; i++) {
    const k = addDays(ws, i);
    if (k > today) break;
    const d = getDay(k);
    if (trainedOn(k)) wDone++;
    if (coreSupp.every((s) => d.supp?.[s.id])) sDays++;
    if (num(d.sleep) != null) sleepArr.push(num(d.sleep));
    const n = dayNutrition(d);
    if (n.kcal > 0) kcalArr.push(n.kcal);
  }
  const daysSoFar = Math.min(7, dayDiff(ws, today) + 1);
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  // last 5 weeks calendar
  const start = addDays(ws, -28);
  const trainedKeys = Object.keys(data.days).filter(trainedOn).sort();
  const firstDay = [data.profile.startDate || today, trainedKeys[0] || today].sort()[0];
  let cal = `<div class="cal">${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<div class="cal-h">${d}</div>`).join("")}`;
  for (let i = 0; i < 35; i++) {
    const k = addDays(start, i);
    const d = getDay(k);
    const trained = trainedOn(k);
    const supp = coreSupp.every((s) => d.supp?.[s.id]);
    const planned = plannedType(k) !== "rest";
    cal += `<button class="cal-d ${k === today ? "today" : ""} ${k > today ? "future" : ""} ${trained ? "trained" : planned && k < today && k >= firstDay ? "missed" : ""}" data-action="open-day" data-k="${k}" title="${k}">
      <span>${fromKey(k).getDate()}</span>${supp ? '<i class="sdot"></i>' : ""}</button>`;
  }
  cal += "</div>";

  return section("This week",
    `<div class="stats">
      <div class="stat"><div class="stat-v">${wDone}/3</div><div class="stat-l">workouts</div></div>
      <div class="stat"><div class="stat-v">${sDays}/${daysSoFar}</div><div class="stat-l">supplement days</div></div>
      <div class="stat"><div class="stat-v">${avg(kcalArr) == null ? "—" : Math.round(avg(kcalArr))}</div><div class="stat-l">avg kcal</div></div>
      <div class="stat"><div class="stat-v">${avg(sleepArr) == null ? "—" : fmtNum(avg(sleepArr))}</div><div class="stat-l">avg sleep h</div></div>
    </div>
    ${cal}
    <div class="legend small muted"><span><i class="lg-box trained"></i>trained</span><span><i class="lg-box missed"></i>missed</span><span><i class="sdot static"></i>all supplements</span></div>
    <p class="muted small">Tap a day to open it.</p>`);
}

function exerciseHistory(id) {
  const out = [];
  for (const k of Object.keys(data.days).sort()) {
    const sets = (data.days[k].ex?.[id]?.sets || []).filter((s) => s.done);
    if (!sets.length) continue;
    const ws = sets.map((s) => num(s.w) ?? 0), rs = sets.map((s) => num(s.r) ?? 0);
    const best = Math.max(...ws);
    const vol = sets.reduce((a, s) => a + (num(s.w) ?? 0) * (num(s.r) ?? 0), 0);
    out.push({ k, sets, best, vol, reps: rs.reduce((a, b) => a + b, 0) });
  }
  return out;
}

function renderExerciseProgress() {
  const removed = Object.values(data.plan?.archive || {}).filter((e) => exerciseHistory(e.id).length && !Object.values(workouts()).some((w) => w.exercises.some((x) => x.id === e.id)));
  const groups = [...Object.values(workouts()).filter((w) => w.exercises.length), ...(removed.length ? [{ name: "Removed exercises", exercises: removed }] : [])];
  if (!exById(progressEx) && groups.length) progressEx = groups[0].exercises[0].id;
  if (!groups.length) return section("Exercise progress", `<p class="muted">No exercises yet.</p>`);
  const opts = groups.map((w) =>
    `<optgroup label="${esc(w.name)}">${w.exercises.map((e) => `<option value="${e.id}" ${e.id === progressEx ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</optgroup>`).join("");
  const ex = exById(progressEx);
  const hist = exerciseHistory(progressEx);
  const useReps = hist.every((h) => h.best === 0);
  let chart = `<p class="muted">No sessions logged for this exercise yet.</p>`;
  if (hist.length) {
    chart = lineChart({
      series: [{ pts: hist.map((h) => ({ x: dayDiff(hist[0].k, h.k), y: useReps ? h.reps : h.best })), cls: "s-line", line: true, dots: true }],
      xLabel: (x) => fmtDate(addDays(hist[0].k, x), { day: "numeric", month: "short" }),
    });
  }
  const rows = hist.slice(-8).reverse().map((h) => `<tr><td>${fmtDate(h.k, { day: "numeric", month: "short" })}</td><td>${h.sets.map((s) => `${num(s.w) != null ? s.w + "×" : ""}${s.r ?? "?"}`).join(", ")}</td></tr>`).join("");
  const first = hist[0], lastH = hist[hist.length - 1];
  const gain = hist.length > 1 ? (useReps ? `${lastH.reps - first.reps >= 0 ? "+" : ""}${lastH.reps - first.reps} total ${ex.unit}` : `${lastH.best - first.best >= 0 ? "+" : ""}${fmtNum(lastH.best - first.best)} kg top set`) : "";
  return section("Exercise progress",
    `<select id="ex-select" class="select">${opts}</select>
     <p class="small muted">${useReps ? `Chart: total ${ex.unit} per session` : `Chart: heaviest set (${ex.assisted ? "assistance — lower is better" : "kg"})`}${gain ? ` · since first log: <b>${gain}</b>` : ""}</p>
     ${chart}
     ${rows ? `<table class="tbl">${rows}</table>` : ""}`);
}

function lineChart({ series, target, xLabel }) {
  const W = 340, H = 180, P = { l: 34, r: 10, t: 12, b: 24 };
  const all = series.flatMap((s) => s.pts);
  if (!all.length) return "";
  let ys = all.map((p) => p.y);
  if (target != null) ys.push(target);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  if (yMax - yMin < 1) { yMin -= 0.5; yMax += 0.5; }
  const pad = (yMax - yMin) * 0.1; yMin -= pad; yMax += pad;
  if (ys.every((y) => y >= 0)) yMin = Math.max(0, yMin);
  const xMax = Math.max(...all.map((p) => p.x));
  const single = xMax === 0;
  const sx = (x) => single ? (P.l + W - P.r) / 2 : P.l + (x / xMax) * (W - P.l - P.r);
  const sy = (y) => P.t + (1 - (y - yMin) / (yMax - yMin)) * (H - P.t - P.b);
  let g = "";
  for (let i = 0; i <= 3; i++) {
    const y = yMin + ((yMax - yMin) * i) / 3;
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${sy(y)}" y2="${sy(y)}" class="grid"/><text x="${P.l - 4}" y="${sy(y) + 3}" class="axis" text-anchor="end">${fmtNum(y)}</text>`;
  }
  g += single
    ? `<text x="${sx(0)}" y="${H - 6}" class="axis" text-anchor="middle">${esc(xLabel(0))}</text>`
    : `<text x="${P.l}" y="${H - 6}" class="axis">${esc(xLabel(0))}</text><text x="${W - P.r}" y="${H - 6}" class="axis" text-anchor="end">${esc(xLabel(xMax))}</text>`;
  if (target != null) g += `<line x1="${P.l}" x2="${W - P.r}" y1="${sy(target)}" y2="${sy(target)}" class="target"/>`;
  for (const s of series) {
    if (s.line && s.pts.length > 1) g += `<polyline class="${s.cls}" fill="none" points="${s.pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ")}"/>`;
    if (s.dots) g += s.pts.map((p) => `<circle class="${s.cls}" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${s.line ? 3 : 2.5}"/>`).join("");
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}

/* ---------- PLAN ---------- */
function renderPlan() {
  const p = PLAN;
  const list = (arr) => `<ul>${arr.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
  const sched = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => {
    const t = schedule()[(i + 1) % 7];
    const w = t && workouts()[t];
    return `<div class="sched-d ${w ? "train" : ""}"><b>${d}</b><span>${w ? esc(w.name) : "Rest"}</span></div>`;
  }).join("");
  const wkHtml = Object.values(workouts()).map((w) => `
    <h3>${esc(w.name)} <span class="muted small">${esc(w.focus || "")}</span></h3>
    ${w.exercises.length ? `<table class="tbl"><tr><th>Exercise</th><th>Sets</th><th>Reps</th></tr>
    ${w.exercises.map((e) => `<tr><td>${esc(e.name)} <a class="howto" href="${esc(tutorialUrl(e))}" target="_blank" rel="noopener" aria-label="How to do ${esc(e.name)}">▶</a></td><td>${e.sets}</td><td>${e.min === e.max ? e.min : e.min + "–" + e.max} ${e.unit === "reps" ? "" : e.unit}</td></tr>`).join("")}</table>` : `<p class="muted small">No exercises yet.</p>`}`).join("")
    + `<button class="btn btn-primary full" data-action="edit-open">✎ Add, edit or delete workouts</button>`;
  const shop = Object.entries(p.shopping).map(([cat, items]) => `<h3>${cat}</h3>${items.map((it) => `
    <label class="check"><input type="checkbox" data-action="shop" data-id="${esc(it)}" ${data.shopping.items[it] ? "checked" : ""}><span>${esc(it)}</span></label>`).join("")}`).join("");

  const det = (title, body, open = false) => `<details class="card plan" ${open ? "open" : ""}><summary><h2>${title}</h2></summary><div class="plan-b">${body}</div></details>`;

  return `
  <section class="card hero"><h1>${esc(p.title)}</h1><p class="muted">${esc(p.tagline)}</p>
    <div class="stats"><div class="stat"><div class="stat-v">${data.profile.startWeight}</div><div class="stat-l">start kg</div></div>
    <div class="stat"><div class="stat-v">${data.profile.targetWeight}</div><div class="stat-l">target kg</div></div>
    <div class="stat"><div class="stat-v">${data.profile.height}</div><div class="stat-l">height cm</div></div></div>
    <div class="sched">${sched}</div></section>
  ${p.safetyNotes.map((n) => `<div class="advice warn"><b>${esc(n.title)}:</b> ${esc(n.text)}</div>`).join("")}
  ${det("Workouts", wkHtml, true)}
  ${det("How to train", list(p.howToTrain) + `<h3>Warm-up</h3>` + list(p.warmup))}
  ${det("Recovery", `<table class="tbl">${p.recovery.map((r) => `<tr><td><b>${r.habit}</b></td><td>${esc(r.target)}</td></tr>`).join("")}</table>`)}
  ${det("Daily food plan", `
    <div class="stats"><div class="stat"><div class="stat-v sm">${p.nutrition.calories}</div><div class="stat-l">daily calories</div></div>
    <div class="stat"><div class="stat-v sm">${p.nutrition.protein}</div><div class="stat-l">daily protein</div></div>
    <div class="stat"><div class="stat-v sm">${p.nutrition.rate}</div><div class="stat-l">rate of gain</div></div></div>
    <p class="small">${esc(p.nutrition.calorieNote)}</p>
    <table class="tbl">${p.meals.map((m) => `<tr><td><b>${m.time}</b><br><span class="small muted">${m.name}</span></td><td class="small">${esc(m.desc)}</td><td class="small">~${m.kcal}</td></tr>`).join("")}</table>
    <h3>Simple portion swaps</h3>${list(p.swaps)}`)}
  ${det("Recipes", p.recipes.map((r, i) => `<h3>${i + 1}. ${esc(r.name)}</h3><p class="small"><b>Ingredients:</b> ${esc(r.ingredients)}</p><p class="small"><b>Method:</b> ${esc(r.method)}</p>`).join(""))}
  ${det("Shopping list", shop + `<button class="link mt" data-action="shop-clear">Clear ticks</button>`)}
  ${det("Supplements & vitamins", list(p.supplementGuide))}
  ${det("How to track your weight", list(p.weightTracking))}
  ${det("Suggestions", `<ol>${p.suggestions.map((t) => `<li>${esc(t)}</li>`).join("")}</ol><p class="small">${esc(p.keepConsistent)}</p>`)}
  <p class="muted small center">${esc(p.disclaimer)}</p>`;
}

/* ---------- WORKOUT EDITOR ---------- */
const DAYS = [["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 0]];
function exKind(e) { return e.assisted ? "assisted" : e.bodyweight ? "bodyweight" : "weights"; }
function renderEditor() {
  const ws = workouts(), sch = schedule();
  const wHtml = Object.entries(ws).map(([wid, w]) => {
    const days = DAYS.map(([lbl, n]) => `<button class="daybtn ${sch[n] === wid ? "on" : ""}" data-action="w-day" data-w="${wid}" data-day="${n}">${lbl}</button>`).join("");
    const exs = w.exercises.map((e, i) => `
      <div class="ed-ex">
        <div class="ed-row">
          <input class="ed-name" data-ef="name" data-w="${wid}" data-e="${e.id}" value="${esc(e.name)}" aria-label="Exercise name">
          <button class="mini" data-action="e-move" data-d="-1" data-w="${wid}" data-e="${e.id}" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
          <button class="mini" data-action="e-move" data-d="1" data-w="${wid}" data-e="${e.id}" ${i === w.exercises.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
          <button class="mini danger" data-action="e-del" data-w="${wid}" data-e="${e.id}" aria-label="Delete exercise">✕</button>
        </div>
        <details class="ed-more"><summary>${e.sets} × ${e.min === e.max ? e.min : e.min + "–" + e.max} ${esc(e.unit)} · ${{ weights: "weights", bodyweight: "bodyweight", assisted: "assisted" }[exKind(e)]}${e.video ? " · custom link" : ""} <span class="ed-edit">✎ edit</span></summary>
        <div class="ed-grid">
          <label class="field"><span>Sets</span><input inputmode="numeric" data-ef="sets" data-w="${wid}" data-e="${e.id}" value="${e.sets}"></label>
          <label class="field"><span>Min</span><input inputmode="numeric" data-ef="min" data-w="${wid}" data-e="${e.id}" value="${e.min}"></label>
          <label class="field"><span>Max</span><input inputmode="numeric" data-ef="max" data-w="${wid}" data-e="${e.id}" value="${e.max}"></label>
          <label class="field"><span>Unit</span><select class="select" data-ef="unit" data-w="${wid}" data-e="${e.id}">
            ${["reps", "sec", "min", "each side"].map((u) => `<option ${e.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select></label>
        </div>
        <div class="ed-grid2">
          <label class="field"><span>Type</span><select class="select" data-ef="kind" data-w="${wid}" data-e="${e.id}">
            ${[["weights", "Weights (kg)"], ["bodyweight", "Bodyweight (+kg)"], ["assisted", "Assisted (kg help)"]].map(([v, l]) => `<option value="${v}" ${exKind(e) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field"><span>Tutorial link (optional)</span><input type="url" data-ef="video" data-w="${wid}" data-e="${e.id}" value="${esc(e.video || "")}" placeholder="YouTube search if empty" autocapitalize="off"></label>
        </div>
        <label class="check small"><input type="checkbox" data-ef="shoulder" data-w="${wid}" data-e="${e.id}" ${e.shoulder ? "checked" : ""}><span>Shoulder caution tag</span></label>
        </details>
      </div>`).join("");
    return `<section class="card" id="w-${wid}">
      <label class="field"><span>Workout name</span><input class="ed-wname" data-wf="name" data-w="${wid}" value="${esc(w.name)}"></label>
      <label class="field"><span>Focus</span><input data-wf="focus" data-w="${wid}" value="${esc(w.focus || "")}" placeholder="e.g. Chest + Triceps"></label>
      <div class="field"><span>Training days</span><div class="days">${days}</div></div>
      ${exs || `<p class="muted small">No exercises yet.</p>`}
      <button class="btn full" data-action="e-add" data-w="${wid}">+ Add exercise</button>
      <button class="btn danger full mt" data-action="w-del" data-w="${wid}">Delete “${esc(w.name)}” workout</button>
    </section>`;
  }).join("");
  return `
  <div class="datebar"><button class="icon-btn" data-action="edit-close" aria-label="Back">‹</button><div class="date-mid"><div class="date-main">Edit workouts</div><div class="date-sub">Changes save automatically</div></div><span style="width:44px"></span></div>
  ${wHtml || `<p class="muted center">No workouts. Add one below.</p>`}
  <button class="btn btn-primary full" data-action="w-add">+ Add new workout</button>
  <button class="btn full mt" data-action="edit-close">Done</button>
  ${data.plan ? `<button class="link danger mt" data-action="plan-reset">Reset workouts to the original plan</button>` : ""}
  <p class="muted small">Deleting a workout or exercise keeps your logged history.</p>`;
}

function renderCloud() {
  const connected = S.syncConfigured(sync);
  const fileUrl = connected ? `https://github.com/${sync.repo}/blob/${sync.branch || "HEAD"}/${sync.path}` : "";
  if (connected) {
    return section("☁ Cloud save (GitHub)", `
      <div class="advice ${syncState.status === "err" ? "warn" : "good"}">Connected to <b>${esc(sync.repo)}</b>. Every change is saved to <code>${esc(sync.path)}</code>.</div>
      ${syncState.publicRepo ? `<div class="advice warn">⚠ This repository is <b>public</b>, so anyone can see your data. On GitHub, open the repo → Settings → scroll down → <i>Change visibility</i> → Private.</div>` : ""}
      <label class="check"><input type="checkbox" id="gh-auto" data-action="gh-auto" ${sync.auto ? "checked" : ""}><span>Save automatically after each change</span></label>
      <div class="row2"><button class="btn btn-primary" data-action="gh-sync">Sync now</button><a class="btn center" href="${esc(fileUrl)}" target="_blank" rel="noopener">Open data file</a></div>
      <p class="small" id="sync-msg">${esc(syncMessage())}</p>
      <p class="small muted">On another phone or computer, open the app, go to Data and connect with the same repo name and token. Your data will load there.</p>
      <button class="link danger" data-action="gh-disconnect">Disconnect on this device</button>`);
  }
  return section("☁ Cloud save (GitHub)", `
    <p class="small">Right now your data is saved <b>only on this phone</b>. Connect your GitHub account (it's free) and everything is saved to a JSON file in <b>your own private repository</b>. It's saved automatically and loads on any device.</p>
    <ol class="steps">
      <li><b>Create a private repository</b> for your data.<br>
        <a class="btn small-btn" href="https://github.com/new?name=reptrack-data&visibility=private&description=My%20RepTrack%20progress%20data" target="_blank" rel="noopener">1 · Create repo on GitHub ↗</a>
        <span class="small muted">Keep the name <code>reptrack-data</code> and <b>Private</b>, then tap <i>Create repository</i>.</span></li>
      <li><b>Create an access key</b> that can only change that one repository.<br>
        <a class="btn small-btn" href="https://github.com/settings/personal-access-tokens/new?name=RepTrack&description=RepTrack%20data%20sync&contents=write" target="_blank" rel="noopener">2 · Create key on GitHub ↗</a>
        <span class="small muted">Set: <i>Expiration</i> → No expiration (or 1 year). <i>Repository access</i> → <b>Only select repositories</b> → <code>reptrack-data</code>. <i>Permissions</i> → Repository permissions → <b>Contents → Read and write</b>. Tap <i>Generate token</i>, then <b>copy</b> it.</span></li>
      <li><b>Paste it here</b> and connect.</li>
    </ol>
    <label class="field"><span>Repository name</span><input id="gh-repo" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(sync.repo || "reptrack-data")}"></label>
    <label class="field"><span>Access key (token)</span><input id="gh-token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(sync.token)}" placeholder="github_pat_…"></label>
    <button class="btn btn-primary full" data-action="gh-save">Connect &amp; save my data</button>
    <p class="small" id="sync-msg">${esc(syncState.msg || "")}</p>
    <details class="small"><summary>Advanced</summary>
      <label class="field"><span>File path</span><input id="gh-path" autocapitalize="off" spellcheck="false" value="${esc(sync.path)}"></label>
      <label class="field"><span>Branch (blank = default)</span><input id="gh-branch" autocapitalize="off" spellcheck="false" value="${esc(sync.branch)}" placeholder="main"></label>
    </details>
    <p class="small muted">Your key is stored only in this browser. It is never put in the data file or sent anywhere except GitHub.</p>`);
}

/* ---------- SETTINGS ---------- */
function renderSettings() {
  const p = data.profile;
  const nDays = Object.keys(data.days).length;
  return `
  ${renderCloud()}
  ${section("Profile", `
    <div class="row3">
      <label class="field"><span>Start kg</span><input inputmode="decimal" data-profile="startWeight" value="${esc(p.startWeight)}"></label>
      <label class="field"><span>Target kg</span><input inputmode="decimal" data-profile="targetWeight" value="${esc(p.targetWeight)}"></label>
      <label class="field"><span>Height cm</span><input inputmode="decimal" data-profile="height" value="${esc(p.height)}"></label>
    </div>`)}
  ${section("Backup file", `
    <p class="small">${nDays} day${nDays === 1 ? "" : "s"} logged. Download a backup file you can keep in Files / Drive, or restore from one.</p>
    <div class="row2"><button class="btn" data-action="export">Download backup</button><button class="btn" data-action="import">Restore backup</button></div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>`)}
  ${section("Rest timer", `
    <div class="field"><span>Default rest between sets</span><div class="seg">${[60, 90, 120, 180].map((v) => `<button class="${prefs.rest === v ? "on" : ""}" data-action="pref-rest" data-v="${v}">${v < 120 ? v + "s" : v / 60 + " min"}</button>`).join("")}</div></div>
    <label class="check"><input type="checkbox" data-action="pref-sound" ${prefs.sound ? "checked" : ""}><span>Sound when rest is over (beeps at 3-2-1, alarm at 0)</span></label>
    <button class="btn full" data-action="test-sound">🔊 Test sound</button>
    <p class="small muted">The screen stays on while the timer runs. iPhone: the ring/silent switch must be on ring for sound.</p>`)}
  ${section("Install on your phone", `<p class="small"><b>iPhone (Safari):</b> Share → <i>Add to Home Screen</i>.<br><b>Android (Chrome):</b> ⋮ menu → <i>Add to Home screen</i> / <i>Install app</i>.<br>It then opens full-screen and works offline.</p>`)}
  ${section("Danger zone", `<button class="btn danger" data-action="reset">Erase all data on this device</button>`)}
  <p class="muted small center">RepTrack · ${esc(PLAN.disclaimer)}</p>`;
}

/* ================= sync ================= */
let syncTimer = null, syncing = false, syncAgain = false;
function syncMessage() {
  if (!S.syncConfigured(sync)) return "Not connected.";
  return syncState.msg || "Connected.";
}
function renderSyncBadge() {
  const b = $("#sync-badge");
  if (!b) return;
  const st = S.syncConfigured(sync) ? syncState.status : "off";
  b.className = "sync-badge " + st;
  b.textContent = { off: "", ok: "✓ saved", busy: "⟳ syncing", err: "⚠ sync", pending: "• unsynced" }[st] || "";
  b.title = syncMessage();
  const m = $("#sync-msg");
  if (m) m.textContent = syncMessage();
}
function scheduleSync() {
  if (!S.syncConfigured(sync) || !sync.auto) return;
  syncState.status = "pending";
  renderSyncBadge();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 2500);
}
async function syncNow() {
  if (!S.syncConfigured(sync)) return;
  if (syncing) { syncAgain = true; return; }
  if (!navigator.onLine) { syncState = { ...syncState, status: "pending", msg: "Offline — will sync when back online." }; renderSyncBadge(); return; }
  syncing = true;
  syncState.status = "busy"; renderSyncBadge();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await S.pullRemote(sync);
      const before = S.canonical(data);
      const merged = remote.data ? S.merge(data, remote.data, PLAN.profileDefaults) : data;
      const remoteStr = remote.data ? S.canonical(S.merge(remote.data, remote.data, PLAN.profileDefaults)) : null;
      if (S.canonical(merged) !== before) {
        data = merged;
        S.saveLocal(data);
        if (!isTyping()) rerender();
      }
      if (remoteStr === S.canonical(merged)) { syncState.sha = remote.sha; break; }
      try {
        syncState.sha = await S.pushRemote(sync, data, remote.sha);
        break;
      } catch (e) {
        if (!e.conflict || attempt === 2) throw e;
      }
    }
    syncState.status = "ok";
    syncState.msg = `Synced to ${sync.repo}/${sync.path} at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;
  } catch (e) {
    syncState.status = "err";
    syncState.msg = "Sync failed: " + e.message;
  } finally {
    syncing = false;
    renderSyncBadge();
    if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}
function isTyping() { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); }

/* ================= events ================= */
/* ---- rest timer: beeps on 3-2-1 and a longer alarm at 0, keeps the screen on ---- */
let restTimer = null, wakeLock = null, audioCtx = null;
const prefs = (() => { try { return { rest: 90, sound: true, ...JSON.parse(localStorage.getItem("reptrack.prefs") || "{}") }; } catch { return { rest: 90, sound: true }; } })();
function savePrefs() { try { localStorage.setItem("reptrack.prefs", JSON.stringify(prefs)); } catch {} }

// Must be called from a tap so iPhone allows audio later
function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "transient"; // plays over music briefly, iOS 16.4+
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(); // silent blip to unlock
    g.gain.value = 0; o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.01);
  } catch {}
}
function beep(freq = 880, dur = 0.15, when = 0, vol = 0.6) {
  if (!prefs.sound || !audioCtx) return;
  try {
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime + when, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audioCtx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch {}
}
function finishSound() { [0, 0.25, 0.5].forEach((w) => beep(1320, 0.18, w)); beep(1760, 0.5, 0.8); }
async function keepScreenOn(on) {
  try {
    if (on && "wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}
function stopRest() {
  clearInterval(restTimer); restTimer = null;
  $("#rest").hidden = true; $("#rest").classList.remove("finished");
  document.body.classList.remove("timer-on");
  keepScreenOn(false);
}
function startRest(sec = prefs.rest) {
  const el = $("#rest");
  let end = Date.now() + sec * 1000, lastLeft = null;
  unlockAudio();
  keepScreenOn(true);
  el.hidden = false; el.classList.remove("finished");
  document.body.classList.add("timer-on");
  clearInterval(restTimer);
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    if (left !== lastLeft && left > 0 && left <= 3 && lastLeft !== null) beep(880, 0.12);
    lastLeft = left;
    $("#rest-time").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    if (left <= 0) {
      clearInterval(restTimer); restTimer = null;
      $("#rest-time").textContent = "Go! 💪";
      el.classList.add("finished");
      finishSound();
      try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch {}
      keepScreenOn(false);
      setTimeout(() => { if (!restTimer) stopRest(); }, 6000);
    }
  };
  el.onclick = (ev) => {
    const a = ev.target.closest("[data-rest]")?.dataset.rest;
    if (!a) return;
    if (a === "stop") return stopRest();
    if (!restTimer) return;
    end = Math.max(Date.now() + 1000, end + parseInt(a, 10) * 1000);
    tick();
  };
  tick();
  restTimer = setInterval(tick, 250);
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && restTimer) keepScreenOn(true); });

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-action], .tabbar button");
  if (!t) return;
  if (t.dataset.tab) {
    tab = t.dataset.tab; sessionSet("tab", tab); render(); window.scrollTo(0, 0); return;
  }
  const a = t.dataset.action, k = curDate;
  switch (a) {
    case "edit-open": tab = "edit"; sessionSet("tab", tab); render(); window.scrollTo(0, 0); break;
    case "edit-close": tab = "plan"; sessionSet("tab", tab); render(); window.scrollTo(0, 0); break;
    case "w-add": {
      const pl = editablePlan(), id = "w" + Date.now().toString(36);
      pl.workouts[id] = { name: "New workout", focus: "", exercises: [] };
      touchPlan(); render();
      const el = document.getElementById("w-" + id); el?.scrollIntoView({ behavior: "smooth" }); el?.querySelector(".ed-wname")?.select();
      break;
    }
    case "w-del": {
      const pl = editablePlan(), w = pl.workouts[t.dataset.w];
      if (!confirm(`Delete the “${w.name}” workout? Your logged history is kept.`)) break;
      for (const e of w.exercises) pl.archive[e.id] = e;
      delete pl.workouts[t.dataset.w];
      for (const d of Object.keys(pl.schedule)) if (pl.schedule[d] === t.dataset.w) delete pl.schedule[d];
      touchPlan(); rerender(); toast("Workout deleted"); break;
    }
    case "w-day": {
      const pl = editablePlan(), d = t.dataset.day;
      if (pl.schedule[d] === t.dataset.w) delete pl.schedule[d]; else pl.schedule[d] = t.dataset.w;
      touchPlan(); rerender(); break;
    }
    case "e-add": {
      const pl = editablePlan(), id = "x" + Date.now().toString(36);
      pl.workouts[t.dataset.w].exercises.push({ id, name: "New exercise", sets: 3, min: 10, max: 12, unit: "reps" });
      touchPlan(); rerender();
      const inp = document.querySelector(`.ed-name[data-e="${id}"]`); inp?.closest(".ed-ex")?.querySelector("details")?.setAttribute("open", ""); inp?.scrollIntoView({ block: "center" }); inp?.select();
      break;
    }
    case "e-del": {
      const pl = editablePlan(), list = pl.workouts[t.dataset.w].exercises, i = list.findIndex((e) => e.id === t.dataset.e);
      if (i < 0 || !confirm(`Delete “${list[i].name}”? Your logged history is kept.`)) break;
      pl.archive[list[i].id] = list[i]; list.splice(i, 1);
      touchPlan(); rerender(); break;
    }
    case "e-move": {
      const pl = editablePlan(), list = pl.workouts[t.dataset.w].exercises, i = list.findIndex((e) => e.id === t.dataset.e), j = i + +t.dataset.d;
      if (i < 0 || j < 0 || j >= list.length) break;
      [list[i], list[j]] = [list[j], list[i]];
      touchPlan(); rerender(); break;
    }
    case "plan-reset":
      if (confirm("Reset all workouts to the original plan? Your logged history is kept.")) {
        const archive = { ...(data.plan?.archive || {}) };
        for (const w of Object.values(workouts())) for (const e of w.exercises) archive[e.id] = e;
        data.plan = { ...JSON.parse(JSON.stringify({ workouts: PLAN.workouts, schedule: PLAN.schedule })), archive };
        touchPlan(); rerender(); toast("Workouts reset");
      }
      break;
    case "date": curDate = addDays(curDate, +t.dataset.d); render(); break;
    case "go-today": ev.preventDefault(); curDate = todayKey(); render(); break;
    case "open-day": curDate = t.dataset.k; tab = "today"; sessionSet("tab", tab); render(); window.scrollTo(0, 0); break;
    case "set-type":
      editDay(k, (d) => { if (t.dataset.type === plannedType(k)) delete d.type; else d.type = t.dataset.type; });
      rerender(); break;
    case "tick": {
      const ex = exById(t.dataset.ex), i = +t.dataset.i;
      let nowDone = false;
      editDay(k, (d) => {
        d.ex ||= {};
        const rec = (d.ex[ex.id] ||= { sets: Array.from({ length: ex.sets }, () => ({})) });
        const s = rec.sets[i] || (rec.sets[i] = {});
        if (!s.done) {
          const row = t.closest(".set-row");
          const wIn = row.querySelector('[data-k="w"]'), rIn = row.querySelector('[data-k="r"]');
          if (s.w == null || s.w === "") s.w = wIn.value || wIn.placeholder;
          if (s.r == null || s.r === "") s.r = rIn.value || rIn.placeholder;
        }
        s.done = !s.done;
        nowDone = s.done;
      });
      rerender();
      if (nowDone) startRest();
      break;
    }
    case "add-set": case "del-set": {
      const ex = exById(t.dataset.ex);
      editDay(k, (d) => {
        d.ex ||= {};
        const rec = (d.ex[ex.id] ||= { sets: Array.from({ length: ex.sets }, () => ({})) });
        if (a === "add-set") rec.sets.push({}); else if (rec.sets.length > 1) rec.sets.pop();
      });
      rerender(); break;
    }
    case "finish": editDay(k, (d) => { d.workoutDone = !isWorkoutDone(k); }); rerender(); if (getDay(k).workoutDone) toast("Workout saved 💪"); break;
    case "supp-all": editDay(k, (d) => { d.supp ||= {}; PLAN.supplements.filter((s) => !s.optional).forEach((s) => (d.supp[s.id] = true)); }); rerender(); break;
    case "water": editDay(k, (d) => { d.water = Math.max(0, (d.water || 0) + +t.dataset.d); }); $("#water-val").textContent = getDay(k).water; break;
    case "add-weight": {
      const w = num($("#w-val").value), dk = $("#w-date").value;
      if (w == null || w < 20 || w > 300 || !dk) { toast("Enter a valid weight"); break; }
      editDay(dk, (d) => { d.weight = w; });
      toast("Weight saved"); rerender(); break;
    }
    case "del-weight": editDay(t.dataset.k, (d) => { delete d.weight; }); rerender(); break;
    case "shop-clear": data.shopping = { items: {}, _t: Date.now() }; persist(); rerender(); break;
    case "gh-save": connectGitHub(); break;
    case "pref-rest": prefs.rest = +t.dataset.v; savePrefs(); rerender(); toast(`Rest timer: ${t.textContent}`); break;
    case "pref-sound": prefs.sound = t.checked; savePrefs(); break;
    case "test-sound": unlockAudio(); setTimeout(finishSound, 50); break;
    case "gh-auto": sync.auto = t.checked; S.saveSyncSettings(sync); break;
    case "gh-sync": syncNow(); break;
    case "gh-disconnect":
      if (confirm("Disconnect GitHub on this device? Your data stays on the phone and in the GitHub file.")) {
        sync = { ...sync, token: "" }; S.saveSyncSettings(sync); syncState = { sha: null, status: "off", msg: "" }; rerender();
      }
      break;
    case "export": exportData(); break;
    case "import": $("#import-file").click(); break;
    case "reset":
      if (confirm("Erase ALL RepTrack data on this device? (A GitHub copy, if connected, is not deleted.)") && confirm("Are you sure?")) {
        data = S.emptyData(PLAN.profileDefaults); S.saveLocal(data); rerender(); toast("Data erased");
      }
      break;
  }
});

document.addEventListener("change", (ev) => {
  const t = ev.target, k = curDate;
  const a = t.dataset.action;
  if (t.dataset.ef && (t.type === "checkbox" || t.tagName === "SELECT")) { editField(t); return; }
  if (a === "warmup") editDay(k, (d) => { (d.warmup ||= {})[t.dataset.i] = t.checked; if (!t.checked) delete d.warmup[t.dataset.i]; });
  else if (a === "supp") { editDay(k, (d) => { (d.supp ||= {})[t.dataset.id] = t.checked; }); rerenderSoon(); }
  else if (a === "meal") { editDay(k, (d) => { (d.meals ||= {})[t.dataset.id] = t.checked; }); rerenderSoon(); }
  else if (a === "shop") { data.shopping.items[t.dataset.id] = t.checked; data.shopping._t = Date.now(); persist(); }
  else if (t.id === "ex-select") { progressEx = t.value; sessionSet("progressEx", progressEx); rerender(); }
  else if (t.id === "import-file" && t.files[0]) importData(t.files[0]);
  else if (t.dataset.field || t.dataset.set) refreshSummary();
});

function rerenderSoon() { if (tab === "today") { const y = window.scrollY; render(); window.scrollTo(0, y); } }
// Update only the summary rings + nutrition line (keeps keyboard focus on mobile)
function refreshSummary() {
  if (tab !== "today") return;
  const old = $(".summary");
  if (old) { const tmp = document.createElement("div"); tmp.innerHTML = renderSummary(curDate); old.replaceWith(tmp.firstElementChild); }
  const n = dayNutrition(getDay(curDate)), line = $("#nutri-line");
  if (line) line.innerHTML = `Logged ≈ <b>${n.kcal}</b> kcal · <b>${n.protein}</b> g protein. Target ${PLAN.nutrition.calories} · ${PLAN.nutrition.protein} protein.`;
}

document.addEventListener("input", (ev) => {
  const t = ev.target, k = curDate;
  if (t.dataset.wf || (t.dataset.ef && t.type !== "checkbox" && t.tagName !== "SELECT")) { editField(t); return; }
  if (t.dataset.field) {
    editDay(k, (d) => { if (t.value === "") delete d[t.dataset.field]; else d[t.dataset.field] = t.value; });
  } else if (t.dataset.set) {
    const ex = exById(t.dataset.set), i = +t.dataset.i;
    editDay(k, (d) => {
      d.ex ||= {};
      const rec = (d.ex[ex.id] ||= { sets: Array.from({ length: ex.sets }, () => ({})) });
      (rec.sets[i] ||= {})[t.dataset.k] = t.value;
    });
  } else if (t.dataset.profile) {
    const v = num(t.value);
    if (v != null) { data.profile[t.dataset.profile] = v; data.profile._t = Date.now(); persist(); }
  }
});


function editField(t) {
  const pl = editablePlan();
  const w = pl.workouts[t.dataset.w];
  if (!w) return;
  if (t.dataset.wf) { w[t.dataset.wf] = t.value; touchPlan(); return; }
  const e = w.exercises.find((x) => x.id === t.dataset.e);
  if (!e) return;
  const f = t.dataset.ef;
  if (f === "sets" || f === "min" || f === "max") {
    const v = parseInt(t.value, 10);
    if (!isFinite(v) || v < 1) return;
    e[f] = f === "sets" ? Math.min(v, 10) : v;
    if (e.max < e.min) e.max = e.min;
  } else if (f === "kind") { e.bodyweight = t.value === "bodyweight"; e.assisted = t.value === "assisted"; }
  else if (f === "shoulder") e.shoulder = t.checked;
  else if (f === "video") { if (t.value.trim()) e.video = t.value.trim(); else delete e.video; }
  else e[f] = t.value;
  touchPlan();
}
async function connectGitHub() {
  const msg = (m) => { syncState.msg = m; const el = $("#sync-msg"); if (el) el.textContent = m; };
  let repo = $("#gh-repo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
  const token = $("#gh-token").value.trim();
  const path = ($("#gh-path")?.value.trim().replace(/^\//, "")) || "data/reptrack-data.json";
  const branch = $("#gh-branch")?.value.trim() || "";
  if (!token) return msg("Paste your access key (token) first.");
  if (!repo) return msg("Enter the repository name.");
  msg("Checking your GitHub account…");
  try {
    if (!repo.includes("/")) repo = `${await S.githubLogin(token)}/${repo}`;
    const info = await S.githubRepo(token, repo);
    sync = { repo, path, branch, token, auto: true };
    S.saveSyncSettings(sync);
    syncState.publicRepo = !info.private;
    syncState.msg = "Connected — saving your data…";
    rerender();
    await syncNow();
    if (syncState.status === "ok") toast("Connected ✓ your data is saved to GitHub");
  } catch (e) {
    msg("⚠ " + e.message);
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `reptrack-backup-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || typeof d.days !== "object") throw new Error("Not a RepTrack backup");
      const replace = confirm("Restore backup: OK = merge with current data, Cancel = abort.");
      if (!replace) return;
      data = S.merge(data, d, PLAN.profileDefaults);
      persist(); rerender(); toast("Backup restored");
    } catch (e) { toast("Could not read file: " + e.message); }
  };
  r.readAsText(file);
}

let toastT;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ================= boot ================= */
// first run: if never edited, set start date
if (!data.profile.startDate) { data.profile.startDate = todayKey(); S.saveLocal(data); }
render();
if (S.syncConfigured(sync)) {
  syncNow();
  S.githubRepo(sync.token, sync.repo).then((r) => { syncState.publicRepo = !r.private; if (tab === "settings" && !isTyping()) rerender(); }).catch(() => {});
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (isTyping()) document.activeElement.blur();
    if (curDate !== todayKey() && sessionGet("lastSeen") === curDate) curDate = todayKey();
    if (S.syncConfigured(sync)) syncNow();
    if (!isTyping()) rerender();
  } else sessionSet("lastSeen", curDate);
});
window.addEventListener("online", () => S.syncConfigured(sync) && syncNow());
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
    .then((reg) => { reg.update(); document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update()); })
    .catch(() => {});
  // When a new version takes over, reload once so you see it straight away
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !reloaded && !isTyping()) { reloaded = true; location.reload(); }
  });
}
