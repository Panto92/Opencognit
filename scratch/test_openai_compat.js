const key = 'a9da1c2b05b44e6aab439c1eabf90a1c.sUA5Z5RA5WV-QaM13K3Hl1L-';

async function testOpenAICompat() {
  console.log('Testing OpenAI-compatible chat/completions...');
  try {
    const res = await fetch('https://api.ollama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gemma3:27b',
        messages: [{ role: 'user', content: 'Say hello!' }]
      })
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.slice(0, 1000)}`);
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

async function testNativeChat() {
  console.log('Testing Native Ollama api/chat...');
  try {
    const res = await fetch('https://api.ollama.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gemma3:27b',
        messages: [{ role: 'user', content: 'Say hello!' }],
        stream: false
      })
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.slice(0, 1000)}`);
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

async function main() {
  await testOpenAICompat();
  await testNativeChat();
}

main();
