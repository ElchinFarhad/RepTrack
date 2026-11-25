# RepTrack

A mobile-first web app for following a 3-day muscle-gain plan (workouts, supplements and meals) every day and recording your progress. It's built from *Muscle Gain Plan with Suggestions*.

**Live app:** https://elchinfarhad.github.io/RepTrack/

## Features

- **Today**: shows the day's workout (Mon Push / Wed Pull / Fri Legs, other days are rest days). You can switch it if you train on a different day.
  - Warm-up checklist, including the shoulder warm-up.
  - **▶ How to do it**: every exercise has a tutorial video link. It opens a YouTube search for that exercise's proper form, or your own link if you set one.
  - Log weight and reps for each set. Your previous session is shown as a hint, and tapping ✓ fills it in.
  - A rest timer starts automatically after each set.
  - A "⬆ increase the load" hint appears when you hit the top of the rep range on every set last time.
  - Supplements checklist (D3, Magnesium, Zinc, Creatine, optional Whey).
  - Meals checklist with approximate kcal and protein against your 2,500–2,600 kcal and 110–130 g targets.
  - Morning weight, sleep, water and notes.
- **Progress**:
  - Weight chart with daily points, weekly average and target line.
  - kg/week trend, kg to go and an estimated number of weeks.
  - Automatic calorie advice using the plan's rule: add 150–200 kcal if the weekly average doesn't rise for 2 weeks.
  - Weekly consistency stats and a 5-week calendar.
  - A progress chart and history for each exercise.
- **Edit workouts** (Plan → *Add, edit or delete workouts*):
  - Add new workout types, such as Cardio or Upper body, or delete workouts.
  - Choose which days of the week each workout is on.
  - Add, delete or reorder exercises and change their sets, rep range, unit (reps / sec / min / each side) and type (weights / bodyweight / assisted).
  - Set your own tutorial link for an exercise.
  - Deleting something keeps your logged history, and you can reset to the original plan at any time.
  - Your edited workouts are saved and synced together with your data.
- **Plan**: the full document in collapsible sections (workouts, how to train, recovery, food plan, recipes, a shopping list you can tick off, supplements, weight tracking, suggestions).
- **Data**:
  - Profile (start, target, height).
  - **Save to a JSON file in a GitHub repo** so your data is backed up and the same on every device.
  - Download or restore a backup file.
- Works offline and can be installed on your home screen (PWA).

## Where your data is stored

1. **On your phone**, in the browser's local storage. This happens automatically and works offline.
2. **In a file on GitHub** (optional, recommended). In the app go to **Data → Save to a file on GitHub**:
   - Create a **private** repo, e.g. `reptrack-data`.
   - Create a fine-grained personal access token with access to only that repo and **Contents: Read and write**.
   - Enter `yourname/reptrack-data` and the token, then tap **Save & sync**.

   Every change is then committed to `data/reptrack-data.json` in that repo. If you use more than one device, changes are merged day by day. The token stays in your browser only.
3. **Backup file**: **Data → Download backup** gives you a `.json` file you can keep in Files or Drive.

> Keep your logged data in a **private** repo, not in this public app repo.

## Changing the plan

The easiest way to change your workouts is in the app: **Plan → Add, edit or delete workouts**. The original plan (exercises, meals, supplements and texts) is in [`js/plan.js`](js/plan.js). Your logged data is separate and isn't affected by changes to it.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. There's no build step; the app is plain HTML, CSS and JS.

## Deploy (GitHub Pages)

Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then choose the branch and `/ (root)`.

---

*General fitness information, not medical advice. Confirm the shoulder-loading exercises with your specialist.*
