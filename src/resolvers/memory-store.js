const memoryStore = new Map();
const resolver = async function(action, context) {
  if (action.includes('save_state')) {
    const id = 'state_' + Date.now();
    const cleanContext = { ...context };
    memoryStore.set(id, cleanContext);
    console.log('[MOCK MEMORY]  Saved state:', id);
    return { state_id: id, data: cleanContext };
  }
  return undefined;
};
resolver.resolverName = 'memory-store';
export default resolver;
