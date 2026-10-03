/**
 * Zenith Chart.js Visualization Engine (Apple Health Style)
 * Precision monotone curves, 7-day EMA hero line, subtle raw weigh-in scatter,
 * right y-axis, hairline crosshair plugin, forecast projection, range morphing,
 * and scrub listener with rolling odometer numbers.
 */

import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  TimeScale,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

import { calculateEMA, calculateWeeklyAggregates, calculateWeekdayPatterns } from './analytics.js';
import { store, getLocalDateString } from './state.js';
import { calorieTarget } from './nutrition.js';
import { triggerHaptic } from './android.js';
import { rollTo } from './motion.js';

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  TimeScale,
  Filler,
  Tooltip,
  Legend
);

// Crosshair & Accent Scrub Dot Plugin
const zenithCrosshairPlugin = {
  id: 'zenithCrosshair',
  afterDatasetsDraw(chart) {
    const activeElements = chart.getActiveElements();
    if (!activeElements || !activeElements.length) return;
    const el = activeElements[0];
    if (!el || !el.element) return;
    const { x, y } = el.element;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;

    ctx.save();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    const accent = isDark ? '#30d158' : '#34c759';
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isDark ? '#000000' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
};

Chart.register(zenithCrosshairPlugin);

export class ChartManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    if (this.canvas) {
      this.canvas.setAttribute('data-no-sheet-drag', 'true');
    }
    this.ctx = canvasElement.getContext('2d');
    this.chart = null;
    this.currentView = 'trend'; // 'trend', 'composition', 'delta', 'patterns'
    this.currentTimeframe = '30D'; // '7D', '30D', '90D', '6M', '1Y', 'ALL'
    this.isTableView = false;
    this.tableContainer = null;
    this.lastHoveredIndex = -1;
  }

  getFilteredEntries(entries) {
    if (!entries || !entries.length) return [];
    if (this.currentTimeframe === 'ALL') return [...entries];

    const daysMap = {
      '7D': 7,
      '30D': 30,
      '90D': 90,
      '6M': 182,
      '1Y': 365
    };

    const days = daysMap[this.currentTimeframe] || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = entries.filter(e => new Date(e.date) >= cutoff);
    return filtered.length > 0 ? filtered : entries.slice(-Math.min(entries.length, days));
  }

  isDarkTheme() {
    const theme = store.getState().profile.theme;
    return theme !== 'light';
  }

  toggleTableView(entries, profile) {
    this.isTableView = !this.isTableView;
    this.render(entries, profile);
    return this.isTableView;
  }

  updateHeadline(valText, subText, shouldRoll = false, numericVal = null) {
    const valEl = document.querySelector('#trends-headline-val');
    const subEl = document.querySelector('#trends-headline-sub');
    if (valEl) {
      if (shouldRoll && numericVal != null) {
        const unit = store.getState().profile.unit || 'kg';
        rollTo(valEl, numericVal, 300, 1, ` ${unit}`);
      } else if (valText !== undefined) {
        if (valEl._rollRaf) {
          cancelAnimationFrame(valEl._rollRaf);
          valEl._rollRaf = null;
        }
        valEl.textContent = valText;
      }
    }
    if (subEl && subText !== undefined) subEl.textContent = subText;
  }

  render(entries, profile, isRangeMorph = false) {
    if (!this.canvas) return;

    const wrapper = this.canvas.parentElement;
    let overlay = wrapper ? wrapper.querySelector('.chart-empty-overlay') : null;
    let tableMount = wrapper ? wrapper.querySelector('.chart-table-view') : null;

    if (!entries || !entries.length) {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }
      this.canvas.style.display = 'none';
      if (tableMount) tableMount.style.display = 'none';
      if (wrapper) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'chart-empty-overlay';
          wrapper.appendChild(overlay);
        }
        overlay.style.display = 'flex';
        overlay.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 160 80" width="120" height="60" xmlns="http://www.w3.org/2000/svg">
              <path d="M 10 65 Q 50 60, 80 40 T 150 20" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round"/>
              <circle cx="80" cy="40" r="3.5" fill="#30d158"/>
              <circle cx="150" cy="20" r="4" fill="#30d158"/>
            </svg>
            <p style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">No Trend Data Yet</p>
            <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 280px; text-align: center;">
              Log daily weigh-ins to plot exponential moving averages and smart projections.
            </p>
          </div>
        `;
      }
      this.updateHeadline('-- ' + profile.unit, '0 days recorded');
      return;
    }

    if (overlay) overlay.style.display = 'none';

    // Check table view
    if (this.isTableView) {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }
      this.canvas.style.display = 'none';
      if (!tableMount && wrapper) {
        tableMount = document.createElement('div');
        tableMount.className = 'chart-table-view';
        wrapper.appendChild(tableMount);
      }
      if (tableMount) {
        tableMount.style.display = 'block';
        this.renderTableData(tableMount, entries, profile);
      }
      return;
    }

    this.canvas.style.display = 'block';
    if (tableMount) tableMount.style.display = 'none';

    const isDark = this.isDarkTheme();
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? 'rgba(235, 235, 245, 0.50)' : 'rgba(60, 60, 67, 0.55)';
    const unit = profile.unit;

    if (this.currentView === 'trend') {
      this.renderTrendChart(entries, profile, isDark, gridColor, textColor, unit, isRangeMorph);
    } else if (this.currentView === 'composition') {
      if (this.chart && !isRangeMorph) { this.chart.destroy(); this.chart = null; }
      this.renderCompositionChart(entries, profile, isDark, gridColor, textColor);
    } else if (this.currentView === 'delta') {
      if (this.chart && !isRangeMorph) { this.chart.destroy(); this.chart = null; }
      this.renderDeltaChart(entries, profile, isDark, gridColor, textColor, unit);
    } else if (this.currentView === 'patterns') {
      if (this.chart && !isRangeMorph) { this.chart.destroy(); this.chart = null; }
      this.renderPatternsChart(entries, profile, isDark, gridColor, textColor, unit);
    } else if (this.currentView === 'intake') {
      if (this.chart && !isRangeMorph) { this.chart.destroy(); this.chart = null; }
      this.renderIntakeChart(entries, profile, isDark, gridColor, textColor);
    }
  }

  renderTableData(container, allEntries, profile) {
    const entries = this.getFilteredEntries(allEntries);
    const unit = profile.unit;
    const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = `
      <div class="chart-table-wrap">
        <table class="chart-data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Weight (${unit})</th>
              <th>Body Fat</th>
              <th>Waist</th>
              <th>Condition</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(e => {
              const d = new Date(e.date);
              const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
              const wStr = store.formatWeight(e.weight, false);
              return `
                <tr>
                  <td>${dateStr}</td>
                  <td class="mono-num" style="font-weight: 600;">${wStr}</td>
                  <td class="mono-num">${e.bodyFat ? `${e.bodyFat}%` : '—'}</td>
                  <td class="mono-num">${e.waist ? `${e.waist}cm` : '—'}</td>
                  <td>${e.mood && e.mood !== 'normal' ? e.mood.replace('_', ' ') : 'Normal'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderTrendChart(allEntries, profile, isDark, gridColor, textColor, unit, isRangeMorph = false) {
    const entries = this.getFilteredEntries(allEntries);
    if (!entries.length) return;

    const labels = entries.map(e => {
      const d = new Date(e.date);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });

    const rawWeights = entries.map(e => store.toDisplayWeight(e.weight));
    const emaKg = calculateEMA(allEntries, 7);
    
    const startIndex = allEntries.indexOf(entries[0]);
    const filteredEmaKg = emaKg.slice(startIndex, startIndex + entries.length);
    const emaWeights = filteredEmaKg.map(w => store.toDisplayWeight(w));

    const latestWeight = rawWeights[rawWeights.length - 1];
    const latestEma = emaWeights[emaWeights.length - 1];
    const rangeText = `${this.currentTimeframe} · ${entries.length} weigh-ins`;
    this.updateHeadline(`${latestEma || latestWeight} ${unit}`, rangeText, false, latestEma || latestWeight);

    const hasGoal = profile.goalWeight != null && profile.goalWeight > 0;
    const goalWeightDisplay = hasGoal ? store.toDisplayWeight(profile.goalWeight) : null;
    const goalLineData = hasGoal ? Array(entries.length).fill(goalWeightDisplay) : null;

    // Subtle Apple 16% -> 0% vertical gradient fill under EMA line
    const accentColor = isDark ? '#30d158' : '#34c759';
    const gradient = this.ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, isDark ? 'rgba(48, 209, 88, 0.16)' : 'rgba(52, 199, 89, 0.12)');
    gradient.addColorStop(1, 'rgba(48, 209, 88, 0)');

    const allW = [...rawWeights];
    if (hasGoal && goalWeightDisplay != null) allW.push(goalWeightDisplay);
    const minWeight = Math.min(...allW);
    const maxWeight = Math.max(...allW);
    const padding = (maxWeight - minWeight) * 0.14 || 1.5;

    const datasets = [
      {
        label: `7-Day Trend`,
        data: emaWeights,
        borderColor: accentColor,
        borderWidth: 2.5,
        borderCapStyle: 'round',
        backgroundColor: gradient,
        fill: true,
        cubicInterpolationMode: 'monotone',
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: accentColor,
        pointHoverBorderColor: isDark ? '#000000' : '#ffffff',
        pointHoverBorderWidth: 2,
        order: 1
      },
      {
        type: 'line',
        label: `Logged Weight`,
        data: rawWeights,
        showLine: false,
        pointRadius: entries.length > 50 ? 1.8 : 2.5,
        pointBackgroundColor: isDark ? 'rgba(235, 235, 245, 0.35)' : 'rgba(60, 60, 67, 0.35)',
        pointBorderColor: 'transparent',
        pointBorderWidth: 0,
        pointHoverRadius: 5.5,
        pointHoverBackgroundColor: isDark ? '#ffffff' : '#000000',
        order: 2
      }
    ];

    if (hasGoal && goalLineData) {
      datasets.push({
        label: `Goal Target`,
        data: goalLineData,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
        borderWidth: 1,
        borderDash: [5, 4],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 3
      });
    }

    const self = this;

    // Range morph: if chart already exists and we are just changing timeframes, morph points!
    if (isRangeMorph && this.chart && this.chart.config.type === 'line') {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.options.scales.y.min = Math.floor(minWeight - padding);
      this.chart.options.scales.y.max = Math.ceil(maxWeight + padding);
      this.chart.update({
        duration: 500,
        easing: 'easeOutQuart'
      });
      return;
    }

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    this.chart = new Chart(this.ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 600,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        onHover: (event, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const idx = activeElements[0].index;
            if (idx !== self.lastHoveredIndex && idx >= 0 && idx < entries.length) {
              self.lastHoveredIndex = idx;
              triggerHaptic('light');
              const entry = entries[idx];
              const emaVal = emaWeights[idx];
              const rawVal = rawWeights[idx];
              const d = new Date(entry.date);
              const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
              
              let notePart = entry.mood && entry.mood !== 'normal' ? ` · ${entry.mood.replace('_', ' ')}` : '';
              if (entry.notes) notePart += ` · "${entry.notes.slice(0, 24)}"`;
              
              self.updateHeadline(
                `${emaVal || rawVal} ${unit}`,
                `${dateStr} · Logged ${rawVal} ${unit}${notePart}`,
                true,
                emaVal || rawVal
              );
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false // Crosshair + headline above canvas
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif', size: 10.5 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 5
            },
            border: { display: false }
          },
          y: {
            position: 'right', // Right y-axis (Apple Health standard)
            min: Math.floor(minWeight - padding),
            max: Math.ceil(maxWeight + padding),
            grid: {
              color: gridColor,
              drawTicks: false
            },
            ticks: {
              color: textColor,
              padding: 8,
              maxTicksLimit: 4,
              font: { family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif', size: 10.5 },
              callback: (val) => `${val}`
            },
            border: { display: false }
          }
        }
      }
    });
  }

  renderCompositionChart(allEntries, profile, isDark, gridColor, textColor) {
    const entries = this.getFilteredEntries(allEntries).filter(e => e.bodyFat != null);
    if (!entries.length) {
      this.renderTrendChart(allEntries, profile, isDark, gridColor, textColor, profile.unit);
      return;
    }

    const labels = entries.map(e => new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const fatPercentages = entries.map(e => e.bodyFat);
    const leanMass = entries.map(e => {
      const fatFraction = (e.bodyFat || 20) / 100;
      const weightDisplay = store.toDisplayWeight(e.weight);
      return Math.round((weightDisplay * (1 - fatFraction)) * 10) / 10;
    });

    const accent = isDark ? '#30d158' : '#34c759';
    const latestFat = fatPercentages[fatPercentages.length - 1];
    const latestLean = leanMass[leanMass.length - 1];
    this.updateHeadline(`${latestFat}% Body Fat`, `Lean Mass: ${latestLean} ${profile.unit} · ${entries.length} logs`);

    const self = this;

    this.chart = new Chart(this.ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Body Fat %',
            data: fatPercentages,
            borderColor: '#64d2ff',
            backgroundColor: 'rgba(100, 210, 255, 0.12)',
            fill: true,
            cubicInterpolationMode: 'monotone',
            tension: 0,
            yAxisID: 'yFat',
            pointRadius: 2.5,
            pointBackgroundColor: '#64d2ff'
          },
          {
            label: `Lean Mass (${profile.unit})`,
            data: leanMass,
            borderColor: accent,
            fill: false,
            cubicInterpolationMode: 'monotone',
            tension: 0,
            yAxisID: 'yWeight',
            pointRadius: 2.5,
            pointBackgroundColor: accent
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        onHover: (event, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const idx = activeElements[0].index;
            if (idx !== self.lastHoveredIndex && idx >= 0 && idx < entries.length) {
              self.lastHoveredIndex = idx;
              triggerHaptic('light');
              const d = new Date(entries[idx].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              self.updateHeadline(`${fatPercentages[idx]}% Body Fat`, `${d} · Lean Mass: ${leanMass[idx]} ${profile.unit}`);
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
              color: textColor,
              font: { family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif', size: 11, weight: '500' }
            }
          },
          tooltip: { enabled: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 5 }, border: { display: false } },
          yFat: {
            position: 'left',
            grid: { color: gridColor, drawTicks: false },
            ticks: { color: textColor, callback: v => `${v}%`, maxTicksLimit: 4 },
            border: { display: false }
          },
          yWeight: {
            position: 'right',
            grid: { display: false },
            ticks: { color: textColor, callback: v => `${v} ${profile.unit}`, maxTicksLimit: 4 },
            border: { display: false }
          }
        }
      }
    });
  }

  renderDeltaChart(allEntries, profile, isDark, gridColor, textColor, unit) {
    const weeklyData = calculateWeeklyAggregates(allEntries);
    if (!weeklyData.length) return;

    const labels = weeklyData.map(w => {
      const d = new Date(w.weekStart);
      return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    });

    const isLossGoal = (profile.goalWeight || 70) <= (profile.startWeight || 80);
    const deltas = weeklyData.map(w => store.toDisplayWeight(w.change));
    
    // Apple color rule: Accent for movement toward goal, Neutral Gray for movement away
    const accentColor = isDark ? '#30d158' : '#34c759';
    const neutralColor = isDark ? '#636366' : '#a1a1a6';
    const backgroundColors = deltas.map(val => {
      const towardGoal = isLossGoal ? val <= 0 : val >= 0;
      return towardGoal ? accentColor : neutralColor;
    });

    const latestDelta = deltas[deltas.length - 1];
    this.updateHeadline(
      `${latestDelta > 0 ? '+' : ''}${latestDelta} ${unit}`,
      `Most recent week net change · ${weeklyData.length} weeks tracked`
    );

    const self = this;

    this.chart = new Chart(this.ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: `Weekly Net (${unit})`,
          data: deltas,
          backgroundColor: backgroundColors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        onHover: (event, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const idx = activeElements[0].index;
            if (idx !== self.lastHoveredIndex && idx >= 0 && idx < weeklyData.length) {
              self.lastHoveredIndex = idx;
              triggerHaptic('light');
              const val = deltas[idx];
              const d = labels[idx];
              self.updateHeadline(`${val > 0 ? '+' : ''}${val} ${unit}`, `Week of ${d}`);
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 6 }, border: { display: false } },
          y: {
            position: 'right',
            grid: { color: gridColor, drawTicks: false },
            ticks: {
              color: textColor,
              maxTicksLimit: 4,
              callback: v => `${v > 0 ? '+' : ''}${v} ${unit}`
            },
            border: { display: false }
          }
        }
      }
    });
  }

  renderPatternsChart(allEntries, profile, isDark, gridColor, textColor, unit) {
    const patterns = calculateWeekdayPatterns(allEntries);
    const labels = patterns.map(p => p.day);
    const diffs = patterns.map(p => store.toDisplayWeight(p.diffFromMean));
    
    const accentColor = isDark ? '#30d158' : '#34c759';
    const neutralColor = isDark ? '#636366' : '#a1a1a6';
    const backgroundColors = diffs.map(v => Math.abs(v) < 0.2 ? accentColor : neutralColor);

    this.updateHeadline(`Weekday Fluctuation`, `Average deviation from baseline trend`);
    const self = this;

    this.chart = new Chart(this.ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: `Deviation from Mean (${unit})`,
          data: diffs,
          backgroundColor: backgroundColors,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        onHover: (event, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const idx = activeElements[0].index;
            if (idx !== self.lastHoveredIndex && idx >= 0 && idx < patterns.length) {
              self.lastHoveredIndex = idx;
              triggerHaptic('light');
              const val = diffs[idx];
              const day = labels[idx];
              self.updateHeadline(
                `${val > 0 ? '+' : ''}${val} ${unit}`,
                `${day} average vs weekly baseline`
              );
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor }, border: { display: false } },
          y: {
            position: 'right',
            grid: { color: gridColor, drawTicks: false },
            ticks: {
              color: textColor,
              maxTicksLimit: 4,
              callback: v => `${v > 0 ? '+' : ''}${v} ${unit}`
            },
            border: { display: false }
          }
        }
      }
    });
  }

  renderIntakeChart(allEntries, profile, isDark, gridColor, textColor) {
    const meals = store.getState().meals || [];
    const targetKcal = calorieTarget(profile, 2200);

    // Group meals by localDate
    const dateMap = new Map();
    for (const m of meals) {
      const d = m.localDate;
      const prev = dateMap.get(d) || { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
      dateMap.set(d, {
        kcal: prev.kcal + (m.totals?.kcal || 0),
        proteinG: prev.proteinG + (m.totals?.proteinG || 0),
        carbsG: prev.carbsG + (m.totals?.carbsG || 0),
        fatG: prev.fatG + (m.totals?.fatG || 0)
      });
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    if (!sortedDates.length) {
      sortedDates.push(getLocalDateString());
      dateMap.set(getLocalDateString(), { kcal: 0, proteinG: 0 });
    }

    const labels = sortedDates.map(d => {
      const parts = d.split('-');
      return `${parts[1]}/${parts[2]}`;
    });

    const kcals = sortedDates.map(d => dateMap.get(d)?.kcal || 0);
    const targetLine = sortedDates.map(() => targetKcal);

    const accent = isDark ? '#30d158' : '#34c759';
    const overColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)';
    const barColors = kcals.map(k => k > targetKcal ? overColor : accent);

    const avgKcal = Math.round(kcals.reduce((a, b) => a + b, 0) / Math.max(1, kcals.length));
    this.updateHeadline(`${avgKcal} kcal avg`, `Target: ${targetKcal} kcal · ${sortedDates.length} days recorded`);

    const self = this;
    this.chart = new Chart(this.ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: 'Goal',
            data: targetLine,
            borderColor: 'rgba(255, 255, 255, 0.35)',
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          },
          {
            type: 'bar',
            label: 'Daily Intake (kcal)',
            data: kcals,
            backgroundColor: barColors,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        onHover: (event, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const idx = activeElements[0].index;
            if (idx !== self.lastHoveredIndex && idx >= 0 && idx < sortedDates.length) {
              self.lastHoveredIndex = idx;
              triggerHaptic('light');
              const dStr = sortedDates[idx];
              const k = kcals[idx];
              const diff = k - targetKcal;
              const diffText = diff > 0 ? `${diff} over` : `${Math.abs(diff)} left`;
              self.updateHeadline(
                `${k} kcal`,
                `${dStr} · ${diffText} (Goal ${targetKcal})`
              );
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 6 }, border: { display: false } },
          y: {
            position: 'right',
            grid: { color: gridColor, drawTicks: false },
            ticks: {
              color: textColor,
              maxTicksLimit: 4,
              callback: v => `${v}`
            },
            border: { display: false }
          }
        }
      }
    });
  }

  setView(viewName, entries, profile) {
    this.currentView = viewName;
    this.render(entries, profile, false);
  }

  setTimeframe(timeframe, entries, profile) {
    this.currentTimeframe = timeframe;
    // Morph points if on trend line chart!
    this.render(entries, profile, this.currentView === 'trend');
  }
}
