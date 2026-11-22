// src/preflight.js - Verify each API key works BEFORE running the workflow
import dotenv from 'dotenv';
dotenv.config();

const results = {};

async function testNIM() {
  console.log('\n🔍 Testing NVIDIA NIM...');
  if (!process.env.NIM_API_KEY) {
    console.log('  ⚠️  NIM_API_KEY not set — skipping');
    results.nim = 'skipped';
    return;
  }
  try {
    const res = await fetch(`${process.env.NIM_ENDPOINT || 'https://integrate.api.nvidia.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NIM_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.NIM_MODEL || 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: 'Say "hello" in one word' }],
        max_tokens: 10
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      const err = await res.text();
      console.log(`  ❌ NIM failed: HTTP ${res.status} — ${err.slice(0, 200)}`);
      results.nim = `failed: ${res.status}`;
      return;
    }
    const data = await res.json();
    console.log(`  ✅ NIM works! Response: "${data.choices?.[0]?.message?.content?.trim()}"`);
    results.nim = 'ok';
  } catch (e) {
    console.log(`  ❌ NIM error: ${e.message}`);
    results.nim = `error: ${e.message}`;
  }
}

async function testOpenRouter() {
  console.log('\n🔍 Testing OpenRouter...');
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('  ⚠️  OPENROUTER_API_KEY not set — skipping');
    results.openrouter = 'skipped';
    return;
  }
  try {
    const res = await fetch(`${process.env.OPENROUTER_ENDPOINT || 'https://openrouter.ai/api/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://o-lang.cloud',
        'X-Title': 'O-Lang Preflight'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: 'Say "hello" in one word' }],
        max_tokens: 10
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      const err = await res.text();
      console.log(`  ❌ OpenRouter failed: HTTP ${res.status} — ${err.slice(0, 200)}`);
      results.openrouter = `failed: ${res.status}`;
      return;
    }
    const data = await res.json();
    console.log(`  ✅ OpenRouter works! Response: "${data.choices?.[0]?.message?.content?.trim()}"`);
    results.openrouter = 'ok';
  } catch (e) {
    console.log(`  ❌ OpenRouter error: ${e.message}`);
    results.openrouter = `error: ${e.message}`;
  }
}

async function testRedis() {
  console.log('\n🔍 Testing Redis...');
  if (!process.env.REDIS_URL) {
    console.log('  ⚠️  REDIS_URL not set — skipping (mock memory-store will be used)');
    results.redis = 'skipped';
    return;
  }
  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    await client.set('olang_preflight_test', 'ok', { EX: 10 });
    const val = await client.get('olang_preflight_test');
    await client.quit();
    if (val === 'ok') {
      console.log(`  ✅ Redis works!`);
      results.redis = 'ok';
    } else {
      console.log(`  ❌ Redis read mismatch`);
      results.redis = 'read_mismatch';
    }
  } catch (e) {
    console.log(`  ❌ Redis error: ${e.message}`);
    results.redis = `error: ${e.message}`;
  }
}

async function testLocalModel() {
  console.log('\n🔍 Testing Local Model...');
  if (!process.env.LOCAL_MODEL_ENDPOINT) {
    console.log('  ⚠️  LOCAL_MODEL_ENDPOINT not set — skipping');
    results.local = 'skipped';
    return;
  }
  try {
    const provider = process.env.LOCAL_PROVIDER || 'llama-cpp';
    let res;
    if (provider === 'ollama') {
      res = await fetch(`${process.env.LOCAL_MODEL_ENDPOINT}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });
    } else {
      res = await fetch(`${process.env.LOCAL_MODEL_ENDPOINT}/health`, {
        signal: AbortSignal.timeout(5000)
      }).catch(() => null);
      if (!res) {
        // Try /completion with minimal payload as fallback
        res = await fetch(`${process.env.LOCAL_MODEL_ENDPOINT}/completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'hi', n_predict: 1 }),
          signal: AbortSignal.timeout(5000)
        });
      }
    }
    if (res && res.ok) {
      console.log(`  ✅ Local model (${provider}) reachable!`);
      results.local = 'ok';
    } else {
      console.log(`  ❌ Local model unreachable: HTTP ${res?.status || 'no response'}`);
      results.local = `failed: ${res?.status}`;
    }
  } catch (e) {
    console.log(`  ❌ Local model error: ${e.message}`);
    results.local = `error: ${e.message}`;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🛫  O-LANG PREFLIGHT CHECK');
  console.log('='.repeat(60));
  
  await testNIM();
  await testOpenRouter();
  await testRedis();
  await testLocalModel();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  for (const [k, v] of Object.entries(results)) {
    const icon = v === 'ok' ? '✅' : v === 'skipped' ? '⚠️ ' : '❌';
    console.log(`  ${icon} ${k.padEnd(12)} ${v}`);
  }
  
  const okCount = Object.values(results).filter(v => v === 'ok').length;
  const skippedCount = Object.values(results).filter(v => v === 'skipped').length;
  
  console.log('\n' + '='.repeat(60));
  if (okCount >= 2) {
    console.log(`✅ Ready to run! ${okCount} service(s) working, ${skippedCount} skipped.`);
    console.log('   Run: node src/run-test.js --real');
  } else {
    console.log(`⚠️  Only ${okCount} service(s) working. Configure .env and try again.`);
    console.log('   Or run mock mode: node src/run-test.js');
  }
}

main();