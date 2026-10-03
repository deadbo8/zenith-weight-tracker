# Zenith: Design & Build Plan

A comprehensive guide to redesigning Zenith (ZenithTrack) into a sleek, minimal, Apple-inspired Android app that keeps every existing feature.

Zenith's spec is already feature-complete. What separates it from "crafted by the best" is **restraint and consistency**, not more features. This plan keeps everything and changes how it is organized, revealed, and animated.

---

## Table of Contents

1. [Diagnosis: what to fix first](#1-diagnosis-what-to-fix-first)
2. [Design principles](#2-design-principles-rules-of-taste)
3. [Visual system](#3-visual-system)
4. [Navigation architecture](#4-navigation-architecture)
5. [Screen-by-screen plan](#5-screen-by-screen-plan)
6. [Charts: making them beautiful](#6-charts-making-them-beautiful)
7. [Logging flow](#7-logging-flow)
8. [Behaviors and feedback](#8-behaviors-and-feedback)
9. [New features worth adding](#9-new-features-worth-adding-and-why)
10. [Accessibility and Android polish](#10-accessibility-and-android-polish)
11. [Storage and technical hardening](#11-storage-and-technical-hardening)
12. [Feature parity map](#12-feature-parity-map-nothing-lost)
13. [Phased roadmap](#13-phased-roadmap)

---

## 1. Diagnosis: what to fix first

| Issue in current spec | Fix |
|---|---|
| Six accent colors plus a glowing FAB | One accent (green). Orange, violet and teal go away; glow shadows are removed |
| Today's hero and the "Current Weight" KPI show the same number | Merge them into one hero |
| Header tools (Metabolic, Awards) duplicate the Quick Intelligence tiles | Keep one entry point for each |
| Header holds brand, streak, units, and 4 tool icons | Large title plus streak and one settings icon |
| JetBrains Mono for numbers reads technical, not Apple-like | Inter with tabular figures |
| Photos and entries in `localStorage` | Photos will overflow the ~5-10 MB quota. Move photos to the filesystem and entries to IndexedDB or SQLite |
| `user-scalable=no` | Remove it. It breaks accessibility zoom and Android font scaling |
| Floating tooltip sits under the finger | Scrubbing updates the headline number above the chart |
| Bézier `tension: 0.35` can overshoot, drawing dips and peaks that never happened | Use monotone interpolation (see Section 6) |
| Delete uses a confirmation dialog | Delete instantly, then show an Undo snackbar |
| Days-to-target formula divides by zero when velocity is 0 | Guard the edge case and show "Not enough trend yet" |

---

## 2. Design principles ("rules of taste")

1. **One hero number per screen.** Everything else supports it.
2. **One accent.** Green means "toward your goal" and primary action, nothing else.
3. **Neutral for "away", never red.** Red is only for errors. Weight gain is not failure, especially for someone bulking.
4. **Space over lines.** Use tonal surface differences, not borders.
5. **Numbers never jump.** Tabular figures, rolling digit animation, fixed-width containers.
6. **Motion confirms, never decorates.** Nothing over 300 ms except the chart draw-in.
7. **Depth on demand.** Every advanced feature is one tap away, never on the first view.
8. **Calm copy.** No exclamation marks. Instead of "Aggressive Pace" as a warning, say "Faster than typical" with a quiet explanation.

---

## 3. Visual system

### Tokens (CSS custom properties)

```css
:root {
  --bg: #F2F2F7; --card: #FFFFFF; --raised: #FFFFFF;
  --text: #000; --text-2: #6C6C70; --hairline: rgba(0,0,0,.08);
  --accent: #34C759; --accent-text: #248A3D;
  --warn: #C93400; --error: #D70015;
  --r-sm: 12px; --r-card: 20px; --r-sheet: 28px;
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 20px; --s6: 28px;
}
:root[data-theme="dark"] {
  --bg: #000; --card: #1C1C1E; --raised: #2C2C2E;
  --text: #fff; --text-2: #A1A1A6; --hairline: rgba(255,255,255,.08);
  --accent: #30D158; --accent-text: #30D158;
  --warn: #FF9F0A; --error: #FF453A;
}
.num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "cv11" 1; }
```

### Palette summary

| Role | Dark | Light |
|---|---|---|
| Background | `#000000` | `#F2F2F7` |
| Card | `#1C1C1E` | `#FFFFFF` |
| Raised surface (sheets, chips) | `#2C2C2E` | `#FFFFFF` + soft shadow |
| Primary text | `#FFFFFF` | `#000000` |
| Secondary text | `#A1A1A6` | `#6C6C70` |
| Divider | `#FFFFFF` at 8% | `#000000` at 8% |
| Accent (buttons, chart line) | `#30D158` | `#34C759` |
| Accent as text/icons on light | n/a | `#248A3D` |
| Caution / over target | `#FF9F0A` | `#C93400` |
| Alert / error | `#FF453A` | `#D70015` |

Theme modes: **System (default)**, **Dark**, **Light**. Design dark first and derive light from it.

### Type scale (five sizes only)

Bundle Inter locally (no Google Fonts call), since the app is offline-first.

| Role | Size / weight | Use |
|---|---|---|
| Display | 56 / 600, tracking -2% | Hero weight |
| Title | 28 / 700 | Large collapsing screen titles |
| Headline | 17 / 600 | Card titles, list primary text |
| Body | 15 / 400 | Notes, descriptions |
| Caption | 13 / 500 | Secondary labels, units |

Use relative units so Android font scaling works, and test at 130% and 150%.

### Geometry

- Three radii (12, 20, 28) plus full pill.
- 4pt grid: 20px screen padding, 12px card gaps, 28px section gaps.

### Depth

- Dark mode uses surface tone only.
- Light mode uses one soft shadow (`0 1px 2px rgba(0,0,0,.04)`).
- Use blur only on the bottom bar, if at all, with a solid fallback. `backdrop-filter` is costly on mid-range phones.

### Color rules

- Green is for the primary button, chart line, and progress. Everything else is neutral.
- Color direction follows the **goal**, not the number. Movement toward goal is green; movement away is neutral gray.
- Use `#248A3D` for green text on white, since `#34C759` on white is only about 2:1 contrast.
- BMI zone colors are desaturated tints so the bar is not the loudest thing on screen.
- Optional: a "Use system accent color" toggle (Material You, Android 12+) that swaps only the green.

---

## 4. Navigation architecture

**Bottom bar: Today · Trends · [ + ] · Journey · History**

- **Journey** replaces "Milestones". It holds forecast, roadmap, photo slider, and awards.
- The center **+** stays but loses the glow. Make it 56dp with a flat accent fill and a press scale to 0.94.
- Tab bar: icon plus label, active tab filled and inactive outlined. The selected state is a small pill behind the icon (the Android convention).
- **Large collapsing titles** on every screen. The title shrinks into the app bar on scroll.
- **Settings** is a single gear or avatar icon at the top right of Today. It holds Profile & Goals, Units, Appearance, Reminders, Data & Backup, Privacy Lock, and About.
- **Units:** tap the unit label next to the hero weight (kg ↔ lb) with a haptic tick. Also available in Settings. This removes the header capsule.
- **Back behavior:** keep the existing four-step chain (close sheet → close lightbox → return to Today → minimize app). Add Android 14+ predictive back animations for sheets.
- **No swipe-between-tabs.** It collides with chart scrubbing and the system back gesture.
- Hide the bottom bar when the log sheet or keyboard is open.

---

## 5. Screen-by-screen plan

### 5.1 Today

1. **Hero card** (merges Today's Check-in and Current Weight):
   - *Logged:* big weight, small "Trend 75.2" beneath, delta chip, time, condition chips, Edit. A calm static green dot replaces the pulsing one.
   - *Pending:* "Ready when you are", the morning-consistency guidance, and a single Log button.
   - *Setting:* the headline number can be **Trend** (default) or **Scale**. Trend-first stops daily panic.
2. **Goal card:** thin progress bar, "62% · 4.6 kg to go", and one plain-language forecast line such as "On track for 12 Mar."
3. **Two compact tiles:**
   - *Pace:* weekly rate, a quiet text status, 30-day velocity.
   - *BMI:* number, category, minimalist zone bar with a dot, TDEE as secondary text.
   - Each tile has a 7-point inline SVG sparkline with no axes.
4. **Recent activity:** the last 3 entries as plain rows with hairline separators (not cards). "View all" is a text link.
5. **Insights row:** one horizontally scrollable strip with Metabolic Target, Awards, and Visual Progress as compact chips. This replaces both the tiles and the header icons.

**Weekly Review card (new, Mondays):** average, change, consistency, and one sentence of insight. It appears for the week, then collapses into History.

### 5.2 Trends

- **Headline above chart:** the big number plus date range ("75.2 kg · 30 days"), updating as you scrub.
- **View selector:** segmented control with Weight, Body, Net, Pattern. "Body Fat" becomes "Body" since it also covers lean mass.
- **Timeframe:** 7D, 30D, 90D, 6M, 1Y, ALL as small text tabs with a sliding underline. The chart morphs between ranges instead of redrawing.
- **Sub-stats strip:** Low, High, Average, Days logged, as plain captions with no boxes.
- **Context card:** one sentence plus an expandable "Why does this matter?" Never more than three lines by default.
- **Table toggle** (small icon): shows chart data as a list, for accessibility and for people who want exact numbers.

### 5.3 Journey

- **Forecast** at the top as a hero sentence ("Projected 12 Mar, 6 days ahead of target") with velocity beneath.
- **Roadmap:** vertical stepper with check rings. The current checkpoint is emphasized; completed ones fade to secondary text.
- **Photo slider:** full-bleed, 20px rounded, thin white divider with a circular handle. Haptic tick at 0%, 50%, and 100%. Tap opens the lightbox with pinch-zoom and swipe-up-to-dismiss.
- **Awards:** a horizontal row of the next 3 badges with progress rings, plus "All 12" for the full room. Locked badges are monochrome with a short hint.

### 5.4 History

- **Search icon** expands into a field (saves a permanent row). Filter chips scroll horizontally below it, and an active-filter count shows on the filter icon. Sort goes in an overflow menu.
- **Sticky month headers** with a tiny summary (average, change, entries). Rows are inset-grouped lists.
- **Gestures:** swipe left to delete (with Undo), swipe right to edit, long-press to multi-select for bulk delete.
- **Calendar heat view (new):** a month grid where each day's dot is tinted by deviation from trend, and missed days are visible.
- **Virtualize the list** once it passes about 300 rows.
- **Data & Backup** lives in Settings, with a shortcut in History's overflow menu. Clear All Data requires typing a word or holding a button.

---

## 6. Charts: making them beautiful

### Design

- **Hero series is the 7-day EMA:** 2.5px line, accent color, round caps, with a 16% → 0% vertical gradient fade.
- **Raw weigh-ins** are small 2.5px dots at about 35% opacity in neutral gray. The gap between dots and line shows the noise being filtered out.
- **Goal line:** 1px dashed neutral line with a small label chip pinned at the right edge.
- **Axes:** y-axis on the right (Apple Health convention), 3-4 faint gridlines, no vertical grid, no axis borders, 4-5 x labels maximum. Pad the y-domain 10-15% and snap to "nice" values.
- **Gaps:** if more than N days are missing, bridge with a dashed segment rather than silently connecting.
- **Annotations:** tiny markers for entries with photos or notes, and a flag at each roadmap checkpoint reached.
- **Honest curves:** use `cubicInterpolationMode: 'monotone'` and drop the tension value. It smooths without inventing peaks.

### Per-view upgrades

| View | Upgrade |
|---|---|
| **Weight** | EMA hero line, raw dots, dashed goal line with chip |
| **Body** | Replace the dual-axis plot (hard to read) with two small stacked charts sharing an x-axis: body fat on top, lean mass below |
| **Weekly Net** | Diverging bars from a zero line with 4px rounded ends. Accent = toward goal, neutral gray = away |
| **Day Pattern** | Dot-plot (lollipop) of deviation from the mean per weekday, with a faint band around zero. Clearer than bars for small differences |

### Interaction

- **Press-and-drag scrub** with a hairline crosshair and a haptic tick per data point. Use `touch-action: pan-y` so vertical page scroll still works.
- **Header values update during scrub** (date, weight, delta, note). No floating blur tooltip.
- **Pinch-zoom and pan** for ALL and 1Y.
- **Animation:** draw-in on first render (600 ms, ease-out), a morph on range change, none on scrub.
- Use Chart.js decimation (LTTB) for long histories, and read colors from CSS variables so charts re-theme instantly.

### Starter configuration (Chart.js v4)

```js
const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent');
new Chart(ctx, {
  data: { datasets: [
    { type: 'line', data: raw, showLine: false, pointRadius: 2.5,
      backgroundColor: 'rgba(235,235,245,.35)', order: 2 },
    { type: 'line', data: ema, borderColor: accent, borderWidth: 2.5,
      borderCapStyle: 'round', pointRadius: 0, pointHoverRadius: 0,
      cubicInterpolationMode: 'monotone', fill: true, order: 1,
      backgroundColor: c => {
        const { ctx, chartArea } = c.chart; if (!chartArea) return;
        const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, 'rgba(48,209,88,.16)'); g.addColorStop(1, 'rgba(48,209,88,0)');
        return g;
      } },
  ]},
  options: {
    maintainAspectRatio: false, animation: { duration: 600, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 5 } },
      y: { position: 'right', border: { display: false }, grid: { color: 'rgba(255,255,255,.06)', drawTicks: false },
           ticks: { maxTicksLimit: 4, padding: 8 }, grace: '12%' },
    },
  },
});
```

Add a small custom plugin for the crosshair and an event handler that feeds the scrubbed point into the headline.

---

## 7. Logging flow

The log sheet is the most-used interaction, so it should be the fastest.

- **Pre-filled with your last weight**, so a typical log is open, tap Save.
- **Ruler dial:** a horizontally scrolling ruler (scroll-snap with 0.1 ticks) under the hero number, with a haptic tick per step. Keep the six stepper chips (-1.0, -0.5, -0.1, +0.1, +0.5, +1.0) for fine adjustment, with long-press to repeat at accelerating speed.
- **Live context:** under the number, "+0.1 vs yesterday" updates as you adjust.
- **Progressive disclosure:** the sheet opens at half height with weight, a Today/Yesterday date chip, and condition chips. "More details" expands to full height: time, body fat, waist, notes, photo.
- **Keyboard-safe:** the sheet resizes with the IME so Save is always visible.
- **Save feedback:** success haptic, the hero number rolls to its new value, and a snackbar confirms. If a milestone or badge was just earned, show a single quiet, brief confetti burst, with no modal.
- **Photo:** camera and gallery options, compressed to about 1600px JPEG before storing.

---

## 8. Behaviors and feedback

### Snackbar instead of a Dynamic Island

A top pill is an iOS metaphor. On Android, use a pill-shaped snackbar above the bottom bar with an inline **Undo** for delete. Auto-dismiss after 4 seconds. This also removes the risk of accidental deletion.

### Haptics map

| Moment | Haptic |
|---|---|
| Tab change | Selection tick |
| Dial/stepper step, chart scrub point | Light tick |
| Open log sheet | Medium |
| Save | Success |
| Delete | Warning |
| Photo slider crossing center | Light tick |

### Motion tokens

| Token | Duration | Use |
|---|---|---|
| Tap | 120 ms | Press feedback |
| Surface | 220 ms | Sheets, cards |
| Chart | 600 ms | Chart draw-in |

For a spring feel in a WebView, use CSS `linear()` easing curves generated from a spring function. Use the View Transitions API for tab changes where available, with a plain fade as fallback.

### Empty and first-run states

A three-step onboarding (goal, units, optional reminder) ends on Today with a gentle empty hero. "Try with sample data" lives here instead of in the History data card.

### Streaks without anxiety

Keep the streak chip, but add a monthly "rest day" allowance so one missed day does not erase a 60-day streak. This reduces drop-off.

### Safety copy

Soften pace labels, and add a gentle informational note when a goal weight would put BMI under 18.5, or when loss pace exceeds roughly 1% of body weight per week. Keep the tone informational, not alarming.

---

## 9. New features worth adding (and why)

| Feature | UX benefit | Effort |
|---|---|---|
| Ruler dial log input | Fastest, most satisfying input | Medium |
| Trend-as-headline toggle | Ends water-weight panic | Low |
| Undo snackbar plus swipe actions | Safer, faster editing | Low |
| Calendar heat view | Spot consistency and gaps at a glance | Medium |
| Weekly review card | Turns data into one useful sentence | Low |
| Smart reminders (skip if logged, learn usual time) | Better habit with less nagging | Medium |
| Biometric/PIN lock | Trust for private data | Low |
| Home-screen widget (current weight + quick log) | Highest-value Android feature | High (native) |
| Notification action and Quick Settings tile | Log without opening the app | High (native) |
| Health Connect read/write | Auto-sync from smart scales, Fitbit, Samsung Health | High (native) |
| Auto-backup to a user-chosen file/Drive | Trust for long-term data | Medium |
| Goal-aware coloring (bulk/cut/maintain) | Feedback matches intent | Low |

> **Note:** The widget, Quick Settings tile, notification actions, and Health Connect all require **native Kotlin code or community Capacitor plugins**. That is normal, but it is where the "just a web app" model ends, so schedule it as a separate phase.

---

## 10. Accessibility and Android polish

- Touch targets of at least 48dp (the KG/LB capsule and ghost icon buttons were the risk).
- Contrast: use `--accent-text` (`#248A3D`) for green text on light backgrounds. Secondary text must reach 4.5:1.
- Never rely on color alone: pair delta colors with +/- signs and arrows.
- Respect `prefers-reduced-motion`, which disables draw-ins, confetti, and springs.
- Provide chart text summaries and the table toggle for TalkBack.
- Edge-to-edge layout with correct insets, themed adaptive icon, a splash screen matching the background, and a status bar that follows the theme.
- Remove `user-scalable=no` and support font scaling up to 150%.
- Optional "Use system accent" toggle for Material You.

---

## 11. Storage and technical hardening

- **Entries:** IndexedDB (or Capacitor SQLite) instead of one `localStorage` blob, which currently rewrites all data on every save.
- **Photos:** Capacitor Filesystem, with only file paths and thumbnails in the database. Generate 400px thumbnails for lists.
- **Schema versioning and migrations** (currently at `v2`), plus validation on restore.
- **Auto-backup rotation:** keep the last 3 snapshots locally.
- **Performance:** virtualize History, debounce search, avoid re-rendering charts on unrelated state changes, and test on a low-end device with `backdrop-filter` off.
- **Tests:** unit-test `analytics.js`, including EMA, streaks across DST and timezone changes, and pace forecast edge cases such as zero velocity.

---

## 12. Feature parity map (nothing lost)

| Existing feature | New home |
|---|---|
| Brand, streak chip | Today large title and streak chip |
| KG/LB toggle | Tap unit on hero, plus Settings |
| Metabolic Calculator, Awards, Theme, Profile | Insights strip, Journey, and Settings |
| Today's check-in plus Current Weight KPI | Merged hero |
| Goal Progress, Pace & Trend, BMI KPIs | Goal card plus two compact tiles |
| Recent activity, "View complete history" | Today list and link |
| Quick Intelligence tiles | Insights strip |
| 4 chart views, 6 timeframes, sub-stats, context card | Trends (same features, restyled) |
| Pace forecast, roadmap, photo slider, badges | Journey |
| Search, filters, sort, edit, delete | History |
| CSV export, JSON backup, restore, sample data, clear | Settings → Data (sample data also in onboarding) |
| Log/Edit sheet, lightbox, all 12 badges | Same, redesigned |
| Back-button chain, haptics, status bar | Kept and expanded |

---

## 13. Phased roadmap

| Phase | Focus | Key deliverables |
|---|---|---|
| 1. Foundation | Tokens and data | Design tokens, Inter, single accent, remove redundancies, fix viewport scaling, move photos and entries out of `localStorage` |
| 2. Core feel | Navigation and feedback | New nav, large titles, sheet system, snackbar with Undo, haptics map, motion tokens |
| 3. Charts | Visual signature | New styling, monotone curves, header-scrub, annotations, per-view upgrades |
| 4. Screens | Information design | Today merge, Journey, History gestures, calendar view, weekly review |
| 5. Log flow | Core interaction | Ruler dial, pre-fill, progressive disclosure |
| 6. Android-native | Platform depth | Reminders, biometric lock, widget, notification action, Quick Settings tile, Health Connect |
| 7. Polish | Release readiness | Onboarding, empty states, accessibility audit, low-end device performance, release |

### Suggested starting points

The **chart module** and the **ruler-dial log sheet** define the app's character. Build those first to set the quality bar for everything else.




newwww section


Making Zenith feel fluid, stunning, and sharp

Fluidity comes from three things: continuity (things move to where they belong instead of swapping), physics (motion that responds to your finger), and performance (a steady 60/120 fps). Here are the changes that deliver the most.

1. Navigation that flows

Shared-element transitions

Tapping a Recent Activity row should expand that row into the edit sheet, not slide a sheet up from nowhere.
Tapping the + should morph the button into the log sheet (a "container transform"), then reverse on save.
The hero weight should glide between Today and Trends, so the number visibly becomes the chart headline.

Use the View Transitions API, which Android's Chromium WebView supports. Feature-detect it and fall back to a fade:

js
function go(tab) {
  const swap = () => render(tab);
  if (!document.startViewTransition) return swap();
  document.documentElement.dataset.dir = tab > current ? 'fwd' : 'back';
  document.startViewTransition(swap);
}
css
.hero-weight { view-transition-name: hero-weight; }
::view-transition-old(root) { animation: 180ms ease-in both fade-out; }
::view-transition-new(root) { animation: 260ms var(--spring) both fade-in; }
[data-dir="fwd"]  ::view-transition-new(root) { transform: translateX(12px); }

Keep tab transitions subtle: a 12px slide plus a crossfade, never a full-width push.

Real spring physics. Springs feel alive because they overshoot slightly and settle. You can generate a CSS linear() easing from spring math, so it works in a WebView with no library:

js
export function spring({ stiffness = 180, damping = 20, mass = 1 } = {}) {
  const w0 = Math.sqrt(stiffness / mass);
  const z = damping / (2 * Math.sqrt(stiffness * mass)); // keep z < 1 (underdamped)
  const wd = w0 * Math.sqrt(1 - z * z);
  const x = t => 1 - Math.exp(-z * w0 * t) *
    (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  const dur = 4 / (z * w0), N = 40;
  const pts = Array.from({ length: N + 1 }, (_, i) => x(i / N * dur).toFixed(3));
  return { easing: `linear(${pts.join(',')})`, ms: Math.round(dur * 1000) };
}
// document.documentElement.style.setProperty('--spring', spring().easing)

Define two presets and use them everywhere: snappy (stiffness 300, damping 26) for taps and chips, and gentle (stiffness 170, damping 20) for sheets and cards.

Collapsing large titles, driven by scroll. Scroll-driven animations run off the main thread, so they stay smooth:

css
@supports (animation-timeline: scroll()) {
  .title-large { animation: collapse linear both; animation-timeline: scroll(); animation-range: 0 72px; }
  @keyframes collapse { to { transform: translateY(-8px) scale(.62); opacity: 0; } }
  .title-small { animation: reveal linear both; animation-timeline: scroll(); animation-range: 40px 72px; }
  @keyframes reveal { from { opacity: 0 } to { opacity: 1 } }
}

Gesture-driven sheets

The sheet should follow the finger 1:1 while dragging, then settle with velocity-aware spring physics.
Add snap points (peek, half, full) and rubber-banding past the limits.
Dim and scale the screen behind it by about 4%, so the sheet feels like a layer above it.
Wire the system back gesture into the same animation (predictive back), so the sheet shrinks as you swipe.

Details that sell it

Selected tab: the indicator pill slides between tabs rather than fading in and out.
Icons do a tiny scale pop (1 → 1.12 → 1) on select, with the haptic tick fired at the same instant.
List rows enter with a 20 ms stagger (first 8 only), and deleted rows collapse their height smoothly.
Never block input during an animation. Everything should be interruptible.
2. Performance rules (this is what makes it feel native)
Animate only transform and opacity. Animating height, top, box-shadow, or filter causes layout jank.
Use will-change only on elements currently animating, and remove it afterwards.
Never animate backdrop-filter. Keep blur static, and use a solid color on low-end devices.
Keep chart canvases at devicePixelRatio but cap it at 2.5 on dense phones.
Add contain: layout paint to cards so updates don't reflow the page.
Test on a mid-range phone with the profiler. If anything drops below 60 fps there, simplify it.
Respect prefers-reduced-motion: replace springs with 100 ms fades.
3. Charts that look designed

Signature look

Line draws itself in left to right (a clip-path reveal, 600 ms), with dots fading in after it passes.
Segment-aware color: the line is accent green where the trend moves toward your goal and a neutral gray where it moves away, with a smooth blend between.
Raw dots and EMA line together, so the filtered signal is visible against the noise.
Forecast cone: from the latest point, a dashed projection runs to the goal, with a faint widening band for uncertainty. A small chip at the end says "~12 Mar". This is the most elegant way to show Smart Pace Forecasting.
Goal zone: a barely-there tinted band around the goal weight (±0.5 kg) so reaching it feels visible.
Annotations: small ticks for photo entries and notes. Tapping one opens the entry.
Typography on the chart: 11-12 px tabular figures, secondary-gray, with the latest value labeled at the line's end.

Scrubbing that feels magnetic

A hairline crosshair snaps to the nearest data point with a 100 ms ease. The dot on the line scales up a little.
A light haptic fires once per point crossed (only when the index changes).
The headline above the chart updates live, and the digits roll rather than jump.
js
const crosshair = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const el = chart.getActiveElements()[0]; if (!el) return;
    const { x, y } = el.element, { top, bottom } = chart.chartArea, c = chart.ctx;
    c.save();
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, top); c.lineTo(x, bottom); c.stroke();
    c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
    c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
    c.restore();
  }
};
// onHover: if (idx !== lastIdx) { haptic('light'); updateHeadline(idx); lastIdx = idx; }

Range changes should morph. When switching 30D to 90D, interpolate the existing points to their new positions instead of clearing and redrawing. Chart.js animates data updates if you mutate chart.data and call chart.update() rather than creating a new chart.

Performance upgrade. Chart.js is fine up to a few thousand points. For long histories with pinch-zoom, consider uPlot (very fast, tiny) or a small custom canvas renderer, since your charts are simple.

Per-view polish

Body: two stacked small charts sharing one scrubber, so scrubbing updates both.
Weekly Net: diverging bars that grow from the zero line with a staggered spring.
Day Pattern: lollipops that "pop" up in sequence, Monday to Sunday, with the lowest and highest days labeled.
4. Data that explains itself

Fancy charts matter less than whether the data tells people something. Add a thin insight layer:

Plain-language headline over each chart: "Down 1.2 kg this month, steady" or "Holding steady for 9 days." Generate it from velocity and variance.
Plateau detection: if the 14-day EMA slope is near zero, say so and add context ("Plateaus this long are common; weekly average is still moving"). No red, no warnings.
Comparisons: "This week vs last week" and "This month vs last month" as small delta rows, not extra charts.
Consistency score: a ring showing days logged in the last 30, which rewards habit rather than weight.
Best-time insight: "You're usually lightest on Wednesdays," drawn from Day Pattern.
Range summary on drag: if the user drags across a span, show change, average, and rate for that selection.
Calendar heat view in History, tinted by deviation from trend.
Weekly review card each Monday (average, change, one sentence).

Show numbers with context. "75.2 kg" is a number. "75.2 kg, 0.3 below last week" is information.

5. Delightful micro-interactions
Moment	Interaction
Weight changes	Digits roll vertically, each column on its own, with a short stagger
Progress bar	Fills with a spring on screen entry, and a subtle sheen passes once
Log saved	The hero number rolls, the delta chip pops in, and the FAB returns with a tiny bounce
Badge unlocked	Brief confetti and a quiet haptic, then the badge slides into the Journey row
Pull to refresh	Not needed, since data is local. Use pull-down on Trends to jump to "Today" instead
Unit swap	The number crossfades with a vertical roll, and tick is felt
Empty states	One calm illustration (a line that draws itself) and one action

A compact number roll, if you want something simple first:

js
export function rollTo(el, to, ms = 550, dp = 1) {
  const from = parseFloat(el.dataset.v ?? to), t0 = performance.now();
  const ease = t => 1 - Math.pow(2, -10 * t);
  (function tick(now) {
    const t = Math.min((now - t0) / ms, 1);
    el.textContent = (from + (to - from) * ease(t)).toFixed(dp);
    if (t < 1) requestAnimationFrame(tick); else el.dataset.v = to;
  })(t0);
}

For the premium version, render each digit as a vertical strip (0-9) and translate it. It feels more like an odometer than a counter.

6. Functional upgrades that raise the ceiling
Command bar: one search field that finds entries, jumps to dates, and runs actions ("export CSV", "go to Trends"). It reduces navigation depth.
Range-select on charts (long-press and drag) to see stats for any window.
Compare overlay: draw last month's trend as a faint ghost line behind the current one.
Smart log defaults: pre-fill your last weight, usual time, and the condition you most often pick on that weekday.
Quick log from anywhere: widget, notification action, and Quick Settings tile.
Health Connect sync so scale data arrives without effort.
Share card: generate a clean progress image (chart plus start/now/goal, no personal details) for sharing.
Biometric lock with a quick blur-out when the app is backgrounded.
7. Where to start (biggest wow per effort)
Spring tokens and tab transitions (View Transitions plus the spring helper). The whole app feels different within a day.
Scrub with crosshair, haptics, and a live headline. Instantly premium.
Chart draw-in, range morph, and the forecast cone. Your signature visuals.
Rolling numbers on the hero and the log sheet.
Gesture-driven sheet with snap points and the FAB container transform.
Insight layer (headlines, plateau detection, comparisons).
Scroll-collapsing large titles and list stagger.
8. Pitfalls to avoid
Too much motion. If everything animates, nothing feels special. Reserve the richest animation for logging, scrubbing, and goal progress.
Blur and shadows everywhere. They look great on a flagship and stutter on a mid-range phone.
Long durations. Anything over about 300 ms (apart from the chart draw-in) feels sluggish.
Features that fight gestures. Swipe-between-tabs conflicts with chart scrubbing and Android's back gesture, so skip it.
Decorative color. Keeping a single accent is what keeps the charts elegant.