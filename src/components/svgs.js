/**
 * ZenithTrack SVG Vector Graphics Library
 * Custom handcrafted vectors for BMI gauges, milestone crests, empty states,
 * and high-aesthetic transformation avatars.
 */

// 1. Apple Health Minimalist Segmented BMI Bar Gauge
export function renderBmiGaugeSvg(bmi) {
  const num = parseFloat(bmi) || 22.0;
  const clampedBmi = Math.min(35, Math.max(15, num));
  const percent = ((clampedBmi - 15) / (35 - 15)) * 100;

  return `
    <div class="apple-bmi-gauge" style="width: 100%; padding: 0.25rem 0;">
      <div style="position: relative; width: 100%; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, 0.08); overflow: hidden; display: flex;">
        <div style="width: 17.5%; height: 100%; background: #64d2ff;" title="Underweight (< 18.5)"></div>
        <div style="width: 32.5%; height: 100%; background: #30d158;" title="Healthy (18.5 - 24.9)"></div>
        <div style="width: 25.0%; height: 100%; background: #ff9f0a;" title="Overweight (25.0 - 29.9)"></div>
        <div style="width: 25.0%; height: 100%; background: #ff453a;" title="Obese (30.0+)"></div>
      </div>
      <div style="position: relative; width: 100%; height: 10px; margin-top: -8px; pointer-events: none;">
        <div style="position: absolute; left: ${percent.toFixed(1)}%; transform: translateX(-50%); width: 10px; height: 10px; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.5); border: 2px solid #1c1c1e;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 1px;">
        <span>18.5</span>
        <span style="margin-left: -12px;">25</span>
        <span>30</span>
      </div>
    </div>
  `;
}

// 2. Empty State: No History Logs Found
export function renderEmptyHistorySvg() {
  return `
    <svg viewBox="0 0 240 180" width="180" height="135" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="emptyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.3"/>
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>

      <!-- Background Ambient Glow -->
      <circle cx="120" cy="90" r="70" fill="url(#emptyGrad)" opacity="0.1" />

      <!-- Isometric Data Sheet / Clipboard -->
      <g transform="translate(45, 25)">
        <rect x="15" y="10" width="120" height="115" rx="14" fill="url(#cardGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
        
        <!-- Clip Top Pill -->
        <rect x="50" y="3" width="50" height="14" rx="7" fill="#334155" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
        <circle cx="75" cy="10" r="3" fill="#10b981"/>

        <!-- Chart Grid Lines -->
        <line x1="30" y1="40" x2="120" y2="40" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
        <line x1="30" y1="65" x2="120" y2="65" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
        <line x1="30" y1="90" x2="120" y2="90" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>

        <!-- Trend Polyline -->
        <path d="M 32 80 Q 55 70, 75 55 T 118 42" fill="none" stroke="url(#emptyGrad)" stroke-width="3" stroke-linecap="round"/>
        <circle cx="32" cy="80" r="3.5" fill="#10b981"/>
        <circle cx="75" cy="55" r="3.5" fill="#06b6d4"/>
        <circle cx="118" cy="42" r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>

        <!-- Scale Floating Emblem -->
        <g transform="translate(100, 75)">
          <circle cx="15" cy="15" r="22" fill="#10b981" opacity="0.9"/>
          <path d="M 9 17 L 13 21 L 21 11" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </g>
    </svg>
  `;
}

// 3. Empty State: No Progress Photos Yet
export function renderEmptyPhotosSvg() {
  return `
    <svg viewBox="0 0 240 160" width="180" height="120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="photoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      
      <!-- Ambient Circle -->
      <circle cx="120" cy="80" r="60" fill="url(#photoGrad)" opacity="0.1"/>

      <!-- Tilted Photo Card 1 -->
      <g transform="translate(50, 25) rotate(-8 55 55)">
        <rect x="0" y="0" width="85" height="100" rx="10" fill="#1e293b" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
        <rect x="8" y="8" width="69" height="70" rx="6" fill="#0f172a"/>
        <circle cx="42" cy="38" r="14" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
        <path d="M 18 70 L 35 52 L 48 64 L 62 48 L 74 70 Z" fill="rgba(6, 182, 212, 0.25)"/>
      </g>

      <!-- Foreground Photo Card 2 -->
      <g transform="translate(95, 20) rotate(6 55 55)">
        <rect x="0" y="0" width="90" height="105" rx="10" fill="#162032" stroke="url(#photoGrad)" stroke-width="2"/>
        <rect x="8" y="8" width="74" height="74" rx="6" fill="#090d16"/>
        
        <!-- Athletic Silhouette Contours -->
        <circle cx="45" cy="30" r="11" fill="none" stroke="url(#photoGrad)" stroke-width="2"/>
        <path d="M 28 64 C 32 46, 58 46, 62 64 Z" fill="none" stroke="url(#photoGrad)" stroke-width="2"/>

        <!-- Camera Focus Reticle -->
        <path d="M 20 18 L 14 18 L 14 24" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
        <path d="M 70 18 L 76 18 L 76 24" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
        <path d="M 20 72 L 14 72 L 14 66" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
        <path d="M 70 72 L 76 72 L 76 66" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
      </g>
    </svg>
  `;
}

