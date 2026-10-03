const http = require('http');

async function getDebuggerUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9223/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.url.includes('localhost') && t.type === 'page');
          if (!page) reject(new Error('No localhost page found'));
          else resolve(page.webSocketDebuggerUrl);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runTest() {
  const url = await getDebuggerUrl();
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let idCounter = 1;
  const consoleMessages = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleMessages.push({
        type: msg.params.type,
        args: msg.params.args?.map(a => a.value || a.description)
      });
    }
  };

  // Enable console events
  ws.send(JSON.stringify({ id: idCounter++, method: 'Runtime.enable' }));

  async function evaluate(code) {
    const id = idCounter++;
    return new Promise((resolve, reject) => {
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) return reject(msg.error);
          if (msg.result?.exceptionDetails) return reject(msg.result.exceptionDetails);
          resolve(msg.result?.result?.value);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {
          expression: `(async function() { ${code} })()`,
          returnByValue: true,
          awaitPromise: true
        }
      }));
    });
  }

  const results = {};

  // 1. Initial State
  results.initial = await evaluate(`
    return {
      activeTab: document.querySelector('.mobile-nav-item.active')?.innerText?.trim(),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  // 2. Test Today Tab (data-tab="summary")
  results.switchToday = await evaluate(`
    document.querySelector('.mobile-nav-item[data-tab="summary"]')?.click();
    await new Promise(r => setTimeout(r, 400));
    return {
      activeScreen: document.querySelector('.android-screen.active')?.getAttribute('data-screen'),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  // 3. Test Trends Tab
  results.switchTrends = await evaluate(`
    document.querySelector('.mobile-nav-item[data-tab="trends"]')?.click();
    await new Promise(r => setTimeout(r, 400));
    return {
      activeScreen: document.querySelector('.android-screen.active')?.getAttribute('data-screen'),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  // 4. Test Journey Tab (data-tab="milestones")
  results.switchJourney = await evaluate(`
    document.querySelector('.mobile-nav-item[data-tab="milestones"]')?.click();
    await new Promise(r => setTimeout(r, 400));
    return {
      activeScreen: document.querySelector('.android-screen.active')?.getAttribute('data-screen'),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  // 5. Test Calculator Modal
  results.calcModal = await evaluate(`
    const chip = document.querySelector('#chip-open-calc');
    if (chip) chip.click();
    await new Promise(r => setTimeout(r, 400));
    const isOpen = !!document.querySelector('#modal-calculators.open');
    const doneBtn = document.querySelector('#btn-done-calc');
    if (doneBtn) doneBtn.click();
    await new Promise(r => setTimeout(r, 400));
    return {
      opened: isOpen,
      closedCleanly: !document.querySelector('#modal-calculators'),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  // 6. Test Badges Modal
  results.badgesModal = await evaluate(`
    const chip = document.querySelector('#btn-streak-badge') || document.querySelector('.streak-chip');
    if (chip) chip.click();
    await new Promise(r => setTimeout(r, 400));
    const isOpen = !!document.querySelector('#modal-badges.open');
    const doneBtn = document.querySelector('#btn-done-badges');
    if (doneBtn) doneBtn.click();
    await new Promise(r => setTimeout(r, 400));
    return {
      opened: isOpen,
      closedCleanly: !document.querySelector('#modal-badges'),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  // 7. Test Profile (You Screen)
  results.profileScreen = await evaluate(`
    const btn = document.querySelector('#btn-open-you');
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 400));
    const isOpen = !!document.querySelector('#zenith-you-page.is-visible');
    const closeBtn = document.querySelector('#btn-close-you');
    if (closeBtn) closeBtn.click();
    await new Promise(r => setTimeout(r, 400));
    return {
      opened: isOpen,
      closedCleanly: !document.querySelector('#zenith-you-page'),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  // 8. Test Log Weight Sheet (+ FAB)
  results.logWeightSheet = await evaluate(`
    // Switch to summary tab first so FAB is for weight
    document.querySelector('.mobile-nav-item[data-tab="summary"]')?.click();
    await new Promise(r => setTimeout(r, 300));
    const btn = document.querySelector('#mobile-center-add');
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 400));
    const isOpen = !!document.querySelector('#modal-log-weight.open');
    const closeBtn = document.querySelector('#btn-cancel-log');
    if (closeBtn) closeBtn.click();
    await new Promise(r => setTimeout(r, 400));
    return {
      opened: isOpen,
      closedCleanly: !document.querySelector('#modal-log-weight'),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  // 9. Back to Fuel tab and test Add Food Sheet
  results.fuelAddFood = await evaluate(`
    document.querySelector('.mobile-nav-item[data-tab="fuel"]')?.click();
    await new Promise(r => setTimeout(r, 400));
    const manualBtn = document.querySelector('#btn-quick-chip-manual');
    if (manualBtn) manualBtn.click();
    await new Promise(r => setTimeout(r, 400));
    const isOpen = !!document.querySelector('#modal-add-food.open');
    const cancelBtn = document.querySelector('#btn-cancel-add-food');
    if (cancelBtn) cancelBtn.click();
    await new Promise(r => setTimeout(r, 400));
    return {
      opened: isOpen,
      closedCleanly: !document.querySelector('#modal-add-food'),
      bodyClasses: document.body.className,
      appPointerEvents: getComputedStyle(document.getElementById('app')).pointerEvents
    };
  `);

  ws.close();
  console.log(JSON.stringify({ results, consoleErrors: consoleMessages.filter(c => c.type === 'error' || c.type === 'warning') }, null, 2));
}

runTest().catch(console.error);
