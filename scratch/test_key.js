const key = 'a9da1c2b05b44e6aab439c1eabf90a1c.sUA5Z5RA5WV-QaM13K3Hl1L-';

async function listModels() {
  console.log('Listing models from ollama.com/api/tags...');
  try {
    const res = await fetch('https://ollama.com/api/tags', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text}`);
  } catch (e) {
    console.error('List models failed:', e.message);
  }
}

async function listModelsNoAuth() {
  console.log('Listing models from ollama.com/api/tags without auth...');
  try {
    const res = await fetch('https://ollama.com/api/tags', {
      method: 'GET'
    });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text}`);
  } catch (e) {
    console.error('List models failed:', e.message);
  }
}

async function main() {
  await listModels();
  await listModelsNoAuth();
}

main();
