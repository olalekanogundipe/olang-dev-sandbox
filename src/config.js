export const config = {
  scenarios: { failover: true, closedTunnel: true, policyEnforcement: true },
  resolvers: {
    nvidiaNim: { model: 'nvidia/nemotron-3.5-super-vl-120b-a12b' },
    openRouter: { model: 'z-ai/glm-5.3-flash' },
    localModel: { model: 'nemotron-3.5-super-vl-120b-a12b-q8' }
  },
  policies: {
    authDecision: {
      allowedResolvers: ['nvidia-nim', 'openrouter', 'local-model', 'memory-store'],
      maxRetries: 2
    }
  }
};
