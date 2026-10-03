# Zenith 2.0 (ZenithTrack) — Precision Weight, Fuel & Body Intelligence

A high-craft, precision weight and body intelligence application engineered with an **Apple Health minimalist aesthetic** and built as a **native Android mobile application** via Capacitor 8. Zenith 2.0 unifies three core modules—**Weight + Fuel + You**—into a private, offline-first health tracking ecosystem with on-device AI meal intelligence powered by Gemini.

---

## 📖 Complete Master Manual
For the exhaustive technical, functional, and mathematical documentation detailing every formula, component, screen, AI integration, and native bridge:
👉 **[DOCUMENTATION.md](file:///e:/Project/weight-tracker/DOCUMENTATION.md)**

---

## 📦 Verified Android APK
The compiled, tested, and emulator-verified standalone Android APK is ready for installation:
👉 **[dist-apk/zenith-precision-tracker.apk](file:///e:/Project/weight-tracker/dist-apk/zenith-precision-tracker.apk)**

To install on any connected physical Android device or emulator:
```powershell
adb install -r "e:\Project\weight-tracker\dist-apk\zenith-precision-tracker.apk"
adb shell am start -n com.zenithtrack.app/.MainActivity
```

---

## 🌟 Key Highlights of Zenith 2.0

### 1. Weight Intelligence
- **7-Day Exponential Moving Average (EMA)** ($\alpha = 0.25$): Dampens biological water retention, hydration shifts, and sodium noise to reveal true physiological progress.
- **Ruler Dial**: 0.1 precision scroll-scrub dial with fixed center needle overlay, mandatory CSS scroll-snap, active tick expansion, and reference marker dot for previous weigh-ins.
- **Bézier Trend Curves & Crosshair Scrub**: Interactive Chart.js graphs across `7D`, `1M`, `3M`, `6M`, `1Y`, and `ALL` ranges with sub-stats and plateau detection.
- **Milestone Stepper & What-If Simulator**: Automatic trajectory checkpoints, arrival forecasting, and an interactive daily calorie intake simulator.
- **Before / After Photo Split Slider**: Visual progress comparison with draggable dividing handle.

### 2. Fuel Intelligence (AI Calorie & Nutrition Ecosystem)
- **Energy Ring**: SVG multi-layer circular ring with neutral gray over-target lap (no moralizing red) and Calm Mode support.
- **Macro Hairline Bars**: Protein (`#30D158`), Carbs (`#0A84FF`), and Fat (`#FFD60A`) linear progress bars plus quick water logging.
- **7-Day Day Strip**: Horizontal calendar strip with logged and complete day indicators.
- **Contextual Timeline**: Chronological Breakfast, Lunch, Dinner, and Snack sections with 44px photo thumbnails, portion steppers, and day finalization.
- **Multimodal Gemini AI (BYOK)**: Conversational chat and camera dock with streaming shimmer effects and intent routing (`log_meal`, `log_weight`, `log_water`, `question`, `support`).
- **Editable Confirm Cards**: AI proposals are always inspected and verified on an editable card with portion steppers, Atwater validation, and allergy alerts before saving.
- **Adaptive TDEE**: Blends formula calculations with empirical intake and weight changes over time.

### 3. You (Profile & Sovereignty)
- **Cupertino Inset Profile**: Height, age, biological sex, start weight, activity level, and goal weight.
- **Nutrition Configuration**: Macro presets (Balanced, High Protein, Low Carb, Custom) and Calm Mode toggle.
- **Private BYOK Management**: Enter your personal Gemini API key, stored encrypted on-device via WebCrypto AES-GCM (never logged, never exported).
- **Data Sovereignty**: Lossless `.zenith` backup, JSON export, CSV spreadsheet export, restore, sample data loader, and complete factory reset.

### 4. Contextual FAB & Staggered Speed-Dial
- **Single Tap**: Log Weight on Today/Trends/Journey; Focus Chat on Fuel.
- **Long Press / Swipe Up**: Staggered spring speed-dial with 4 actions: **Log weight**, **Snap meal**, **Describe meal**, **Add water**.

### 5. Android Native Bridge
- Hardware back button state machine (Speed-dial -> Modals -> Sub-sheets -> History tab -> Exit).
- Tactile haptic feedback (`@capacitor/haptics`) across dials, buttons, and confirmations.
- Edge-to-edge layout with dynamic status bar coloring (`@capacitor/status-bar`).
- Soft keyboard inset protection (`@capacitor/keyboard`).

---

## 🚀 Development & Build Commands

### Web Development
```bash
npm run dev
```
Preview at [http://localhost:5173/](http://localhost:5173/).

### Automated Unit Testing
```bash
npx vitest run
```

### Production Build & Capacitor Sync
```powershell
npm run build
npx cap sync android
```

### Build Android APK
```powershell
cd android
.\gradlew.bat assembleDebug
cd ..
```
Output APK is mirrored to: `dist-apk/zenith-precision-tracker.apk`.