// 4. Custom Milestone / Gamification Badge Crests
export function renderBadgeCrestSvg(badgeId, isUnlocked = false) {
  const primaryColor = isUnlocked ? '#f59e0b' : '#64748b';
  const glowColor = isUnlocked ? 'rgba(245, 158, 11, 0.4)' : 'transparent';
  const bgFill = isUnlocked ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.1))' : 'rgba(255, 255, 255, 0.03)';

  // Distinct vector paths for each badge
  let iconPath = '';
  switch (badgeId) {
    case 'first_step':
      // Compass / Target Reticle
      iconPath = `
        <circle cx="28" cy="28" r="14" fill="none" stroke="${primaryColor}" stroke-width="2"/>
        <polygon points="28,18 32,28 28,38 24,28" fill="${primaryColor}"/>
        <circle cx="28" cy="28" r="2.5" fill="#ffffff"/>
      `;
      break;
    case 'consistency_3':
      // Dual Lightning Bolt
      iconPath = `
        <path d="M 29 14 L 20 28 L 27 28 L 23 42 L 36 26 L 29 26 Z" fill="${primaryColor}" stroke="#ffffff" stroke-width="1"/>
      `;
      break;
    case 'streak_7':
      // Triple Flame
      iconPath = `
        <path d="M 28 14 C 28 14, 37 22, 37 31 C 37 36, 33 42, 28 42 C 23 42, 19 36, 19 31 C 19 25, 25 19, 28 14 Z" fill="${isUnlocked ? '#ff6b35' : primaryColor}"/>
        <path d="M 28 26 C 28 26, 32 30, 32 34 C 32 36.5, 30 39, 28 39 C 26 39, 24 36.5, 24 34 C 24 31, 27 28, 28 26 Z" fill="#ffcf4b"/>
      `;
      break;
    case 'consistency_30':
      // Imperial Crown
      iconPath = `
        <path d="M 17 38 L 39 38 L 41 22 L 32 29 L 28 16 L 24 29 L 15 22 Z" fill="${primaryColor}" stroke="#ffffff" stroke-width="1.2"/>
        <circle cx="15" cy="20" r="2" fill="#ffffff"/>
        <circle cx="28" cy="14" r="2.5" fill="#ffffff"/>
        <circle cx="41" cy="20" r="2" fill="#ffffff"/>
      `;
      break;
    case 'milestone_1kg':
      // Bronze/Copper 1KG Kettlebell / Dumbbell
      iconPath = `
        <path d="M 22 22 C 22 17, 34 17, 34 22 L 34 25 L 22 25 Z" fill="none" stroke="${primaryColor}" stroke-width="2"/>
        <circle cx="28" cy="32" r="10" fill="${primaryColor}"/>
        <text x="28" y="36" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="900" fill="#090d16" text-anchor="middle">1k</text>
      `;
      break;
    case 'milestone_5kg':
      // Silver 5KG Shield
      iconPath = `
        <path d="M 18 18 L 38 18 L 38 29 C 38 37, 28 42, 28 42 C 28 42, 18 37, 18 29 Z" fill="${primaryColor}" stroke="#ffffff" stroke-width="1.2"/>
        <text x="28" y="32" font-size="11" font-family="'Outfit', sans-serif" font-weight="900" fill="#090d16" text-anchor="middle">5</text>
      `;
      break;
    case 'halfway_hero':
      // Glowing Star Crest
      iconPath = `
        <polygon points="28,14 32,23 42,24 34,31 37,41 28,35 19,41 22,31 14,24 24,23" fill="${primaryColor}" stroke="#ffffff" stroke-width="1"/>
      `;
      break;
    case 'target_crushed':
      // Gold Champion Trophy Cup
      iconPath = `
        <path d="M 20 18 L 36 18 L 36 28 C 36 33, 32 35, 28 35 C 24 35, 20 33, 20 28 Z" fill="${primaryColor}" stroke="#ffffff" stroke-width="1.2"/>
        <path d="M 20 20 L 15 22 C 14 26, 17 29, 21 29" fill="none" stroke="${primaryColor}" stroke-width="1.8"/>
        <path d="M 36 20 L 41 22 C 42 26, 39 29, 35 29" fill="none" stroke="${primaryColor}" stroke-width="1.8"/>
        <rect x="25" y="35" width="6" height="6" fill="${primaryColor}"/>
        <rect x="21" y="41" width="14" height="3" rx="1.5" fill="${primaryColor}"/>
      `;
      break;
    case 'photo_archivist':
      // Camera Aperture
      iconPath = `
        <rect x="16" y="20" width="24" height="19" rx="4" fill="none" stroke="${primaryColor}" stroke-width="2"/>
        <circle cx="28" cy="29.5" r="5.5" fill="none" stroke="${primaryColor}" stroke-width="2"/>
        <circle cx="34" cy="24" r="1.5" fill="${primaryColor}"/>
      `;
      break;
    case 'centurion':
      // Centurion Roman Helmet / Star 100
      iconPath = `
        <circle cx="28" cy="28" r="13" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-dasharray="4 2"/>
        <text x="28" y="32" font-size="10" font-family="'JetBrains Mono', monospace" font-weight="900" fill="${primaryColor}" text-anchor="middle">100</text>
      `;
      break;
    default:
      iconPath = `<circle cx="28" cy="28" r="10" fill="${primaryColor}"/>`;
  }

  return `
    <svg viewBox="0 0 56 56" width="54" height="54" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="badgeBg_${badgeId}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${isUnlocked ? primaryColor : '#334155'}" stop-opacity="${isUnlocked ? '0.2' : '0.05'}"/>
          <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <!-- Hexagonal / Shield Outer Frame -->
      <polygon points="28,3 49,15 49,41 28,53 7,41 7,15" fill="url(#badgeBg_${badgeId})" stroke="${isUnlocked ? primaryColor : 'rgba(255,255,255,0.1)'}" stroke-width="${isUnlocked ? '2' : '1.2'}" stroke-linejoin="round"/>
      
      <!-- Inner Icon Vector -->
      ${iconPath}
    </svg>
  `;
}

