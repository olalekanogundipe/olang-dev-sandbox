let requestCount = 0;
const resolver = async function(action, context) {
  if (!action.includes('analyze_request')) return undefined;
  
  requestCount++;
  console.log('[MOCK NIM] Attempting request #' + requestCount);
  
  if (requestCount === 1) {
    console.error('[MOCK NIM]  429 Too Many Requests - Rate limit exceeded');
    throw new Error('GATEWAY_RATE_LIMIT');
  }
  
  return { success: true, resolver: 'mock-nim-resolver', decision: { action: 'approve', confidence: 0.87 } };
};
resolver.resolverName = 'mock-nim-resolver';
export default resolver;
