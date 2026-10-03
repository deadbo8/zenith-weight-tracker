const http = require('http');

http.get('http://localhost:9223/json', res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', async () => {
    const list = JSON.parse(d);
    const p = list.find(t => t.url.includes('localhost') && t.type === 'page');
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `(async () => {
            document.querySelector('.mobile-nav-item[data-tab="fuel"]')?.click();
            await new Promise(r => setTimeout(r, 400));
            const input = document.querySelector('#dock-chat-input');
            input.value = '2 eggs and toast';
            const sendBtn = document.querySelector('#btn-dock-send');
            sendBtn.disabled = false;
            sendBtn.click();
            await new Promise(r => setTimeout(r, 500));
            document.querySelector('#btn-estimate-offline')?.click();
            await new Promise(r => setTimeout(r, 500));
            return {
              title: document.querySelector('.confirm-title')?.innerText,
              items: Array.from(document.querySelectorAll('.confirm-item-row')).map(r => r.innerText.replace(/\\n/g, ' ')),
              macros: document.querySelector('.confirm-card-macros')?.innerText?.replace(/\\n/g, ' ')
            };
          })()`,
          returnByValue: true,
          awaitPromise: true
        }
      }));
    };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id === 1) {
        console.log('RESULT:', JSON.stringify(m.result?.result?.value, null, 2));
        ws.close();
      }
    };
  });
});