// 5. Aesthetic Athletic Silhouette Check-in Photos
export function createAthleticProgressSvg(dayNumber, weightText, bodyFatText, accentColor) {
  // SVG with aesthetic modern neon wireframe human figure and fitness metric badges
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="50%" stop-color="#111827"/>
        <stop offset="100%" stop-color="#0b1329"/>
      </linearGradient>
      <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${accentColor}"/>
        <stop offset="100%" stop-color="#06b6d4"/>
      </linearGradient>
      <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <pattern id="gridPattern" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
      </pattern>
    </defs>

    <!-- Deep Tech Surface -->
    <rect width="600" height="420" fill="url(#bgGrad)"/>
    <rect width="600" height="420" fill="url(#gridPattern)"/>

    <!-- Subtle Ambient Energy Ring behind Silhouette -->
    <circle cx="300" cy="180" r="110" fill="none" stroke="url(#neonGlow)" stroke-width="1.5" stroke-dasharray="8 6" opacity="0.4"/>
    <circle cx="300" cy="180" r="140" fill="none" stroke="${accentColor}" stroke-width="1" opacity="0.15"/>

    <!-- Aesthetic Athletic Wireframe Silhouette -->
    <!-- Head -->
    <circle cx="300" cy="95" r="28" fill="none" stroke="url(#neonGlow)" stroke-width="3.5" filter="url(#softGlow)"/>
    <circle cx="300" cy="95" r="20" fill="${accentColor}" opacity="0.15"/>

    <!-- Neck & Shoulders -->
    <path d="M 290 125 L 290 138 L 245 152 L 235 220 L 255 222 L 260 178 L 272 178 L 265 270 L 285 270 L 290 345 L 310 345 L 315 270 L 335 270 L 328 178 L 340 178 L 345 222 L 365 220 L 355 152 L 310 138 L 310 125 Z" 
          fill="rgba(17, 24, 39, 0.7)" stroke="url(#neonGlow)" stroke-width="3" stroke-linejoin="round" filter="url(#softGlow)"/>

    <!-- Torso Anatomy Contour lines -->
    <path d="M 275 168 Q 300 178, 325 168" fill="none" stroke="url(#neonGlow)" stroke-width="2" opacity="0.8"/>
    <path d="M 285 200 L 315 200" fill="none" stroke="url(#neonGlow)" stroke-width="1.8" opacity="0.7"/>
    <path d="M 288 220 L 312 220" fill="none" stroke="url(#neonGlow)" stroke-width="1.8" opacity="0.7"/>
    <line x1="300" y1="168" x2="300" y2="240" stroke="url(#neonGlow)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.6"/>

    <!-- Digital Measurement Crosshairs -->
    <path d="M 220 152 L 210 152 M 380 152 L 390 152" stroke="${accentColor}" stroke-width="2"/>
    <path d="M 245 235 L 235 235 M 355 235 L 365 235" stroke="${accentColor}" stroke-width="2"/>

    <!-- Bottom Check-in Data HUD Card -->
    <rect x="50" y="325" width="500" height="72" rx="14" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5"/>
    
    <text x="80" y="354" font-family="'Outfit', sans-serif" font-size="14" font-weight="700" fill="#94a3b8" letter-spacing="1">CHECK-IN MILESTONE</text>
    <text x="80" y="380" font-family="'Outfit', sans-serif" font-size="20" font-weight="800" fill="#f8fafc">Check-in: Day ${dayNumber}</text>

    <!-- Weight & Body Fat Pill -->
    <rect x="330" y="340" width="200" height="42" rx="8" fill="rgba(255, 255, 255, 0.06)" stroke="${accentColor}" stroke-width="1.5"/>
    <text x="430" y="367" font-family="'JetBrains Mono', monospace" font-size="17" font-weight="700" fill="${accentColor}" text-anchor="middle">${weightText} • ${bodyFatText}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
