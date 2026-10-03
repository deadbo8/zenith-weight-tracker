const http = require('http');

async function getDebuggerUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9223/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const list = JSON.parse(data);
        const page = list.find(t => t.url.includes('localhost') && t.type === 'page');
        if (!page) reject(new Error('No localhost page found'));
        else resolve(page.webSocketDebuggerUrl);
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

  // 1. Switch to Fuel Screen
  results.step1_switchFuel = await evaluate(`
    document.querySelector('.mobile-nav-item[data-tab="fuel"]')?.click();
    await new Promise(r => setTimeout(r, 400));
    const centerBtn = document.querySelector('#mobile-center-add');
    const dock = document.querySelector('#fuel-chat-dock');
    return {
      activeScreen: document.querySelector('.android-screen.active')?.getAttribute('data-screen'),
      centerBtnDisplay: centerBtn ? getComputedStyle(centerBtn).display : null,
      dockVisible: !!dock,
      bodyClasses: document.body.className
    };
  `);

  // 2. Type "2 boiled eggs and 1 toast" into chat dock and verify send button activates
  results.step2_typeInput = await evaluate(`
    const input = document.querySelector('#dock-chat-input');
    const sendBtn = document.querySelector('#btn-dock-send');
    if (!input || !sendBtn) return { error: 'input or sendBtn missing' };

    input.value = '2 boiled eggs and 1 toast';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    return {
      inputValue: input.value,
      sendBtnDisabled: sendBtn.disabled,
      sendBtnActive: sendBtn.classList.contains('is-active')
    };
  `);

  // 3. Click Send
  results.step3_sendClick = await evaluate(`
    const sendBtn = document.querySelector('#btn-dock-send');
    sendBtn.click();
    await new Promise(r => setTimeout(r, 500));

    const messages = Array.from(document.querySelectorAll('#fuel-chat-messages > div')).map(el => ({
      className: el.className,
      id: el.id,
      text: el.innerText.trim().slice(0, 100)
    }));

    return {
      messagesCount: messages.length,
      messages,
      hasUserBubble: !!document.querySelector('.chat-bubble.user'),
      hasKeyPromptCard: !!document.querySelector('#gemini-key-prompt-card')
    };
  `);

  // 4. Click "⚡ Estimate Offline" on the inline card
  results.step4_estimateOffline = await evaluate(`
    const offlineBtn = document.querySelector('#btn-estimate-offline');
    if (!offlineBtn) return { error: 'Offline estimate button not found' };

    offlineBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const confirmCard = document.querySelector('.meal-confirm-card');
    const title = confirmCard?.querySelector('.confirm-title')?.innerText;
    const kcal = confirmCard?.querySelector('.confirm-kcal-headline strong')?.innerText;

    return {
      hasConfirmCard: !!confirmCard,
      cardTitle: title,
      cardKcal: kcal,
      saveBtnExists: !!confirmCard?.querySelector('#btn-confirm-save')
    };
  `);

  // 5. Click "Confirm & Log" on the confirm card
  results.step5_saveMeal = await evaluate(`
    const saveBtn = document.querySelector('#btn-confirm-save');
    if (!saveBtn) return { error: 'Confirm save button not found' };

    saveBtn.click();
    await new Promise(r => setTimeout(r, 600));

    const mealsCount = document.querySelectorAll('.fuel-timeline-wrapper .timeline-meal-card, .fuel-timeline-wrapper .meal-item-card, .meal-entry-card').length;
    const toast = document.querySelector('.zenith-toast');

    return {
      toastText: toast?.innerText?.trim(),
      mealsInTimeline: mealsCount
    };
  `);

  ws.close();
  console.log(JSON.stringify(results, null, 2));
}

runTest().catch(console.error);
