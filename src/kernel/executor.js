import { config } from '../config.js';

export class OLangExecutor {
  constructor(workflow_name) {
    this.workflow_name = workflow_name;
    this.execution_trace = [];
    this.policy = config.policies[workflow_name];
    if (!this.policy) throw new Error(`No policy for workflow: ${workflow_name}`);
  }

  async execute(resolver_name, input) {
    const trace_entry = { timestamp: new Date().toISOString(), resolver: resolver_name, status: 'pending' };

    if (!this.policy.allowedResolvers.includes(resolver_name)) {
      trace_entry.status = 'blocked';
      trace_entry.error = 'POLICY_VIOLATION';
      this.execution_trace.push(trace_entry);
      console.error(`[Kernel]  Policy violation: Resolver '${resolver_name}' not allowed.`);
      return { success: false, error: 'POLICY_VIOLATION' };
    }

    try {
      const resolver_module = await import(`../resolvers/${resolver_name}.js`);
      console.log(`[Kernel] Invoking resolver: ${resolver_name}`);
      const result = await resolver_module.resolve(input);
      
      trace_entry.status = result.success ? 'success' : 'failed';
      this.execution_trace.push(trace_entry);
      return result;
    } catch (error) {
      trace_entry.status = 'error';
      trace_entry.error = error.message;
      this.execution_trace.push(trace_entry);
      return { success: false, error: 'RESOLVER_ERROR', message: error.message };
    }
  }

  getTrace() { return this.execution_trace; }
}
