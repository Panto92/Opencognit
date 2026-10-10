const key = 'a9da1c2b05b44e6aab439c1eabf90a1c.sUA5Z5RA5WV-QaM13K3Hl1L-';

async function testProvider(name, url, model, headers = {}) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        ...headers
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'hi' }]
      })
    });
    console.log(`[${name}] status: ${res.status}`);
    const text = await res.text();
    console.log(`[${name}] response: ${text.slice(0, 300)}`);
  } catch (e) {
    console.error(`[${name}] failed:`, e.message);
  }
}

async function main() {
  await testProvider(
    'Novita AI',
    'https://api.novita.ai/v3/openai/chat/completions',
    'google/gemma-2-9b-it'
  );
  await testProvider(
    'SiliconFlow',
    'https://api.siliconflow.cn/v1/chat/completions',
    'google/gemma-2-9b-it'
  );
  await testProvider(
    'Fireworks AI',
    'https://api.fireworks.ai/inference/v1/chat/completions',
    'accounts/fireworks/models/gemma2-9b-it'
  );
  await testProvider(
    'Hyperbolic',
    'https://api.hyperbolic.xyz/v1/chat/completions',
    'google/gemma-2-9b-it'
  );
  await testProvider(
    'SambaNova',
    'https://api.sambanova.ai/v1/chat/completions',
    'gemma-2-9b-it'
  );
}

main();
