// Real Redis-backed memory store (with graceful local fallback)
let redisClient = null;
let localStore = new Map();
const REDIS_URL = process.env.REDIS_URL;
const MEMORY_TTL = parseInt(process.env.MEMORY_TTL || '3600');

async function getClient() {
  if (redisClient) return redisClient;
  
  if (!REDIS_URL) {
    console.log('[MEMORY] WARNING: REDIS_URL not set. Falling back to local in-memory store.');
    return 'local';
  }
  
  try {
    const { createClient } = await import('redis');
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('[REAL REDIS] ERROR:', err));
    await redisClient.connect();
    console.log('[REAL REDIS] SUCCESS: Connected to ' + REDIS_URL);
    return redisClient;
  } catch (e) {
    console.log('[MEMORY] WARNING: Redis connection failed. Falling back to local in-memory store.');
    return 'local';
  }
}

const resolver = async function(action, context) {
  if (!action.includes('save_state') && !action.includes('load_state')) return undefined;

  try {
    const client = await getClient();

    if (action.includes('save_state')) {
      const stateId = context.state_id || 'state_' + Date.now();
      const cleanContext = { ...context };
      
      if (client === 'local') {
        localStore.set(stateId, cleanContext);
        console.log('[MEMORY] SUCCESS: Saved state locally: ' + stateId);
      } else {
        await client.setEx('workflow:' + stateId, MEMORY_TTL, JSON.stringify(cleanContext));
        console.log('[REAL REDIS] SUCCESS: Saved state: ' + stateId + ' (TTL: ' + MEMORY_TTL + 's)');
      }
      
      return { state_id: stateId, data: cleanContext };
    }

    if (action.includes('load_state')) {
      const match = action.match(/state_id=([^\s]+)/);
      if (match) {
        if (client === 'local') {
          const data = localStore.get(match[1]);
          if (data) {
            console.log('[MEMORY] SUCCESS: Loaded state locally: ' + match[1]);
            return { state_id: match[1], data: data };
          }
        } else {
          const data = await client.get('workflow:' + match[1]);
          if (data) {
            console.log('[REAL REDIS] SUCCESS: Loaded state: ' + match[1]);
            return { state_id: match[1], data: JSON.parse(data) };
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[MEMORY] ERROR:', error.message);
    throw error;
  }
};

resolver.resolverName = 'memory-store';
export default resolver;