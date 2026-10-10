const keyWithPrefix = 'sk-poe-a9da1c2b05b44e6aab439c1eabf90a1c.sUA5Z5RA5WV-QaM13K3Hl1L-';
const keyWithoutPrefix = 'a9da1c2b05b44e6aab439c1eabf90a1c.sUA5Z5RA5WV-QaM13K3Hl1L-';

async function testPoe(k, name) {
  try {
    const res = await fetch('https://api.poe.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${k}`
      },
      body: JSON.stringify({
        model: 'gemma-2-9b-it',
        messages: [{ role: 'user', content: 'hi' }]
      })
    });
    console.log(`[Poe - ${name}] status: ${res.status}`);
    const text = await res.text();
    console.log(`[Poe - ${name}] response: ${text}`);
  } catch (e) {
    console.error(`[Poe - ${name}] failed:`, e.message);
  }
}

async function main() {
  await testPoe(keyWithPrefix, 'WITH_PREFIX');
  await testPoe(keyWithoutPrefix, 'WITHOUT_PREFIX');
}

main();
