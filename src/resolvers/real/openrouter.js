// Real OpenRouter resolver (fallback)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_ENDPOINT = process.env.OPENROUTER_ENDPOINT || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
const OPENROUTER_TIMEOUT = parseInt(process.env.OPENROUTER_TIMEOUT || '30000');

const resolver = async function(action, context) {
  if (!action.includes('analyze_request')) return undefined;
  
  if (!OPENROUTER_API_KEY) {
    const err = new Error('OPENROUTER_API_KEY not set.');
    err.requiredEnvVars = ['OPENROUTER_API_KEY'];
    throw err;
  }

  console.log(`[REAL OPENROUTER] 🚀 Fallback to ${OPENROUTER_MODEL}...`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT);

  try {
    const response = await fetch(`${OPENROUTER_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://o-lang.cloud',
        'X-Title': 'O-Lang Resilience Test'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'You are a fallback AI assistant. Provide analysis with structured JSON: { "action": "approve|reject", "confidence": 0.0-1.0, "reason": "..." }' },
          { role: 'user', content: context.user_message || action }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[REAL OPENROUTER] ❌ HTTP ${response.status}: ${errorText}`);
      throw new Error(`OPENROUTER_ERROR_${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let decision;
    try {
      decision = JSON.parse(content);
    } catch {
      decision = { action: 'approve', confidence: 0.7, reason: content };
    }
    
    console.log(`[REAL OPENROUTER] ✅ Fallback response received`);
    
    return {
      success: true,
      resolver: 'openrouter',
      model: OPENROUTER_MODEL,
      decision: { ...decision, fallback: true },
      usage: data.usage
    };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('FALLBACK_TIMEOUT');
    throw error;
  }
};

resolver.resolverName = 'openrouter';
export default resolver;