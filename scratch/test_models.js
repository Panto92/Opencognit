const key = 'a9da1c2b05b44e6aab439c1eabf90a1c.sUA5Z5RA5WV-QaM13K3Hl1L-';

async function main() {
  const res = await fetch('https://api.ollama.com/v1/models', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main();
