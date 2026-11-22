const resolver = async function(action, context) {
  //  Listens for the SAME generic action to act as a fallback!
  if (!action.includes('analyze_request')) return undefined;
  
  console.log('[MOCK OPENROUTER]  Fallback resolver activated!');
  return {
    success: true,
    resolver: 'mock-openrouter-resolver',
    decision: { action: 'approve', confidence: 0.82, reason: 'Fallback analysis complete' }
  };
};
resolver.resolverName = 'mock-openrouter-resolver';
export default resolver;
