// Real NVIDIA NIM resolver
const NIM_API_KEY = process.env.NIM_API_KEY;
const NIM_ENDPOINT = process.env.NIM_ENDPOINT || 'https://integrate.api.nvidia.com/v1';
const NIM_MODEL = process.env.NIM_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';
const NIM_TIMEOUT = parseInt(process.env.NIM_TIMEOUT || '30000');

const resolver = async function(action, context) {
  if (!action.includes('analyze_request')) return undefined;
  
  if (!NIM_API_KEY) {
    const err = new Error('NIM_API_KEY not set.');
    err.requiredEnvVars = ['NIM_API_KEY'];
    throw err;
  }

  console.log('[REAL NIM] 🚀 Sending to ' + NIM_MODEL + '...');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NIM_TIMEOUT);

  try {
    const response = await fetch(NIM_ENDPOINT + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + NIM_API_KEY
      },
      body: JSON.stringify({
        model: NIM_MODEL,
        messages: [
          { 
            role: 'system', 
            content: 'You are a secure AI assistant. Analyze the request and provide a structured JSON response with: { "action": "approve|reject", "confidence": 0.0-1.0, "reason": "..." }' 
          },
          { 
            role: 'user', 
            content: context.user_message || action 
          }
        ],
        temperature: 0.3,
        top_p: 0.95,
        max_tokens: 1024
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[REAL NIM] ❌ HTTP ' + response.status + ': ' + errorText);
      
      if (response.status === 429) throw new Error('GATEWAY_RATE_LIMIT');
      if (response.status === 503) throw new Error('GATEWAY_UNAVAILABLE');
      if (response.status === 401) throw new Error('GATEWAY_AUTH_FAILED');
      throw new Error('NIM_ERROR_' + response.status);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let decision;
    try {
      decision = JSON.parse(content);
    } catch {
      decision = { action: 'approve', confidence: 0.75, reason: content };
    }
    
    console.log('[REAL NIM] ✅ Response received (tokens: ' + (data.usage?.total_tokens || '?') + ')');
    
    return {
      success: true,
      resolver: 'nvidia-nim',
      model: NIM_MODEL,
      decision: decision,
      usage: data.usage
    };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('[REAL NIM] ⏱️ Request timeout');
      throw new Error('GATEWAY_TIMEOUT');
    }
    throw error;
  }
};

resolver.resolverName = 'nvidia-nim';
export default resolver;