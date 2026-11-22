Workflow "Resilience Test" with user_message

Constraint: max_generations = 1

#  UPDATED: Allow the REAL resolver names
Allow resolvers:
- memory-store
- nvidia-nim
- openrouter
- local-model

# Step 1: Save state to independent memory
Step 1: Ask memory-store save_state user_message={user_message}
Save as initial_state

# Step 2: Use a GENERIC action. 
# The kernel will try resolvers in order. If NIM fails, it passes the SAME action to OpenRouter.
Step 2: Ask analyze_request user_message={user_message} state_id={initial_state.state_id}
Save as analysis_result

# Step 3: Final local validation (Note the SAFE dot notation)
Step 3: Ask local-model validate_output resolver_name={analysis_result.resolver} reason={analysis_result.decision.reason}
Save as final_decision

Return final_decision, initial_state.state_id
