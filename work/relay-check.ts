import http from 'node:http';
const mod = await import('../api/provider-audio.ts');
const handler = mod.default;

const server = http.createServer(async (req, res) => {
  req.body = await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
  });
  res.status = (s) => { res.statusCode = s; return res; };
  res.json = (payload) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(payload)); return res; };
  res.send = (payload) => { res.end(Buffer.from(payload)); return res; };
  try {
    await handler(req, res);
  } catch (error) {
    console.log('HANDLER THREW:', error && error.message);
    if (!res.writableEnded) res.end('handler-error');
  }
});

await new Promise((resolve) => server.listen(4599, resolve));
console.log('listening on 4599');

const res = await fetch('http://127.0.0.1:4599/api/provider-audio', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    endpoint: 'https://api.fish.audio/v1/tts',
    headers: { authorization: 'Bearer test-key', 'content-type': 'application/json' },
    body: { text: '你好', format: 'mp3', normalize: true }
  })
});
console.log('relay status =', res.status);
console.log('relay body =', (await res.text()).slice(0, 300));
process.exit(0);
