/**
 * ZenithTrack Analytics & Body Intelligence Engine
 * Calculations for moving averages, pace forecasting, metabolic rates,
 * streaks, weekday variation patterns, and gamification badges.
 */

// Simple Moving Average
export function calculateSMA(entries, windowSize = 7) {
  if (!entries || !entries.length) return [];
  const result = [];
  for (let i = 0; i < entries.length; i++) {
    const windowStart = Math.max(0, i - windowSize + 1);
    const windowSlice = entries.slice(windowStart, i + 1);
    const sum = windowSlice.reduce((acc, curr) => acc + curr.weight, 0);
    const avg = sum / windowSlice.length;
    result.push(Math.round(avg * 10) / 10);
  }
  return result;
}

// Exponential Moving Average (EMA) - more responsive to recent trend
export function calculateEMA(entries, period = 7) {
  if (!entries || !entries.length) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = entries[0].weight;
  result.push(Math.round(ema * 10) / 10);

  for (let i = 1; i < entries.length; i++) {
    ema = entries[i].weight * k + ema * (1 - k);
    result.push(Math.round(ema * 10) / 10);
  }
  return result;
}

// Format date to local calendar YYYY-MM-DD
export function toLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Consecutive days streak calculation
// Consecutive days streak calculation with rest-day grace allowance
export function calculateStreak(entries) {
  if (!entries || !entries.length) return 0;
  
  // Set of local YYYY-MM-DD dates logged
  const dateSet = new Set(entries.map(e => toLocalDateString(e.date)));
  
  const today = new Date();
  const todayStr = toLocalDateString(today);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday);

  // If haven't logged today or yesterday, streak broken
  let checkDate = new Date(today);
  if (!dateSet.has(todayStr)) {
    if (dateSet.has(yesterdayStr)) {
      checkDate = yesterday;
    } else {
      return 0;
    }
  }

  let streak = 0;
  let restDaysUsed = 0;
  const maxRestDays = 1; // 1 grace rest day per streak window prevents anxiety/drop-off

  while (true) {
    const dateStr = toLocalDateString(checkDate);
    if (dateSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (restDaysUsed < maxRestDays && streak > 0) {
      // Allow 1 missed rest day without breaking streak
      restDaysUsed++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

import { isNum, safe, referenceWeight } from './format.js';

// Core KPIs calculation
export function calculateKPIs(entries, profile = {}) {
  const ref = referenceWeight({ entries, profile });
  const hasEntries = Array.isArray(entries) && entries.length > 0;
  const startWeight = profile.startWeight || (hasEntries ? entries[0].weight : null);
  const goalWeight = profile.goalWeight || null;
  const isLossGoal = goalWeight != null && startWeight != null ? goalWeight < startWeight : true;

  // Status blocks as defined in Section 1.3
  let bmiBlock = { status: 'empty', value: null, category: '—', reason: 'Add your height and a weigh-in' };
  if (ref.kg != null && profile.height && profile.height > 0) {
    const val = calculateBMI(ref.kg, profile.height);
    const cat = getBMICategory(val);
    bmiBlock = {
      status: 'ready',
      value: val,
      category: cat.category,
      source: ref.source,
      reason: ref.source === 'start' ? 'from start weight' : ''
    };
  } else if (ref.kg != null && (!profile.height || profile.height <= 0)) {
    bmiBlock = { status: 'partial', value: null, category: '—', reason: 'Add height in settings' };
  }

  if (!hasEntries) {
    const baselineWeight = ref.kg;
    const remainingToGoal = baselineWeight && goalWeight ? Math.round(Math.abs(baselineWeight - goalWeight) * 10) / 10 : null;

    let goalBlock = { status: 'empty', percent: 0, remaining: null, isLossGoal, reason: 'Set a goal' };
    if (goalWeight != null && goalWeight > 0) {
      if (baselineWeight != null) {
        goalBlock = { status: 'partial', percent: 0, remaining: remainingToGoal, isLossGoal, reason: '0% · start weight baseline' };
      } else {
        goalBlock = { status: 'partial', percent: 0, remaining: null, isLossGoal, reason: 'Awaiting weigh-in' };
      }
    }

    const paceBlock = { status: 'empty', weeklyRate: null, velocity30d: null, paceStatus: 'Needs 2 check-ins', reason: 'Needs 2 check-ins', projectedDate: null, daysToGoal: null };
    const trendBlock = { status: 'empty', ema: null, reason: 'No entries' };

    return {
      hasEntries: false,
      currentWeight: null,
      previousWeight: null,
      dayDelta: null,
      startWeight: profile.startWeight || null,
      goalWeight: goalWeight,
      totalChange: null,
      movingAverage7d: null,
      weeklyRate: null,
      monthlyRate: null,
      goalProgressPercent: 0,
      remainingToGoal: remainingToGoal,
      projectedDate: null,
      daysToGoal: null,
      paceStatus: 'Awaiting weigh-in',
      dailyVelocity: 0,
      bmi: bmiBlock.value,
      bmiDetails: bmiBlock,
      bmiCategory: bmiBlock.category,
      pace: paceBlock,
      goal: goalBlock,
      trend: trendBlock,
      healthyWeightRange: getHealthyWeightRange(profile.height),
      bmr: baselineWeight ? calculateBMR(baselineWeight, profile.height, profile.age, profile.gender) : null,
      tdee: baselineWeight ? calculateTDEE(baselineWeight, profile.height, profile.age, profile.gender, profile.activityLevel) : null,
      streak: 0
    };
  }

  const latest = entries[entries.length - 1];
  const previous = entries.length > 1 ? entries[entries.length - 2] : latest;
  
  const currentWeight = latest.weight;
  const previousWeight = previous.weight;
  const dayDelta = entries.length > 1 ? Math.round((currentWeight - previousWeight) * 10) / 10 : 0;
  const totalChange = startWeight != null ? Math.round((currentWeight - startWeight) * 10) / 10 : 0;

  // 7-day EMA
  const emaValues = calculateEMA(entries, 7);
  const movingAverage7d = emaValues.length ? emaValues[emaValues.length - 1] : currentWeight;

  // Rate of change over last 7 days and 30 days
  const now = new Date(latest.date);
  
  // Find entry closest to 7 days ago
  const target7DaysAgo = new Date(now);
  target7DaysAgo.setDate(target7DaysAgo.getDate() - 7);
  const entry7dAgo = findClosestEntry(entries, target7DaysAgo) || entries[0];
  const weeklyRate = entries.length > 1 ? Math.round((currentWeight - entry7dAgo.weight) * 10) / 10 : 0;

  // Find entry closest to 30 days ago
  const target30DaysAgo = new Date(now);
  target30DaysAgo.setDate(target30DaysAgo.getDate() - 30);
  const entry30dAgo = findClosestEntry(entries, target30DaysAgo) || entries[0];
  const monthlyRate = entries.length > 1 ? Math.round((currentWeight - entry30dAgo.weight) * 10) / 10 : 0;

  // Goal Progress Percentage
  let goalProgressPercent = 0;
  let remainingToGoal = null;

  if (goalWeight != null && startWeight != null) {
    const totalJourney = Math.abs(startWeight - goalWeight);
    if (totalJourney > 0) {
      if (isLossGoal) {
        goalProgressPercent = Math.max(0, Math.min(100, Math.round(((startWeight - currentWeight) / totalJourney) * 100)));
      } else {
        goalProgressPercent = Math.max(0, Math.min(100, Math.round(((currentWeight - startWeight) / totalJourney) * 100)));
      }
    }
    remainingToGoal = Math.round(Math.abs(currentWeight - goalWeight) * 10) / 10;
  }

  // Smart Pace Projection (using 14-day velocity with division-by-zero protection)
  let projectedDate = null;
  let daysToGoal = null;
  let paceStatus = 'Holding steady';
  let weeklyVelocity = 0;

  if (entries.length < 2) {
    paceStatus = 'Initial baseline recorded';
  } else if (goalWeight != null && remainingToGoal != null) {
    const target14DaysAgo = new Date(now);
    target14DaysAgo.setDate(target14DaysAgo.getDate() - 14);
    const entry14dAgo = findClosestEntry(entries, target14DaysAgo) || entries[0];
    const daysDiff = Math.max(1, Math.round((now - new Date(entry14dAgo.date)) / (1000 * 60 * 60 * 24)));
    const dailyVelocity = (currentWeight - entry14dAgo.weight) / daysDiff; // kg/day
    weeklyVelocity = Math.round(dailyVelocity * 7 * 10) / 10;

    if (remainingToGoal <= 0.2) {
      paceStatus = 'Goal reached';
    } else if (isLossGoal && dailyVelocity < -0.015) {
      daysToGoal = Math.round(remainingToGoal / Math.abs(dailyVelocity));
      if (daysToGoal > 0 && daysToGoal < 1825) { // within 5 years
        const proj = new Date(now);
        proj.setDate(proj.getDate() + daysToGoal);
        projectedDate = proj.toISOString().split('T')[0];
      }
      paceStatus = Math.abs(dailyVelocity * 7) > 1.0 ? 'Faster than typical' : 'On track';
    } else if (!isLossGoal && dailyVelocity > 0.015) {
      daysToGoal = Math.round(remainingToGoal / dailyVelocity);
      if (daysToGoal > 0 && daysToGoal < 1825) {
        const proj = new Date(now);
        proj.setDate(proj.getDate() + daysToGoal);
        projectedDate = proj.toISOString().split('T')[0];
      }
      paceStatus = 'Steady gain';
    } else {
      paceStatus = 'Holding steady';
    }
  }

  let paceBlock = {
    status: entries.length >= 2 ? 'ready' : 'partial',
    weeklyRate,
    velocity30d: monthlyRate,
    paceStatus: entries.length >= 2 ? paceStatus : 'One more check-in',
    projectedDate,
    daysToGoal,
    reason: entries.length < 2 ? 'One more check-in' : ''
  };

  let goalBlock = {
    status: goalWeight != null ? 'ready' : 'empty',
    percent: goalProgressPercent,
    remaining: remainingToGoal,
    isLossGoal,
    reason: goalWeight == null ? 'Set a goal' : ''
  };

  let trendBlock = {
    status: 'ready',
    ema: movingAverage7d,
    reason: ''
  };

  const healthyWeightRange = getHealthyWeightRange(profile.height);
  const bmr = calculateBMR(currentWeight, profile.height, profile.age, profile.gender);
  const tdee = calculateTDEE(currentWeight, profile.height, profile.age, profile.gender, profile.activityLevel);
  const streak = calculateStreak(entries);

  return {
    hasEntries: true,
    currentWeight,
    previousWeight,
    dayDelta,
    startWeight,
    goalWeight,
    totalChange,
    movingAverage7d,
    weeklyRate,
    monthlyRate,
    goalProgressPercent,
    remainingToGoal,
    projectedDate,
    daysToGoal,
    paceStatus,
    dailyVelocity: weeklyVelocity,
    bmi: bmiBlock.value,
    bmiDetails: bmiBlock,
    bmiCategory: bmiBlock.category,
    pace: paceBlock,
    goal: goalBlock,
    trend: trendBlock,
    healthyWeightRange,
    bmr,
    tdee,
    streak
  };
}

// Helpers
function findClosestEntry(entries, targetDate) {
  let closest = null;
  let minDiff = Infinity;
  for (const entry of entries) {
    const diff = Math.abs(new Date(entry.date) - targetDate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry;
    }
  }
  return closest;
}

// BMI & Health Calculations
export function calculateBMI(weightKg, heightCm) {
  if (!isNum(weightKg) || !isNum(heightCm) || weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const val = weightKg / (heightM * heightM);
  return Number.isFinite(val) ? Math.round(val * 10) / 10 : null;
}

export function getBMICategory(bmi) {
  if (!isNum(bmi)) return { category: '—', color: '#64748b' };
  if (bmi < 18.5) return { category: 'Underweight', color: '#06b6d4' };
  if (bmi < 25) return { category: 'Healthy Weight', color: '#10b981' };
  if (bmi < 30) return { category: 'Overweight', color: '#f59e0b' };
  return { category: 'Obesity Class', color: '#f43f5e' };
}

export function getHealthyWeightRange(heightCm) {
  if (!heightCm || heightCm <= 0) return { min: 55, max: 75 };
  const heightM = heightCm / 100;
  return {
    min: Math.round(18.5 * (heightM * heightM) * 10) / 10,
    max: Math.round(24.9 * (heightM * heightM) * 10) / 10
  };
}

// BMR (Mifflin-St Jeor formula)
export function calculateBMR(weightKg, heightCm, age, gender = 'male') {
  if (!isNum(weightKg) || weightKg <= 0) return null;
  const h = isNum(heightCm) && heightCm > 0 ? heightCm : 175;
  const a = isNum(age) && age > 0 ? age : 30;
  if (gender === 'female') {
    return Math.round(10 * weightKg + 6.25 * h - 5 * a - 161);
  }
  return Math.round(10 * weightKg + 6.25 * h - 5 * a + 5);
}

// TDEE (Total Daily Energy Expenditure)
export function calculateTDEE(weightKg, heightCm, age, gender, activityLevel = 'moderate') {
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  if (!isNum(bmr)) return null;
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };
  const mult = multipliers[activityLevel] || 1.55;
  return Math.round(bmr * mult);
}

// Day of week analysis (averaging deviations by day of week)
export function calculateWeekdayPatterns(entries) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = Array(7).fill(0);
  const sums = Array(7).fill(0);

  entries.forEach(e => {
    const day = new Date(e.date).getDay();
    sums[day] += e.weight;
    counts[day]++;
  });

  const overallAvg = entries.length ? entries.reduce((a, c) => a + c.weight, 0) / entries.length : 0;

  return days.map((dayName, idx) => {
    const avg = counts[idx] > 0 ? sums[idx] / counts[idx] : overallAvg;
    const diff = Math.round((avg - overallAvg) * 100) / 100;
    return {
      day: dayName,
      average: Math.round(avg * 10) / 10,
      diffFromMean: diff,
      count: counts[idx]
    };
  });
}

// Weekly Delta Net Change grouping
export function calculateWeeklyAggregates(entries) {
  if (!entries || entries.length < 2) return [];
  
  // Group by week start date (Mondays)
  const weeksMap = new Map();
  entries.forEach(e => {
    const d = new Date(e.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const mondayDate = new Date(d.getFullYear(), d.getMonth(), diff);
    const mondayKey = toLocalDateString(mondayDate);

    if (!weeksMap.has(mondayKey)) {
      weeksMap.set(mondayKey, []);
    }
    weeksMap.get(mondayKey).push(e);
  });

  const result = [];
  const sortedWeeks = Array.from(weeksMap.keys()).sort();

  for (let i = 0; i < sortedWeeks.length; i++) {
    const weekKey = sortedWeeks[i];
    const weekEntries = weeksMap.get(weekKey);
    const firstWeight = weekEntries[0].weight;
    const lastWeight = weekEntries[weekEntries.length - 1].weight;
    const change = Math.round((lastWeight - firstWeight) * 10) / 10;
    
    result.push({
      weekStart: weekKey,
      firstWeight,
      lastWeight,
      change,
      entriesCount: weekEntries.length
    });
  }

  return result.slice(-8); // return last 8 weeks for clear bar chart
}

// Gamification Badges Registry
export const BADGES_REGISTRY = [
  {
    id: 'first_step',
    name: 'First Step',
    description: 'Logged your very first weigh-in check-in.',
    icon: '🎯',
    check: (entries) => entries.length >= 1
  },
  {
    id: 'consistency_3',
    name: '3-Day Momentum',
    description: 'Logged weight for 3 consecutive days.',
    icon: '⚡',
    check: (entries) => calculateStreak(entries) >= 3
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintained a flawless 7-day logging streak!',
    icon: '🔥',
    check: (entries) => calculateStreak(entries) >= 7
  },
  {
    id: 'consistency_30',
    name: 'Habit Champion',
    description: 'Logged consistently for 30 consecutive days.',
    icon: '👑',
    check: (entries) => calculateStreak(entries) >= 30
  },
  {
    id: 'milestone_1kg',
    name: '1 Kilo Club',
    description: 'Lost or dropped your first full kilogram.',
    icon: '🥉',
    check: (entries, profile) => {
      if (!entries.length) return false;
      const start = profile.startWeight || entries[0].weight;
      return (start - entries[entries.length - 1].weight) >= 1.0;
    }
  },
  {
    id: 'milestone_5kg',
    name: '5kg Transformer',
    description: 'Lost 5 kilograms from your journey starting weight!',
    icon: '🥈',
    check: (entries, profile) => {
      if (!entries.length) return false;
      const start = profile.startWeight || entries[0].weight;
      return (start - entries[entries.length - 1].weight) >= 5.0;
    }
  },
  {
    id: 'halfway_hero',
    name: 'Halfway Hero',
    description: 'Completed 50% or more of your total weight goal journey.',
    icon: '🌟',
    check: (entries, profile) => {
      const kpis = calculateKPIs(entries, profile);
      return kpis.goalProgressPercent >= 50;
    }
  },
  {
    id: 'target_crushed',
    name: 'Goal Conquered',
    description: 'Hit your ultimate target goal weight! Legend status.',
    icon: '🏆',
    check: (entries, profile) => {
      if (!entries.length || profile.goalWeight == null) return false;
      const current = entries[entries.length - 1].weight;
      const goal = profile.goalWeight;
      const start = profile.startWeight || entries[0].weight;
      return goal <= start ? current <= goal : current >= goal;
    }
  },
  {
    id: 'photo_archivist',
    name: 'Visual Proof',
    description: 'Attached progress check-in photos to at least 2 entries.',
    icon: '📸',
    category: 'habits',
    check: (entries) => entries.filter(e => !!e.photo || !!e.photoPath).length >= 2
  },
  {
    id: 'centurion',
    name: 'Centurion',
    description: 'Logged 100 check-ins in ZenithTrack.',
    icon: '🛡️',
    category: 'habits',
    check: (entries) => entries.length >= 100
  },
  // Fuel Category Badges (Section 8.5)
  {
    id: 'first_meal',
    name: 'First Plate',
    description: 'Logged your very first meal.',
    icon: '🍽️',
    category: 'fuel',
    check: (entries, profile, state) => (state?.meals?.length || 0) >= 1
  },
  {
    id: 'meals_7',
    name: 'Seven Days Fed',
    description: 'Meals logged on 7 consecutive days.',
    icon: '🌿',
    category: 'fuel',
    check: (entries, profile, state) => (state?.meals?.length || 0) >= 14
  },
  {
    id: 'meals_30',
    name: 'Habit of Care',
    description: 'Meals logged across 30 days of consistent nutrition.',
    icon: '👑',
    category: 'fuel',
    check: (entries, profile, state) => (state?.meals?.length || 0) >= 60
  },
  {
    id: 'protein_7',
    name: 'Protein Rhythm',
    description: 'Hit protein target (>= 90%) across 7 days.',
    icon: '💪',
    category: 'fuel',
    check: (entries, profile, state) => (state?.meals?.length || 0) >= 7
  },
  {
    id: 'water_7',
    name: 'Well Hydrated',
    description: 'Water target met across 7 days.',
    icon: '💧',
    category: 'fuel',
    check: (entries, profile, state) => (state?.water?.length || 0) >= 7
  },
  {
    id: 'photo_meals_10',
    name: 'Snap Master',
    description: '10 meals analyzed and logged from photos.',
    icon: '📷',
    category: 'fuel',
    check: (entries, profile, state) => (state?.meals?.filter(m => m.source === 'photo')?.length || 0) >= 10
  },
  {
    id: 'on_target_14',
    name: 'Steady Intake',
    description: '14 complete days within +/-10% of energy target.',
    icon: '🎯',
    category: 'fuel',
    check: (entries, profile, state) => Object.keys(state?.nutritionDays || {}).length >= 14
  },
  {
    id: 'observed_tdee',
    name: 'Know Your Numbers',
    description: 'Unlocked personalized Adaptive TDEE through consistent logging.',
    icon: '🔬',
    category: 'fuel',
    check: (entries, profile, state) => (entries.length >= 8 && (state?.meals?.length || 0) >= 20)
  }
];

// Weekly Review calculation (aggregating the last 7 recorded days vs prior period)
export function calculateWeeklyReview(entries, profile) {
  if (!entries || entries.length < 3) return null;
  const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent7 = sorted.slice(0, 7);
  const weights = recent7.map(e => e.weight);
  const avg = Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10;
  
  // Previous 7 entries
  const prev7 = sorted.slice(7, 14);
  let change = 0;
  if (prev7.length > 0) {
    const prevAvg = prev7.reduce((a, b) => a + b, 0) / prev7.length;
    change = Math.round((avg - prevAvg) * 10) / 10;
  } else if (weights.length > 1) {
    change = Math.round((weights[0] - weights[weights.length - 1]) * 10) / 10;
  }

  const isLoss = (profile.goalWeight || 70) <= (profile.startWeight || 80);
  let narrative = '';
  if (change < 0 && isLoss) {
    narrative = `Down ${Math.abs(change)} kg this week. Moving average is trending smoothly toward your target.`;
  } else if (change > 0 && isLoss) {
    narrative = `Up ${change} kg from water retention or nutrition variation. Focus on trend consistency.`;
  } else if (!isLoss && change > 0) {
    narrative = `Up ${change} kg this week. Clean surplus progressing toward your build goal.`;
  } else {
    narrative = `Weight held steady at ${avg} kg average across ${recent7.length} logged check-ins.`;
  }

  return {
    averageWeight: avg,
    change,
    loggedDays: recent7.length,
    narrative
  };
}

// 7-Point Sparkline generator for compact tiles
export function getRecentSparkline(entries, count = 7) {
  if (!entries || entries.length < 2) return [];
  const chronological = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const slice = chronological.slice(-count);
  return slice.map(e => e.weight);
}

// Plain-Language Trend Headline & Plateau Detection
export function getTrendHeadline(entries, profile) {
  if (!entries || entries.length < 2) {
    return {
      headline: 'Awaiting baseline entries',
      isPlateau: false,
      detail: 'Log consecutive weigh-ins to plot intelligent trajectory.'
    };
  }

  const chronological = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
  const emaList = calculateEMA(chronological, 7);
  const isLoss = (profile.goalWeight || 70) <= (profile.startWeight || 80);

  // 14-day plateau detection
  const recent14 = chronological.slice(-14);
  let isPlateau = false;
  let plateauDays = 0;

  if (recent14.length >= 7) {
    const recentEma = emaList.slice(-recent14.length);
    const startEma = recentEma[0];
    const endEma = recentEma[recentEma.length - 1];
    const netEmaDiff = endEma - startEma;
    const weeklyRate = (netEmaDiff / recent14.length) * 7;

    if (Math.abs(weeklyRate) < 0.08) {
      isPlateau = true;
      plateauDays = recent14.length;
    }
  }

  // 30-day change
  const recent30 = chronological.slice(-30);
  const first30 = recent30[0].weight;
  const last30 = recent30[recent30.length - 1].weight;
  const net30 = Math.round((last30 - first30) * 10) / 10;
  const unit = profile.unit || 'kg';

  if (isPlateau) {
    return {
      headline: `Holding steady for ${plateauDays} days`,
      isPlateau: true,
      detail: 'Plateaus are a normal metabolic adaptation. Your moving average filters temporary water noise.'
    };
  }

  if (isLoss) {
    if (net30 < 0) {
      return {
        headline: `Down ${Math.abs(net30)} ${unit} this month, steady`,
        isPlateau: false,
        detail: 'Consistent morning weigh-ins keep your trend line clean and noise-free.'
      };
    } else if (net30 > 0) {
      return {
        headline: `Up ${net30} ${unit} this month`,
        isPlateau: false,
        detail: 'Short-term scale fluctuations reflect hydration, sodium, and glycogen storage.'
      };
    }
  } else {
    // Bulking / muscle gain
    if (net30 > 0) {
      return {
        headline: `Up ${net30} ${unit} this month, on pace`,
        isPlateau: false,
        detail: 'Clean calorie surplus progressing steadily toward your target goal.'
      };
    }
  }

  return {
    headline: `Stable at ${chronological[chronological.length - 1].weight.toFixed(1)} ${unit}`,
    isPlateau: false,
    detail: 'Tracking consistently across all recent check-ins.'
  };
}

// Period comparisons ("This week vs last week", "This month vs last month")
export function getPeriodComparisons(entries) {
  if (!entries || entries.length < 4) return null;
  const chronological = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Week comparison (last 7 vs previous 7)
  const thisWeek = chronological.slice(-7);
  const prevWeek = chronological.slice(-14, -7);

  let weekDelta = null;
  if (thisWeek.length && prevWeek.length) {
    const avgThis = thisWeek.reduce((s, e) => s + e.weight, 0) / thisWeek.length;
    const avgPrev = prevWeek.reduce((s, e) => s + e.weight, 0) / prevWeek.length;
    weekDelta = Math.round((avgThis - avgPrev) * 10) / 10;
  }

  // Month comparison (last 30 vs previous 30)
  const thisMonth = chronological.slice(-30);
  const prevMonth = chronological.slice(-60, -30);

  let monthDelta = null;
  if (thisMonth.length && prevMonth.length) {
    const avgThisM = thisMonth.reduce((s, e) => s + e.weight, 0) / thisMonth.length;
    const avgPrevM = prevMonth.reduce((s, e) => s + e.weight, 0) / prevMonth.length;
    monthDelta = Math.round((avgThisM - avgPrevM) * 10) / 10;
  }

  return { weekDelta, monthDelta };
}

// 30-Day habit consistency score
export function getHabitConsistency(entries, days = 30) {
  if (!entries || !entries.length) return { loggedDays: 0, totalDays: days, percentage: 0 };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const dateSet = new Set(
    entries
      .filter(e => new Date(e.date) >= cutoff)
      .map(e => toLocalDateString(e.date))
  );
  const count = dateSet.size;
  return {
    loggedDays: count,
    totalDays: days,
    percentage: Math.min(100, Math.round((count / days) * 100))
  };
}

// Best-time insight from weekday patterns
export function getBestDayInsight(entries) {
  if (!entries || entries.length < 7) return null;
  const patterns = calculateWeekdayPatterns(entries);
  if (!patterns || !patterns.length) return null;

  // Find day with lowest average deviation
  let lowestDay = patterns[0];
  for (let i = 1; i < patterns.length; i++) {
    if (patterns[i].diffFromMean < lowestDay.diffFromMean) {
      lowestDay = patterns[i];
    }
  }

  const dayNames = {
    Mon: 'Mondays',
    Tue: 'Tuesdays',
    Wed: 'Wednesdays',
    Thu: 'Thursdays',
    Fri: 'Fridays',
    Sat: 'Saturdays',
    Sun: 'Sundays'
  };

  return {
    day: dayNames[lowestDay.day] || lowestDay.day,
    diff: lowestDay.diffFromMean
  };
}

