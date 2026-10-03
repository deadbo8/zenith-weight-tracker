const http = require('http');

http.get('http://localhost:9223/json', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const list = JSON.parse(d);
    const p = list.find(t => t.url.includes('localhost') && t.type === 'page');
    if (!p) {
      console.log('No page found');
      return;
    }
    const ws = new WebSocket(p.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          expression: `({
            screen: document.querySelector('.android-screen.active')?.getAttribute('data-screen'),
            modals: Array.from(document.querySelectorAll('.modal-backdrop, .zenith-you-page, .speed-dial-scrim')).map(m => m.id),
            bodyClass: document.body.className
          })`,
          returnByValue: true
        }
      }));
    };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.method === 'Log.entryAdded') console.log('LOG ENTRY:', m.params.entry);
      if (m.method === 'Runtime.consoleAPICalled') console.log('CONSOLE:', m.params.type, m.params.args);
      if (m.id === 3) {
        console.log('STATE:', m.result?.result?.value);
        setTimeout(() => process.exit(0), 1000);
      }
    };
  });
});
