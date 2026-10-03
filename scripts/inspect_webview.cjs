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
          if (!page) reject(new Error('No localhost page found in ' + data));
          else resolve(page.webSocketDebuggerUrl);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function evalInApp(expression) {
  const url = await getDebuggerUrl();
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  return new Promise((resolve, reject) => {
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1) {
        ws.close();
        if (msg.error) return reject(msg.error);
        if (msg.result?.exceptionDetails) {
          return reject(msg.result.exceptionDetails);
        }
        resolve(msg.result?.result?.value);
      }
    };
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `(async function(){ ${expression} })()`,
        returnByValue: true,
        awaitPromise: true
      }
    }));
  });
}

async function main() {
  const cmd = process.argv[2] || 'status';
  const arg = process.argv[3];

  let code;
  if (cmd === 'status') {
    code = `return {
      bodyClasses: document.body.className,
      activeTab: document.querySelector('.mobile-nav-item.active')?.innerText?.trim(),
      visibleScreens: Array.from(document.querySelectorAll('.android-screen.active')).map(s => s.getAttribute('data-screen')),
      modals: Array.from(document.querySelectorAll('.modal-backdrop, .zenith-you-page')).map(m => ({ id: m.id, className: m.className, display: getComputedStyle(m).display, opacity: getComputedStyle(m).opacity })),
      todaySummary: document.querySelector('.today-hero-title')?.innerText?.trim(),
      fuelCalories: document.querySelector('.fuel-calories-summary')?.innerText?.trim(),
      logWeightOpen: !!document.querySelector('#modal-log-weight.open')
    };`;
  } else if (cmd === 'tab') {
    code = `
      return (async () => {
        const targetTab = "${arg}";
        const btn = document.querySelector('.mobile-nav-item[data-tab="' + targetTab + '"]');
        if (btn) {
          btn.click();
          await new Promise(r => setTimeout(r, 250));
          return {
            success: true,
            targetTab,
            activeTab: document.querySelector('.mobile-nav-item.active')?.getAttribute('data-tab'),
            activeScreen: document.querySelector('.android-screen.active')?.getAttribute('data-screen')
          };
        }
        return { success: false, error: 'Tab not found: ' + targetTab };
      })()
    `;
  } else if (cmd === 'click') {
    code = `
      const el = document.querySelector("${arg}");
      if (el) {
        el.click();
        return { success: true, clicked: "${arg}" };
      }
      return { success: false, error: 'Element not found: ' + "${arg}" };
    `;
  } else if (cmd === 'scroll-you') {
    code = `
      const el = document.querySelector('.you-page-scrollable');
      if (el) {
        el.scrollTop += ${Number(arg) || 300};
        return { success: true, scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
      }
      return { success: false, error: 'you-page-scrollable not found' };
    `;
  } else if (cmd === 'eval') {
    code = arg;
  } else {
    code = `return { error: 'Unknown command: ' + "${cmd}" };`;
  }

  try {
    const res = await evalInApp(code);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Eval error:', err);
    process.exit(1);
  }
}

main();
