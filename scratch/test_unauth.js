async function testOllamaCloudApi(key, name) {
  try {
    const res = await fetch('https://api.ollama.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gemma',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false
      })
    });
    console.log(`[Ollama Cloud API - ${name}] status: ${res.status}`);
    const text = await res.text();
    console.log(`[Ollama Cloud API - ${name}] response: ${text.slice(0, 300)}`);
  } catch (e) {
    console.error(`[Ollama Cloud API - ${name}] failed:`, e.message);
  }
}

async function main() {
  const userKey = 'a9da1c2b05b44e6aab439c1eabf90a1c.sUA5Z5RA5WV-QaM13K3Hl1L-';
  const badKey = 'invalid_key_dummy_123';

  await testOllamaCloudApi(userKey, 'USER_KEY');
  await testOllamaCloudApi(badKey, 'BAD_KEY');
}

main();
