// src/run-test.js - Supports both mock and real resolvers
import { execute, parse } from '@o-lang/olang';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse --real flag from command line
const USE_REAL = process.argv.includes('--real');

async function loadResolvers() {
  const mode = USE_REAL ? 'real' : 'mock';
  const resolverDir = USE_REAL ? './resolvers/real' : './resolvers';
  
  console.log(`\n📦 Loading ${mode.toUpperCase()} resolvers from ${resolverDir}/\n`);
  
  const [memoryStore, nim, openRouter, local] = await Promise.all([
    import(`${resolverDir}/memory-store.js`),
    import(`${resolverDir}/nvidia-nim.js`),
    import(`${resolverDir}/openrouter.js`),
    import(`${resolverDir}/local-model.js`)
  ]);
  
  return [
    memoryStore.default,
    nim.default,
    openRouter.default,
    local.default
  ];
}

async function runTest() {
  const mode = USE_REAL ? 'REAL' : 'MOCK';
  
  console.log('\n' + '='.repeat(70));
  console.log(`🛡️  O-LANG RESILIENCE TEST — ${mode} MODE`);
  console.log('='.repeat(70));
  
  // Configuration check
  console.log('\n📋 Configuration:');
  if (USE_REAL) {
    console.log('  NIM API Key:', process.env.NIM_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('  OpenRouter Key:', process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('  Redis URL:', process.env.REDIS_URL || '❌ Missing');
    console.log('  Local Model:', process.env.LOCAL_MODEL_ENDPOINT || '❌ Missing');
    
    if (!process.env.NIM_API_KEY && !process.env.OPENROUTER_API_KEY) {
      console.error('\n❌ ERROR: No API keys configured for real mode.');
      console.error('   Either set NIM_API_KEY / OPENROUTER_API_KEY in .env,');
      console.error('   or run without --real flag to use mock resolvers.');
      process.exit(1);
    }
  } else {
    console.log('  Mode: Mock (no external calls)');
    console.log('  Tip: Run with --real to test against actual APIs');
  }

  // Load resolvers
  const resolvers = await loadResolvers();

  // Load workflow
  const workflowPath = path.join(__dirname, 'workflows', 'test-workflow.ol');
  if (!fs.existsSync(workflowPath)) {
    console.error(`❌ Workflow not found: ${workflowPath}`);
    process.exit(1);
  }
  
  const workflowSource = fs.readFileSync(workflowPath, 'utf8');
  const workflow = parse(workflowSource, 'test-workflow.ol');

  const inputs = {
    user_message: 'Test authorization request for transfer of $5000'
  };

  try {
    console.log('\n🚀 Starting workflow execution...\n');
    const startTime = Date.now();
    
    const result = await execute(workflow, inputs, resolvers, true);
    const duration = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL RESULT');
    console.log('='.repeat(70));
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n' + '='.repeat(70));
    console.log('🔐 AUDIT TRAIL');
    console.log('='.repeat(70));
    console.log('Execution Hash:', result.__audit?.executionHash);
    console.log('Merkle Root:', result.__audit?.merkleRoot);
    console.log('Steps Executed:', result.__audit?.stepsExecuted);
    console.log('Duration:', duration + 'ms');
    console.log('Deterministic:', result.__audit?.deterministic);
    
    console.log('\n' + '='.repeat(70));
    console.log(`✅ ${mode} TEST COMPLETED SUCCESSFULLY`);
    console.log('='.repeat(70));
    
    if (!USE_REAL) {
      console.log('\n💡 Next step: configure .env and run with --real to test actual APIs');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();