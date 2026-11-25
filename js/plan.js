// RepTrack plan data — taken from "Muscle Gain Plan with Suggestions" (your main plan document).
// Edit this file to change exercises, meals or supplements. Your logged data is stored separately.

export const PLAN = {
  title: "3-Day Gym + Food Plan",
  tagline: "Build muscle • Gain weight gradually • Keep the routine simple",
  profileDefaults: { startWeight: 64, targetWeight: 70, height: 169 },

  // 0 = Sunday … 6 = Saturday
  schedule: { 1: "push", 3: "pull", 5: "legs" },

  workouts: {
    push: {
      name: "Push",
      focus: "Chest + Shoulders + Triceps",
      exercises: [
        { id: "machine-chest-press", name: "Machine chest press", sets: 3, min: 10, max: 12, unit: "reps" },
        { id: "db-lateral-raise", name: "Dumbbell lateral raises", sets: 3, min: 12, max: 15, unit: "reps" },
        { id: "push-up", name: "Normal push-up", sets: 2, min: 10, max: 15, unit: "reps", bodyweight: true, shoulder: true },
        { id: "overhead-press", name: "Overhead shoulder press", sets: 2, min: 10, max: 10, unit: "reps", shoulder: true },
        { id: "incline-db-press", name: "Incline dumbbell press", sets: 2, min: 10, max: 10, unit: "reps", shoulder: true },
        { id: "bench-press", name: "Bench press", sets: 2, min: 10, max: 10, unit: "reps", shoulder: true },
      ],
    },
    pull: {
      name: "Pull",
      focus: "Back + Biceps",
      exercises: [
        { id: "assisted-pull-up", name: "Assisted pull-ups", sets: 3, min: 8, max: 10, unit: "reps", assisted: true, shoulder: true },
        { id: "seated-cable-row", name: "Seated cable row", sets: 3, min: 10, max: 12, unit: "reps" },
        { id: "neutral-lat-pulldown", name: "Neutral-grip lat pulldown", sets: 3, min: 10, max: 10, unit: "reps" },
        { id: "hammer-curl", name: "Hammer curls", sets: 3, min: 12, max: 12, unit: "reps" },
        { id: "db-biceps-curl", name: "Dumbbell biceps curls", sets: 3, min: 12, max: 12, unit: "reps" },
        { id: "dead-hang", name: "Dead hangs", sets: 2, min: 15, max: 20, unit: "sec", bodyweight: true, shoulder: true },
      ],
    },
    legs: {
      name: "Legs",
      focus: "Quads + Hamstrings + Glutes + Calves + Abs",
      exercises: [
        { id: "leg-press", name: "Leg press", sets: 3, min: 12, max: 12, unit: "reps" },
        { id: "leg-extension", name: "Leg extension", sets: 3, min: 12, max: 12, unit: "reps" },
        { id: "lying-leg-curl", name: "Lying leg curl", sets: 3, min: 12, max: 12, unit: "reps" },
        { id: "glute-bridge", name: "Glute bridge", sets: 3, min: 12, max: 12, unit: "reps" },
        { id: "calf-raise", name: "Calf raises", sets: 3, min: 15, max: 15, unit: "reps" },
        { id: "dead-bug", name: "Dead bug", sets: 3, min: 10, max: 10, unit: "each side", bodyweight: true },
        { id: "plank", name: "Plank", sets: 2, min: 20, max: 30, unit: "sec", bodyweight: true, shoulder: true },
      ],
    },
  },

  warmup: [
    "5–10 min general warm-up",
    "Shoulder: light external rotation (band/cable, elbow at side)",
    "Shoulder: scapular push-ups",
    "Light warm-up set for the first main exercises",
  ],

  howToTrain: [
    "Warm up for 5–10 minutes before lifting; use a lighter warm-up set for your first main exercises.",
    "Rest around 60–120 seconds between working sets; take longer if you need to keep good technique.",
    "Choose a weight that leaves about 1–3 good repetitions in reserve. Do not sacrifice form to lift heavier.",
    "When you can complete the top end of the rep range on every set with good form, increase the load slightly next time.",
    "Record the weight and repetitions you complete. Aim for gradual progress over weeks, not every workout.",
  ],

  safetyNotes: [
    {
      title: "Shoulder note",
      text: "Confirm the pressing, push-up, pull-up, dead-hang and plank movements with your shoulder specialist or physiotherapist before loading them. Stop if the shoulder slips, feels unstable, clicks with pain or becomes painful. Do not push through it.",
    },
    {
      title: "Breathing",
      text: "Breathe out through the hardest part of each repetition rather than holding your breath and straining. If symptoms related to your previous surgery return, stop and check with your surgeon.",
    },
  ],

  recovery: [
    { habit: "Sleep", target: "7–9 hours most nights" },
    { habit: "Rest days", target: "Tue, Thu, Sat, Sun — easy walking is fine" },
    { habit: "Hydration", target: "Drink regularly; more with heat and exercise" },
  ],

  nutrition: {
    calories: "2,500–2,600 kcal",
    protein: "110–130 g",
    proteinMin: 110,
    proteinMax: 130,
    kcalMin: 2500,
    kcalMax: 2600,
    rate: "≈0.2–0.3 kg / week",
    calorieNote:
      "2,500–2,600 kcal is a starting estimate. Follow the plan for 2 weeks and compare weekly average body weights. If your average is not rising, add about 150–200 kcal per day (extra bread, oats, rice or olive oil).",
  },

  // kcal/protein are approximate (kcal from the plan; protein estimated from the portions)
  meals: [
    { id: "breakfast", time: "08:00", name: "Breakfast", desc: "2 eggs; 100 g wholegrain bread; 20 g cheese; 1 banana; 200 ml whole milk", kcal: 650, protein: 34 },
    { id: "snack1", time: "11:00", name: "Snack", desc: "150 g plain Greek yogurt; 15 g walnuts; 1 apple or other fruit", kcal: 290, protein: 17 },
    { id: "lunch", time: "13:30", name: "Lunch", desc: "100 g dry couscous; 100 g chicken breast (raw); 150 g vegetables; 10 g olive oil", kcal: 625, protein: 37 },
    { id: "shake", time: "16:30", name: "Shake", desc: "250 ml whole milk, 1 banana, 30 g oats, 10 g peanut butter", kcal: 415, protein: 16 },
    { id: "dinner", time: "20:00", name: "Dinner", desc: "100–120 g salmon; 300 g potatoes; 150 g vegetables; 5 g olive oil", kcal: 600, protein: 30 },
  ],

  swaps: [
    "Carbs: swap couscous for pasta or rice (weigh dry), or potatoes. Start with 80–100 g dry pasta/rice/couscous or 250–350 g potatoes.",
    "Protein: rotate chicken, lean beef, salmon, tuna, eggs, Greek yogurt, cottage cheese or beans.",
    "Extra calories: add olive oil, nuts, avocado, bread or peanut butter if you need more energy.",
    "You do not need whey protein if ordinary food already gets you to your protein target.",
  ],

  recipes: [
    {
      name: "2-egg breakfast",
      ingredients: "2 eggs, 2–3 slices wholegrain bread (~100 g), 20 g cheese, 1 banana, 200 ml whole milk",
      method: "Boil or scramble the eggs; toast the bread; serve with cheese, banana and milk. Add a little olive oil if cooking the eggs in a pan.",
    },
    {
      name: "Chicken couscous bowl",
      ingredients: "100 g dry couscous, 100 g chicken breast, 150 g courgette/carrot/pepper, 10 g olive oil, salt, pepper, paprika, lemon",
      method: "Cook the chicken fully in a pan. Cook the vegetables until tender. Prepare couscous per the packet, fluff with a fork, mix with vegetables and olive oil. Serve with chicken.",
    },
    {
      name: "Tuna tomato pasta",
      ingredients: "90 g dry pasta, 1 small can tuna (drained), 100 g tomato passata, 5–10 g olive oil, garlic or herbs, optional 10 g parmesan",
      method: "Boil the pasta. Warm passata with garlic/herbs and olive oil. Stir in tuna, toss with pasta. Add parmesan if desired.",
    },
    {
      name: "Banana-oat shake",
      ingredients: "250 ml whole milk, 1 banana, 30 g oats, 10 g peanut butter",
      method: "Blend until smooth. Drink as a snack, not instead of main meals. Add ice or more milk for texture.",
    },
    {
      name: "Beef and potato plate",
      ingredients: "120 g lean beef, 300 g potatoes, 150 g vegetables, 5–10 g olive oil, rosemary, salt, pepper",
      method: "Roast or boil the potatoes. Cook beef to your preference and a safe internal temperature. Serve with vegetables and olive oil.",
    },
  ],

  shopping: {
    "Protein foods": ["Eggs", "Chicken breast", "Tuna cans", "Salmon or lean beef", "Greek yogurt", "Milk and cheese"],
    "Carbs and energy": ["Wholegrain bread", "Couscous", "Pasta", "Rice", "Potatoes", "Oats"],
    "Fruit, veg and extras": ["Bananas and apples", "Courgette, carrots, peppers", "Frozen vegetables", "Olive oil", "Walnuts", "Peanut butter"],
  },

  supplements: [
    { id: "vit-d3", name: "Vitamin D3", dose: "As prescribed / agreed with your clinician", note: "Do not increase the dose yourself. EFSA adult upper limit: 100 µg (4,000 IU)/day from all sources." },
    { id: "magnesium", name: "Magnesium", dose: "Check elemental mg on label", note: "EFSA upper limit: 250 mg/day from supplements. Higher amounts can upset the stomach." },
    { id: "zinc", name: "Zinc", dose: "Check mg on label", note: "Not a muscle builder. EFSA upper limit: 25 mg/day from all sources. Too much can block copper absorption." },
    { id: "creatine", name: "Creatine monohydrate", dose: "3–5 g", note: "Every day, any convenient time. No loading needed. May add a little water weight." },
    { id: "whey", name: "Whey protein (optional)", dose: "20–25 g protein", note: "Only when food alone does not reach your protein target.", optional: true },
  ],

  supplementGuide: [
    "Vitamin D3: keep taking it only at the dose prescribed or agreed with your clinician. EFSA adequate intake for adults is 15 µg (600 IU)/day; upper limit 100 µg (4,000 IU)/day.",
    "Magnesium: check the label for elemental magnesium. EFSA upper limit is 250 mg/day from supplements; food magnesium is not included.",
    "Zinc: avoid high-dose or long-term use unless a clinician recommends it. EFSA adult upper limit 25 mg/day from all sources. Check multivitamins too.",
    "Creatine: 3–5 g every day; loading is not required. Check with a clinician first if you have kidney disease.",
    "No extra vitamin is needed just to gain muscle. Don't routinely add multivitamin, B-complex, B12, vitamin C, iron or calcium without a reason.",
    "Check actual daily amounts on each label and avoid doubling the same nutrient across products. Ask your GP or pharmacist to review your exact products and doses.",
  ],

  weightTracking: [
    "Weigh yourself in the morning, after the bathroom and before breakfast, under similar conditions.",
    "Use 3–7 morning measurements per week and compare the weekly average; daily fluctuations are normal.",
    "Aim for roughly 0.2–0.3 kg gain per week. Reaching 70 kg may take around 4–6 months, sometimes longer.",
    "If the weekly average does not rise for 2 consecutive weeks, add 150–200 kcal each day. If it rises much faster than planned for several weeks, reduce slightly.",
  ],

  suggestions: [
    "Get shoulder clearance before week 1 — ask specifically about bench press, overhead press, dead hangs, push-ups and assisted pull-ups.",
    "Add a 5-minute shoulder warm-up: light external rotation and scapular push-ups.",
    "Stop rules: stop any exercise if the shoulder slips, feels loose, clicks with pain or dislocates.",
    "Use your real numbers (64 kg, 169 cm). Track weight for two weeks before adjusting calories.",
    "Breathe out through the hard part of each rep and avoid straining.",
    "Read supplement labels; don't double up across products; have a pharmacist review your doses.",
    "Log every session — weight and reps for each set. This shows when to increase the load.",
  ],

  keepConsistent:
    "The basics drive results: train regularly, add reps or load gradually, eat enough every day, include protein in each main meal and sleep well. Adjust food based on your actual weight trend.",

  disclaimer: "General fitness information, not medical advice. It does not replace a shoulder or medical assessment.",
};
