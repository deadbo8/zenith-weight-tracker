# Zenith 2.0 (ZenithTrack) — Complete Technical, Functional & Design Specification

> **Zenith 2.0** is a high-craft, precision weight and body intelligence application engineered with an **Apple Health minimalist aesthetic** and tailored specifically for a **native Android mobile experience** via Capacitor 8. Zenith 2.0 unifies three core modules—**Weight + Fuel + You**—into a private, offline-first health tracking ecosystem with on-device AI meal intelligence powered by Gemini.

---

## Table of Contents
1. [Product Overview & Architectural Philosophy](#1-product-overview--architectural-philosophy)
2. [Design System & Visual Language (Apple Precision)](#2-design-system--visual-language-apple-precision)
   - [2.1 Color Palette & Semantic Color Discipline](#21-color-palette--semantic-color-discipline)
   - [2.2 Typography & Tabular Figures](#22-typography--tabular-figures)
   - [2.3 Squircle Geometry & Elevation](#23-squircle-geometry--elevation)
   - [2.4 Spring Motion Physics & Fluid Transitions](#24-spring-motion-physics--fluid-transitions)
3. [Mathematical & Analytical Engine](#3-mathematical--analytical-engine)
   - [3.1 7-Day Exponential Moving Average (EMA)](#31-7-day-exponential-moving-average-ema)
   - [3.2 Velocity & Smart Pace Forecasting](#32-velocity--smart-pace-forecasting)
   - [3.3 Body Mass Index (BMI) & Reversible Ideal Range](#33-body-mass-index-bmi--reversible-ideal-range)
   - [3.4 Metabolic Energy Expenditure (BMR & Formula TDEE)](#34-metabolic-energy-expenditure-bmr--formula-tdee)
   - [3.5 Adaptive TDEE (Observed Energy Expenditure)](#35-adaptive-tdee-observed-energy-expenditure)
   - [3.6 Forecast "What-If" Calorie Simulator](#36-forecast-what-if-calorie-simulator)
   - [3.7 Day-of-Week Biological Noise Profiling](#37-day-of-week-biological-noise-profiling)
   - [3.8 Local Calendar Consecutive Streaks](#38-local-calendar-consecutive-streaks)
   - [3.9 20-Achievement Milestone & Fuel Badge Registry](#39-20-achievement-milestone--fuel-badge-registry)
4. [Application Structure & 5-Tab Navigation](#4-application-structure--5-tab-navigation)
   - [4.1 Global App Header & Avatar Button](#41-global-app-header--avatar-button)
   - [4.2 Screen 1: Today (Authoritative Check-in, Today Fuel & KPIs)](#42-screen-1-today-authoritative-check-in-today-fuel--kpis)
   - [4.3 Screen 2: Trends (Bézier Chart, Daily Intake Bars & Context Insights)](#43-screen-2-trends-bézier-chart-daily-intake-bars--context-insights)
   - [4.4 Screen 3: Fuel (Energy Ring, Macro Bars, Day Strip, Timeline & AI Chat)](#44-screen-3-fuel-energy-ring-macro-bars-day-strip-timeline--ai-chat)
   - [4.5 Screen 4: Journey (Segmented Progress / History, Roadmap, What-If & Photo Slider)](#45-screen-4-journey-segmented-progress--history-roadmap-what-if--photo-slider)
   - [4.6 Screen 5: You (Cupertino Profile, Goals, Calm Mode, AI Key & Sovereignty)](#46-screen-5-you-cupertino-profile-goals-calm-mode-ai-key--sovereignty)
5. [Contextual FAB & Staggered Spring Speed-Dial](#5-contextual-fab--staggered-spring-speed-dial)
6. [Modal Sheets, Calipers & Tactile Interaction System](#6-modal-sheets-calipers--tactile-interaction-system)
   - [6.1 Log Weight Bottom Sheet with Fixed-Needle Center-Snap Ruler Dial](#61-log-weight-bottom-sheet-with-fixed-needle-center-snap-ruler-dial)
   - [6.2 Swipe-Down Sheet Dismissal Gesture & Dirty-State Protection](#62-swipe-down-sheet-dismissal-gesture--dirty-state-protection)
   - [6.3 Safe Numerical Formatters & Empty State Handling](#63-safe-numerical-formatters--empty-state-handling)
   - [6.4 Unified FieldNumber Input Component](#64-unified-fieldnumber-input-component)
   - [6.5 Direct Native Camera Pipeline & Storage](#65-direct-native-camera-pipeline--storage)
   - [6.6 Fullscreen Awards & Badges Room](#66-fullscreen-awards--badges-room)
   - [6.7 Photo Lightbox & Split Progress Slider](#67-photo-lightbox--split-progress-slider)
   - [6.8 Pill-Shaped Undo Snackbars](#68-pill-shaped-undo-snackbars)
7. [AI Layer & Gemini Integration (Bring Your Own Key)](#7-ai-layer--gemini-integration-bring-your-own-key)
   - [7.1 BYOK Security Architecture & WebCrypto AES-GCM](#71-byok-security-architecture--webcrypto-aes-gcm)
   - [7.2 Multimodal Analysis & Intent Router](#72-multimodal-analysis--intent-router)
   - [7.3 Atwater Consistency & Schema Validation](#73-atwater-consistency--schema-validation)
   - [7.4 Offline Queue & Auto-Retry on Reconnect](#74-offline-queue--auto-retry-on-reconnect)
   - [7.5 24-Hour SHA-256 Hash Cache](#75-24-hour-sha-256-hash-cache)
8. [Android Native Bridge & Ergonomics](#8-android-native-bridge--ergonomics)
   - [8.1 Android Hardware Back Button State Machine](#81-android-hardware-back-button-state-machine)
   - [8.2 Capacitor Haptics Protocol](#82-capacitor-haptics-protocol)
   - [8.3 Status Bar Dynamic Theming & Safe Areas](#83-status-bar-dynamic-theming--safe-areas)
   - [8.4 Keyboard Inset Protection & Resize Handling](#84-keyboard-inset-protection--resize-handling)
9. [Data Layer, Persistence & Sovereignty](#9-data-layer-persistence--sovereignty)
   - [9.1 Schema v3 Architecture (`zenith_db_v3`)](#91-schema-v3-architecture-zenith_db_v3)
   - [9.2 Lossless v2 to v3 Migration](#92-lossless-v2-to-v3-migration)
   - [9.3 Backup, Restore & CSV/JSON Export](#93-backup-restore--csvjson-export)
10. [Bug Remediation & QA Playbook History](#10-bug-remediation--qa-playbook-history)
11. [Repository File Index](#11-repository-file-index)
12. [Build, Deployment & APK Distribution](#12-build-deployment--apk-distribution)

---

## 1. Product Overview & Architectural Philosophy

Human body weight is subject to high biological noise. Due to fluctuations in fluid retention, glycogen stores, sodium intake, and digestion, scale weight can deviate by **0.5 kg to 1.5 kg in a single 24-hour window**. Traditional fitness applications exacerbate anxiety by treating daily scale swings as real fat loss or muscle gain, prompting premature diet abandonment or disordered weighing rituals.

**Zenith 2.0** unifies body weight tracking and nutritional awareness into a cohesive 3-module ecosystem (**Weight + Fuel + You**):

```
                 ┌─────────────────────────  YOU  ─────────────────────────┐
                 │  profile · goals · diet · units · AI key · privacy       │
                 └───────────────┬───────────────────────────┬──────────────┘
                                 │ targets, units, context   │
                                 ▼                           ▼
        ┌────────────────  WEIGHT  ──────────────┐   ┌───────────────  FUEL  ───────────────┐
        │ entries · EMA trend · pace · forecast   │◄─►│ chat · photos · meals · macros · water │
        └──────────────────┬──────────────────────┘   └──────────────────┬───────────────────┘
                           │      adaptive TDEE · energy balance          │
                           ▼                                              ▼
              TODAY · TRENDS · JOURNEY (Progress + History) · Awards · Weekly review
```

### Core Tenets of Zenith 2.0
1. **Signal over Noise**: The 7-Day Exponential Moving Average (EMA) remains the authoritative measure of physiological progress, with raw scale readings framed as contextual observations.
2. **Apple Health Minimalist Discipline**: Built with Apple Health Activity Green (`#30D158`), OLED pure blacks, 48dp minimum touch targets, and restrained neutral grays. Movement away from goal or calories over target is rendered in neutral gray—**red is strictly reserved for destructive deletion actions**.
3. **Privacy & Bring-Your-Own-Key (BYOK)**: Zero third-party analytics, zero tracking SDKs, zero forced account registration. Users supply their personal Google Gemini API key, stored encrypted on-device via WebCrypto AES-GCM. The key is never logged, never transmitted to external servers, and never included in backups.
4. **Offline-First Resilience**: All core logging functions (manual food entry, weight entry, water tracking, charts, historical analysis) work 100% offline. AI queries are queued and automatically retried upon reconnection.

---

## 2. Design System & Visual Language (Apple Precision)

The design system is defined in `src/style.css` and strictly adheres to Apple Human Interface Guidelines and Material 3 motion physics.

### 2.1 Color Palette & Semantic Color Discipline

```css
:root {
  /* Apple Neutral Dark Palette */
  --bg-main: #000000;              /* True OLED Pure Black */
  --bg-surface: #1c1c1e;           /* Cupertino Inset Surface */
  --bg-surface-elevated: #2c2c2e;  /* Floating Card Surface */
  --bg-surface-hover: #262629;     /* Subtle Touch State */
  --bg-glass: rgba(28, 28, 30, 0.78);
  --bg-glass-elevated: rgba(44, 44, 46, 0.88);

  /* Subtle Borders */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-medium: rgba(255, 255, 255, 0.14);
  --border-active: rgba(48, 209, 88, 0.5);

  /* Typographic Contrast */
  --text-primary: #ffffff;
  --text-secondary: rgba(235, 235, 245, 0.60);
  --text-muted: rgba(235, 235, 245, 0.38);
  --text-tertiary: rgba(235, 235, 245, 0.25);
  --text-inverse: #000000;

  /* Single Vibrant Accent — Apple Health Activity Green */
  --accent-primary: #30d158;
  --accent-primary-hover: #28b84d;
  --accent-primary-subtle: rgba(48, 209, 88, 0.12);
  --accent-text: #30d158;

  /* Fuel Specific Tokens */
  --ring-track: rgba(255, 255, 255, 0.08);
  --ring-over:  rgba(235, 235, 245, 0.32); /* Neutral gray lap for overage, never red */
  --macro-protein: #30d158;                /* Green */
  --macro-carbs:   #0a84ff;                /* Blue */
  --macro-fat:     #ffd60a;                /* Amber */
  --macro-water:   #64d2ff;                /* Light blue */

  /* Destructive Actions Only */
  --color-error: #ff453a;
}
```

### 2.2 Typography & Tabular Figures
Zenith utilizes the system font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Roboto", sans-serif`) with strict OpenType tabular numbers (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`). Numbers never jitter or produce layout shifts during scrubber interactions or animated rollups.

### 2.3 Squircle Geometry & Elevation
- Primary cards: `border-radius: 18px` with hairline borders (`1px solid var(--border-subtle)`).
- Secondary tiles: `border-radius: 14px`.
- Pills & Buttons: `border-radius: 9999px`.
- Minimum hit target: **48dp × 48dp** across all touch surfaces.

### 2.4 Spring Motion Physics & Fluid Transitions
All transitions are GPU-accelerated via `transform` and `opacity` exclusively. Zenith utilizes an Apple fluid spring curve (`cubic-bezier(0.32, 0.72, 0, 1)`) for sheets, speed-dial actions, and tab transitions. Animated blurs and expensive layout reflows are strictly avoided. Full support for `prefers-reduced-motion` collapses transitions to instant opacity fades.

---

## 3. Mathematical & Analytical Engine

The pure analytical algorithms in `src/analytics.js` and `src/nutrition.js` provide deterministic, test-covered metrics.

### 3.1 7-Day Exponential Moving Average (EMA)
Weight smoothing utilizes a 7-day EMA with smoothing factor $\alpha$:
$$\alpha = \frac{2}{N + 1} = \frac{2}{7 + 1} = 0.25$$
For any new chronologically ordered entry $t$:
$$\text{EMA}_t = \alpha \cdot \text{Weight}_t + (1 - \alpha) \cdot \text{EMA}_{t-1}$$
Missing logging days retain the prior EMA value, preventing artificial step-function jumps.

### 3.2 Velocity & Smart Pace Forecasting
Weekly rate of change is calculated over a rolling 30-day window using linear least-squares regression across verified EMA data points. Goal arrival dates are projected by dividing the remaining distance by the weekly velocity:
$$\text{Days Remaining} = \frac{|\text{Current Weight} - \text{Goal Weight}|}{|\text{Weekly Velocity (kg/day)}|}$$
If velocity is zero or in the opposite direction of the goal, the forecast calmly indicates `"Holding steady towards goal"`, never rendering `Infinity` or `NaN`.

### 3.3 Body Mass Index (BMI) & Reversible Ideal Range
$$\text{BMI} = \frac{\text{Weight (kg)}}{(\text{Height (m)})^2}$$
Zenith calculates the healthy weight bounds ($\text{BMI } 18.5 - 24.9$) reversibly for the user's height:
$$\text{Min Ideal Weight} = 18.5 \times (\text{Height (m)})^2, \quad \text{Max Ideal Weight} = 24.9 \times (\text{Height (m)})^2$$

### 3.4 Metabolic Energy Expenditure (BMR & Formula TDEE)
Resting Basal Metabolic Rate is determined via the Mifflin-St Jeor equation:
- **Male**: $\text{BMR} = 10 \cdot \text{weight (kg)} + 6.25 \cdot \text{height (cm)} - 5 \cdot \text{age} + 5$
- **Female**: $\text{BMR} = 10 \cdot \text{weight (kg)} + 6.25 \cdot \text{height (cm)} - 5 \cdot \text{age} - 161$

Formula TDEE is computed using activity level multipliers:
`Sedentary (1.2)`, `Lightly Active (1.375)`, `Moderately Active (1.55)`, `Active (1.725)`, `Very Active (1.90)`.

**Safety Rails**: Biological minimum floors are enforced at **1,200 kcal/day (female)** and **1,500 kcal/day (male)**. Furthermore, users under 18 or with BMI < 18.5 are restricted from automatic deficit targets.

### 3.5 Adaptive TDEE (Observed Energy Expenditure)
While formula TDEE provides a strong baseline, true metabolic expenditure varies. Zenith implements an **Adaptive TDEE** engine that blends formula predictions with empirical weight and intake observations.

**Prerequisites for Activation**:
- Minimum 14-day tracking span.
- At least 10 complete intake days in the last 28 days.
- At least 8 weigh-ins during the window.

**Calculation**:
$$\text{Observed TDEE} = \text{Average Daily Intake (kcal)} - \frac{\Delta \text{Weight (kg)} \times 7700}{\text{Days Span}}$$
The blended expenditure weights the observed value according to adherence:
$$w = \text{clamp}\left(\frac{\text{Complete Days} - 10}{18}, 0, 0.70\right)$$
$$\text{TDEE}_{\text{used}} = w \cdot \text{Observed TDEE} + (1 - w) \cdot \text{Formula TDEE}$$

### 3.6 Forecast "What-If" Calorie Simulator
Located in the Journey roadmap, the interactive What-If slider allows users to adjust daily intake between 1,200 and 3,000 kcal and observe real-time recalculation of their projected goal date based on their active TDEE.

### 3.7 Day-of-Week Biological Noise Profiling
Zenith calculates day-of-week mean deviations against the 7-day EMA, revealing systematic weekend sodium, hydration, or carbohydrate retention patterns (e.g., *"+0.4 kg average spike on Mondays"*).

### 3.8 Local Calendar Consecutive Streaks
Streaks are calculated against local calendar day boundaries ($YYYY-MM-DD$), ignoring device time-of-day. Logging before midnight sustains the streak. Fuel features a separate quiet meal streak counter.

### 3.9 20-Achievement Milestone & Fuel Badge Registry
Zenith features 20 unlockable achievements with Apple-style metallic circular glyphs:
1. `first_step`: First weigh-in logged.
2. `streak_3`: 3 consecutive daily weigh-ins.
3. `streak_7`: 7-day weigh-in streak.
4. `streak_14`: 14-day weigh-in streak.
5. `streak_30`: 30-day weigh-in streak.
6. `down_1kg`: First 1 kg lost towards goal.
7. `down_5kg`: 5 kg lost milestone.
8. `down_10kg`: 10 kg lost milestone.
9. `halfway`: 50% of the journey completed.
10. `goal_reached`: 100% of target weight attained.
11. `consistent_month`: 20 weigh-ins logged in a calendar month.
12. `photo_milestone`: First progress photo captured.
13. `first_meal`: First meal logged in Fuel.
14. `meals_7`: 7 consecutive days of meal logging.
15. `meals_30`: 30 consecutive days of meal logging.
16. `protein_7`: Daily protein target reached 7 days in a row.
17. `water_7`: Daily hydration target reached 7 days in a row.
18. `photo_meals_10`: 10 meals logged with photographic verification.
19. `on_target_14`: Calorie intake within 10% of target for 14 days.
20. `observed_tdee`: Adaptive metabolic expenditure calculation unlocked.

---

## 4. Application Structure & 5-Tab Navigation

Zenith 2.0 adopts a unified 5-tab bottom navigation structure:
**Today · Trends · [ + ] · Fuel · Journey**

### 4.1 Global App Header & Avatar Button
- Dynamic collapsing screen title.
- Right header contains the **Profile Avatar Button** (`#btn-open-you`) displaying the user's initials or photo thumbnail, which opens the **You** profile and settings screen.
- Active streak badge displays current weigh-in momentum.

### 4.2 Screen 1: Today (Authoritative Check-in, Today Fuel & KPIs)
- **Today Hero**: Authoritative check-in card displaying current EMA weight, raw scale reading, measurement timestamp, daily delta chip, and the segmented Trend | Scale toggle.
- **Today Fuel Card**: Compact calorie ring widget displaying remaining kcal, protein/carb/fat progress, and a quick **+ Log Meal** shortcut.
- **KPI Cards**: Goal progress bar, 30-day Smart Pace forecast, and BMI tile with safe empty states.
- **Recent Logs**: Quick-access list of the last 3 weigh-ins with single-tap editing.

### 4.3 Screen 2: Trends (Bézier Chart, Daily Intake Bars & Context Insights)
- **Weight Trend Chart**: High-performance Chart.js canvas rendering the smoothed 7-day EMA curve, raw scale scatter points, and goal line with timeframe selectors (`7D`, `1M`, `3M`, `6M`, `1Y`, `ALL`).
- **Daily Intake Chart**: Bar chart depicting daily calorie intake versus the energy target with neutral gray overage rendering and scrub odometer readout.
- **Sub-Stats Strip**: Highest weight, lowest weight, net change, and 30-day velocity.
- **Context Insights**: Day-of-week fluctuation patterns and plateau detection.

### 4.4 Screen 3: Fuel (Energy Ring, Macro Bars, Day Strip, Timeline & AI Chat)
- **Energy Ring Hero**: SVG multi-layer circular ring showing consumed vs remaining kcal with neutral gray over-target lap and Calm Mode support (which hides numbers and displays pure visual balance).
- **Macro Hairline Bars**: Linear progress indicators for Protein (`#30D158`), Carbs (`#0A84FF`), and Fat (`#FFD60A`) plus quick water logging pill (`+250ml`).
- **7-Day Day Strip**: Horizontal date scroller with completion dots indicating logged and finalized days.
- **Meal Timeline**: Inset sections for Breakfast, Lunch, Dinner, and Snacks featuring 44px photo thumbnails, item listings, quick `+ Add` triggers, and the **Finish Day** action.
- **Chat Layer & Multimodal Dock**: Integrated bottom composer with camera and gallery triggers, Gemini-powered meal extraction, and streaming shimmer response bubbles.

### 4.5 Screen 4: Journey (Segmented Progress / History, Roadmap, What-If & Photo Slider)
- **Top Segmented Control**: Seamless switching between **Progress** and **History**.
- **Progress View**:
  - Smart Trajectory forecast sentence.
  - Interactive **What-If Intake Simulator** slider.
  - Vertical Milestone Stepper with Apple check rings.
  - Before / After Photo Split Slider with interactive comparison divider.
  - 20-Badge Milestone Showcase with progress hints.
- **History View**:
  - Search filter, condition tags (Fasted, Post-Workout, Normal, High-Carb), and chronological sorting.
  - Grouped check-in cards with inline edit and delete actions.
  - GitHub-style 365-day calendar frequency heat map.

### 4.6 Screen 5: You (Cupertino Profile, Goals, Calm Mode, AI Key & Sovereignty)
Accessible via the header avatar button, **You** provides full profile configuration:
- **Profile & Body**: Height, age, biological sex, baseline start weight, and activity level.
- **Goals & Pace**: Target weight, weekly rate preference, and custom calorie overrides.
- **Nutrition Preferences**: Macro presets (Balanced, High Protein, Low Carb, Custom) and **Calm Mode** toggle.
- **Gemini AI BYOK Management**: API key input, connection tester, model tier selector (Flash, Pro, Lite), and clear cache action.
- **Display & Units**: Metric (kg/cm) vs Imperial (lb/in), Dark/OLED vs Light theme.
- **Data Sovereignty**: Lossless `.zenith` backup, JSON export, CSV export, restore, sample data loader, and complete factory reset.

---

## 5. Contextual FAB & Staggered Spring Speed-Dial

The 56dp center Floating Action Button operates contextually:
- **Single Tap on Today / Trends / Journey**: Opens the Log Weight sheet.
- **Single Tap on Fuel**: Focuses the chat composer input.
- **Long-Press or Swipe-Up on Any Tab**: Opens the **4-Action Staggered Speed-Dial**:
  1. **Log weight** (Scale icon)
  2. **Snap meal** (Camera icon)
  3. **Describe meal** (Utensils icon)
  4. **Add water** (Droplet icon)

The speed-dial features 40ms staggered spring entry, 40% black scrim, haptic tick feedback on item crossing, and instant release-to-activate ergonomics.

---

## 6. Modal Sheets, Calipers & Tactile Interaction System

### 6.1 Log Weight Bottom Sheet with Fixed-Needle Center-Snap Ruler Dial
- **Fixed Center Needle**: Positioned outside the scrolling container (`pointer-events: none; z-index: 10`), guaranteeing it never scrolls out of position.
- **Active Tick Highlighting**: The tick under the needle dynamically expands to 36px in vibrant accent green (`#30D158`), with adjacent neighbor ticks subtly elevated for optical magnification.
- **Mandatory Scroll Snap**: Uses CSS `scroll-snap-type: x mandatory` with center alignment to guarantee resting precisely on integer tenth ticks.
- **Padding & Masking**: Track includes `padding-inline: calc(50% - 6px)` ensuring boundary values reach the center needle, and CSS mask gradients dissolve ticks smoothly at the container edges.
- **Reference Marker**: Renders a neutral gray dot with label indicating the previous weigh-in (`"Last 77.8"`).

### 6.2 Swipe-Down Sheet Dismissal Gesture & Dirty-State Protection
Sheets utilize `src/components/sheetGesture.js` for natural swipe-to-dismiss behavior:
- Drag threshold requires > 100px vertical travel or flick velocity > 0.5 px/ms.
- Elements marked with `data-no-sheet-drag` (such as the horizontal ruler dial and What-If slider) are exempted from triggering sheet dismissal.
- Dirty sheets with unsaved modifications prompt a confirmation before discarding.

### 6.3 Safe Numerical Formatters & Empty State Handling
Zenith 2.0 enforces `src/format.js` across every UI rendering surface:
- Values are strictly validated via `Number.isFinite()`.
- Safe formatters (`fmt`, `fmtInt`, `safe`) return clean fallbacks (`"—"` or neutral copy).
- The string literals `null`, `undefined`, `NaN`, `Infinity`, or `[object Object]` are mathematically prevented from rendering.

### 6.4 Unified FieldNumber Input Component
The `src/components/fieldNumber.js` module standardizes body fat, waist circumference, and custom calorie inputs:
- Full localization support for both period (`.`) and comma (`,`) decimal separators.
- Tactile increment and decrement steppers with bounds clamping.
- Empty fields cleanly persist as `null` rather than invalid zeros.

### 6.5 Direct Native Camera Pipeline & Storage
The native camera bridge (`src/camera.js`) interfaces directly with `@capacitor/camera`:
- Bypasses intermediate gallery prompts to open the hardware camera shutter directly.
- Strips EXIF and GPS geolocation metadata on-device via an HTML5 Canvas pipeline.
- Exports a 1600px full JPEG (quality 0.82) and a 400px thumbnail (quality 0.70) stored in `Directory.Data/photos/` on the native filesystem, keeping database stores lean.

### 6.6 Fullscreen Awards & Badges Room
Displays all 20 achievement badges with metallic rings, unlock dates, and progress percentage meters.

### 6.7 Photo Lightbox & Split Progress Slider
Allows interactive comparative analysis of baseline and current physique photos with a draggable divider handle.

### 6.8 Pill-Shaped Undo Snackbars
Destructive actions (such as entry deletions) present a 5-second non-blocking pill snackbar with an **Undo** button.

---

## 7. AI Layer & Gemini Integration (Bring Your Own Key)

Zenith 2.0 incorporates an intelligent nutritional copilot operating under strict privacy safeguards.

### 7.1 BYOK Security Architecture & WebCrypto AES-GCM
- The user provides their personal Gemini API key in the **You** settings.
- The key is encrypted locally using the WebCrypto API with AES-GCM 256-bit encryption before saving to IndexedDB meta storage.
- The API key is strictly excluded from logs, export bundles, backups, and network payload dumps.

### 7.2 Multimodal Analysis & Intent Router
User input (text or image) is processed by the intent router in `src/ai/validate.js`:
- `log_meal`: Parses food items, portion estimates, macros, and confidence scores into an editable draft.
- `log_weight`: Extracts scale weight readings and opens a pre-filled confirmation card.
- `log_water`: Increments daily hydration totals.
- `question`: Provides nutritional and metabolic context.
- `support`: Detects distress or extreme restriction and offers empathetic, safe guidance.

### 7.3 Atwater Consistency & Schema Validation
All AI responses undergo structured schema validation and thermodynamic sanity checks:
- Recomputes total calories via the 4-4-9 Atwater general factor system:
$$\text{Atwater kcal} = 4 \cdot \text{Protein} + 4 \cdot \text{Carbs} + 9 \cdot \text{Fat}$$
- If the model's reported calories deviate from Atwater totals by more than 15%, the confidence rating is downgraded to `"rough_estimate"`.

### 7.4 Offline Queue & Auto-Retry on Reconnect
If the user captures a meal while offline, the payload is serialized into the `drafts` IndexedDB store with status `queued`. A network listener automatically replays queued items when connectivity is restored.

### 7.5 24-Hour SHA-256 Hash Cache
Queries are hashed via SHA-256 (including image byte hashes). Duplicate meal analyses within 24 hours are served instantly from cache, saving API quota and eliminating latency.

---

## 8. Android Native Bridge & Ergonomics

Zenith 2.0 is built on Capacitor 8 and implements deep Android system integrations.

### 8.1 Android Hardware Back Button State Machine
Hardware back button events (`appBackButton`) are intercepted via a deterministic priority chain:
```
Back Button Pressed
 ├─ Speed-dial open?              → Close speed-dial
 ├─ Active modal / sheet / You?   → Close topmost sheet via ModalManager
 ├─ Confirm card active?          → Prompt to discard
 ├─ Journey History tab active?   → Switch to Progress segment
 ├─ Non-Today tab active?         → Navigate to Today tab
 └─ On Today with clean stack?    → Exit app
```

### 8.2 Capacitor Haptics Protocol
Haptic feedback is triggered via `@capacitor/haptics`:
- `selection`: Ruler dial ticks (throttled to 30ms), tab bar selections.
- `light`: Button clicks, toggle switches, filter chips.
- `medium`: Checkbox confirmations, goal completions.
- `warning`: Delete alerts, discard confirmations.
- `success`: Check-in logged, meal saved.

### 8.3 Status Bar Dynamic Theming & Safe Areas
The status bar dynamically coordinates with the active theme and modal state via `@capacitor/status-bar`:
- Pure OLED dark mode sets black background with light status bar icons.
- Light theme sets white background with dark icons.
- Edge-to-edge safe area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) are respected across all navigation and modal containers.

### 8.4 Keyboard Inset Protection & Resize Handling
Chat docks and input fields listen to `@capacitor/keyboard` show/hide events, adjusting viewport scroll offsets to prevent keyboards from obscuring active text fields.

---

## 9. Data Layer, Persistence & Sovereignty

### 9.1 Schema v3 Architecture (`zenith_db_v3`)
Data persistence is managed via IndexedDB (`idb` wrapper) using 7 specialized object stores:
1. `entries`: Weight logs, EMA calculations, body fat, waist circumference, and condition tags.
2. `meals`: Meal logs with item arrays, macros, photo references, and timestamps.
3. `water`: Fluid intake logs indexed by local calendar date.
4. `favorites`: Saved meal templates for single-tap re-logging.
5. `chat`: Conversational message history.
6. `drafts`: Offline and in-flight AI processing items.
7. `meta`: User profile, nutrition targets, encrypted API key, and settings.

### 9.2 Lossless v2 to v3 Migration
Upon first launch of Zenith 2.0, the migration controller checks for existing `localStorage` data from Zenith 1.x. It losslessly transfers all weight entries, profile attributes, and milestones into `zenith_db_v3` before marking the migration complete.

### 9.3 Backup, Restore & CSV/JSON Export
- **JSON Backup**: Complete atomic export of all database stores.
- **CSV Export**: Clean spreadsheet export of all weight logs and nutrition history.
- **Restore**: Lossless import with schema verification and automatic UI refresh.

---

## 10. Bug Remediation & QA Playbook History

During the development of Zenith 2.0, six critical user-experience issues were audited, root-caused, and resolved with regression tests:

| # | Bug | Root Cause | Resolution | Test Coverage |
|---|---|---|---|---|
| **1.1** | Ruler dial gave no visual indication of settling position | Needle was inside scroll track; no active tick highlight; lack of scroll snap and center padding | Extracted needle to fixed overlay with pointer-events: none; added scroll-snap mandatory, active green tick expansion, and reference marker | `tests/phaseA.test.js` |
| **1.2** | Unreliable swipe-down modal dismissal | Inadequate drag thresholds, missing dirty-state checks, conflict with horizontal sliders | Implemented velocity-aware gesture detector; added data-no-sheet-drag attribute to horizontal inputs; added dirty discard dialog | `tests/phaseA.test.js` |
| **1.3** | Null or NaN rendered in empty states | Missing fallback chains in KPI calculations; direct template string interpolation of null numbers | Built `src/format.js` with safe formatters; updated calculateKPIs with explicit ready/empty statuses | `tests/phaseA.test.js` |
| **1.4** | Mismatched body fat and waist inputs | Inconsistent layout dimensions; lack of comma decimal support and bounds clamping | Created unified `src/components/fieldNumber.js` supporting both period and comma separators with tactile steppers | `tests/phaseA.test.js` |
| **1.5** | Progress photo picker issues | Intermediate picker prompts; base64 storage bloating database; lack of EXIF stripping | Implemented direct camera bridge via `@capacitor/camera`; stripped EXIF/GPS via canvas; stored images on native filesystem | `tests/phaseA.test.js` |
| **1.6** | Today hero caption and toggle overlap | Tight touch spacing and overlapping hit areas at 130% and 150% font scale | Redesigned hero layout with vertical flex wrapping and minimum 48dp touch targets | `tests/phaseA.test.js` |

---

## 11. Repository File Index

```
weight-tracker/
├── android/                             # Native Android Studio Project
│   ├── app/
│   │   ├── build.gradle                 # Application build config
│   │   └── src/main/
│   │       ├── AndroidManifest.xml      # Permissions (Camera, Internet, Filesystem)
│   │       ├── res/drawable/            # Adaptive launcher vector icons
│   │       └── assets/public/           # Synced web production bundle
│   ├── build.gradle                     # Project Gradle config
│   └── variables.gradle                 # Min SDK 24, Target/Compile SDK 34/36
├── dist/                                # Compiled Vite production bundle
├── dist-apk/                            # Standalone installable Android APKs
│   └── zenith-precision-tracker.apk     # Production/debug verified Android APK
├── src/                                 # Application Source Code
│   ├── ai/                              # Gemini AI & Multimodal Engine
│   │   ├── cache.js                     # 24-hour SHA-256 hash cache
│   │   ├── geminiClient.js              # CapacitorHttp transport, retries & error mapping
│   │   ├── models.js                    # Model tiers (Flash, Pro, Lite) & fallback order
│   │   ├── prompts.js                   # System prompt & structured few-shot examples
│   │   ├── queue.js                     # Offline queue & auto-retry manager
│   │   ├── schema.js                    # Structured Gemini JSON responseSchema
│   │   ├── secureKey.js                 # WebCrypto AES-GCM encrypted key storage
│   │   └── validate.js                  # Schema coercion, clamping & Atwater validation
│   ├── components/                      # Modular UI Components
│   │   ├── dataManagement.js            # CSV/JSON backup & restore handlers
│   │   ├── fieldNumber.js               # Standardized numeric input with comma support
│   │   ├── header.js                    # Collapsing header & profile avatar trigger
│   │   ├── historyTable.js              # History list, condition tags & heat map
│   │   ├── kpiCards.js                  # Goal progress, Today Fuel & pace tiles
│   │   ├── modals.js                    # Modal manager & bottom sheet controller
│   │   ├── photoSlider.js               # Before/after visual split slider
│   │   ├── quickTools.js                # Shortcut launchers
│   │   ├── recentLogs.js                # Recent weight activity list
│   │   ├── roadmap.js                   # Milestone checkpoints & What-If simulator
│   │   ├── rulerDial.js                 # Fixed-needle center-snap ruler dial
│   │   ├── sheetGesture.js              # Velocity-aware swipe-down dismissal detector
│   │   ├── svgs.js                      # Custom vector graphics & icons
│   │   ├── todayHero.js                 # Authoritative check-in card & scale toggle
│   │   ├── trendInsights.js             # Contextual intelligence below chart
│   │   ├── trophiesPreview.js           # 20-achievement showcase card
│   │   └── youScreen.js                 # Profile, nutrition settings, AI key & display
│   ├── db/                              # Storage & Persistence Layer
│   │   └── index.js                     # IndexedDB v3 repositories & lossless v2 migration
│   ├── fuel/                            # Fuel Module (AI Calorie & Nutrition Ecosystem)
│   │   ├── addFoodSheet.js              # Manual food entry bottom sheet
│   │   ├── chatLayer.js                 # Multimodal chat composer & intent router
│   │   ├── dayStrip.js                  # 7-day horizontal calendar with completion dots
│   │   ├── energyRing.js                # SVG multi-layer energy ring & calm mode
│   │   ├── fuelScreen.js                # Fuel tab controller assembling all modules
│   │   ├── macroBars.js                 # Hairline protein, carb, fat & water bars
│   │   ├── mealConfirmCard.js           # Editable AI meal draft card with steppers
│   │   ├── mealDetailSheet.js           # Meal inspector with item breakdown & delete
│   │   ├── mealTimeline.js              # Chronological meal sections & finish day trigger
│   │   └── speedDial.js                 # Contextual FAB with staggered 4-action speed-dial
│   ├── analytics.js                     # EMA smoothing, pace, BMI & streak algorithms
│   ├── android.js                       # Capacitor native bridge (haptics, back button)
│   ├── camera.js                        # Direct camera capture, canvas EXIF stripping
│   ├── charts.js                        # Chart.js Bézier trend curves & intake bar charts
│   ├── format.js                        # Safe numerical formatters preventing null/NaN
│   ├── main.js                          # Application bootstrap & 5-tab router
│   ├── motion.js                        # Spring physics, rolling number counters
│   ├── nutrition.js                     # BMR, formula TDEE, adaptive TDEE & What-If math
│   ├── state.js                         # Reactive pub/sub state manager
│   ├── store.js                         # High-level database integration wrapper
│   └── style.css                        # Complete Apple Health design system styles
├── tests/                               # Vitest Automated Test Suite
│   ├── ai.test.js                       # Schema validation, Atwater checks & key security
│   ├── fuelStore.test.js                # Meal management, water logs & daily summaries
│   ├── nutrition.test.js                # BMR, TDEE, macro presets & adaptive blending
│   └── phaseA.test.js                   # Ruler dial, gestures, formatters & field numbers
├── capacitor.config.json                # Capacitor configuration (appId: com.zenithtrack.app)
├── index.html                           # HTML5 shell with viewport-fit=cover
├── package.json                         # Dependencies & npm scripts
├── README.md                            # Quickstart & user documentation
├── Zenith-2.0-Agent-Guide.md            # Agent implementation guide & specifications
└── Zenith-Design-and-Build-Plan.md      # Original architectural blueprint
```

---

## 12. Build, Deployment & APK Distribution

### 12.1 Local Web Development
Launch the Vite development server with Hot Module Replacement:
```bash
npm run dev
```

### 12.2 Automated Unit Testing
Run the comprehensive Vitest test suite (31 tests):
```bash
npx vitest run
```

### 12.3 Production Web Build & Capacitor Sync
Compile the optimized production bundle and sync assets into the Android native project:
```powershell
npm run build
npx cap sync android
```

### 12.4 Building the Standalone Android APK
Build the release-ready debug APK via the Gradle wrapper:
```powershell
cd android
.\gradlew.bat assembleDebug
cd ..
```
The compiled APK is generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 12.5 Installing & Running on Device
Install the compiled APK directly via ADB:
```powershell
adb install -r "android/app/build/outputs/apk/debug/app-debug.apk"
adb shell am start -n com.zenithtrack.app/.MainActivity
```
