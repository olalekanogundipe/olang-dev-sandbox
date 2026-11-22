# O-Lang Resilience Test & Capability Harness

A stress-test harness for the [`@o-lang/olang`](https://www.npmjs.com/package/@o-lang/olang) kernel. 
O-Lang is not just a workflow engine; it is a **deterministic semantic governance protocol** that enforces policy, ensures auditability, and prevents unsafe data propagation at the execution layer.

This harness demonstrates governed resolver failover, independent state propagation, and cryptographically verifiable execution traces against real or mocked model gateways.

---

## 🌟 Core Capabilities of O-Lang

| Capability | How O-Lang Enforces It |
|---|---|
 **🌐 Model Agnostic** | The kernel does not care about the provider. It dynamically detects LLM actions (`groq`, `openai`, `anthropic`, `llama`, `ollama`, `deepseek`, etc.) and applies the exact same safety, auditing, and grounding rules to all of them. |
| **🌍 Language Agnostic** | The governance protocol is portable across runtimes. Workflows are written in declarative `.ol` syntax; resolvers can be implemented in **any language** (Python, Go, Rust, Java) via the HTTP resolver protocol; PII/intent detection spans 12+ languages across African and global contexts. A native Python kernel is in active development. |
| **🛑 Resolver Allowlist** | Zero-trust execution. Every workflow must declare `Allow resolvers:`. If a step attempts to invoke an unlisted resolver, the kernel hard-blocks it, logs a `security_violation`, and halts execution. |
| **🤖 Agent Mapping & Invocation Control** | Logical agents can be mapped to specific resources via `Use "bot" as "resource"`. The kernel tracks these mappings in `agentMap` and enforces that only declared agents can be invoked. This is separate from resolver allowlisting — resolvers are the execution layer, agents are the logical orchestration layer. |
| **🤝 Human-in-the-Loop (HITL)** | Native `Prompt` steps pause execution, serialize the entire workflow state to Redis with a TTL, and throw a `WORKFLOW_PAUSED` error. Resumption requires explicit validation of `requiredRole`, `requiredStaffId`, and `governanceReason`. |
| **🔗 Agent-to-Agent Orchestration** | Supports structured `Debrief` emissions to other agents, automatic resolver chaining (if Resolver A skips/fails, the kernel automatically passes the action to Resolver B), and logical agent composition. |
| **🛡️ Multilingual PII & Intent Detection** | Detects and redacts PII (Nigerian BVN/NIN, Ghana Card, Kenyan ID, South African ID, IBAN, email, phone numbers) and financial intent across **12+ languages**: Yoruba, Hausa, Igbo, Swahili, Zulu, Xhosa, Twi, Amharic, Somali, **English, French, Arabic, and Chinese**. Domain entities (e.g., employee names) are replaced with tokens (e.g., `EMPLOYEE_001`) before reaching the LLM, and deanonymized on output. |
| **⚡ Safe Parallel Execution** | Fixes race conditions by giving each parallel branch its own `Object.create(this)` context shadow. Branches share the allowlist and audit log, but never corrupt each other's state. |
| **🔐 Cryptographic Audit & Dual-Hash Forensics** | Every step generates a hash chain and Merkle root. The final output includes a `dataHash` (for immutable, `__locked` ground-truth variables) and a `narrativeHash` (for the LLM's text output) to detect hallucination or drift. |
---

## 🌍 Language Agnosticism — Four Layers

O-Lang is language-agnostic at four distinct levels, making it a truly portable governance protocol:

### Layer 1: Workflow Syntax is Declarative
Workflows are written in `.ol` files using a declarative, human-readable syntax that is **not tied to any programming language**:

```text
Workflow "Transfer Approval" with user_message

Allow resolvers:
- nim-resolver
- openrouter-resolver
- memory-store

Step 1: Ask memory-store save_state user_message={user_message}
Save as initial_state

Step 2: Ask analyze_request user_message={user_message} state_id={initial_state.state_id}
Save as analysis_result

Return analysis_result
```

This syntax is parsed by the kernel into an execution plan. The same `.ol` file runs identically whether the kernel is implemented in JavaScript or Python.

### Layer 2: Resolvers Can Be Written in ANY Language
Resolvers communicate with the kernel via a **standard HTTP protocol**. Any language that can serve an HTTP endpoint can be an O-Lang resolver:

```
POST /resolve
Content-Type: application/json

{
  "action": "analyze_request user_message=...",
  "context": { ... },
  "resolver": "my-python-resolver",
  "workflow": "Transfer Approval"
}
```

**Example: A Python resolver**
```python
# resolver.py — runs as an HTTP service
from fastapi import FastAPI
app = FastAPI()

@app.post("/resolve")
async def resolve(payload: dict):
    action = payload["action"]
    if "analyze_request" in action:
        return {"result": {"decision": "approve", "confidence": 0.85}}
    return None  # Skip — action not recognized
```

The kernel treats this Python resolver identically to a JavaScript one. The governance rules (allowlisting, audit logging, PII redaction) apply uniformly.

### Layer 3: PII & Intent Detection Across 12+ Languages
The kernel's safety layer is multilingual, detecting PII and financial intent in:

| Language | PII Patterns | Financial Intent |
|---|---|---|
| Yoruba (yo) | Phone, BVN | ✅ Conjugation-aware |
| Hausa (ha) | Phone, NIN | ✅ Substring-match |
| Igbo (ig) | Phone | ✅ Root-based |
| Swahili (sw) | Phone | ✅ Conjugated forms |
| Zulu (zu) | Phone, ID | ✅ Subject concords |
| Xhosa (xh) | Phone, ID | ✅ Nguni root structure |
| Twi/Akan (tw) | Phone, Ghana Card | ✅ Root-based |
| Amharic (am) | Phone | ✅ Unicode root match |
| Somali (so) | Phone | ✅ Root-based |
| English (en) | Email, IBAN, Account | ✅ Context-aware |
| French (fr) | Email | ✅ Conjugated |
| Arabic (ar) | — | ✅ Unicode root match |
| Chinese (zh) | — | ✅ Character-based |

### Layer 4: Runtime Portability
The O-Lang governance protocol is being implemented in **multiple runtimes**:

| Runtime | Status | Purpose |
|---|---|---|
| **JavaScript (Node.js)** | ✅ Production (v1.5.0) | Primary kernel, published to npm |
| **Python** | 🚧 In development | Native Python kernel for ML/DS teams |
| **HTTP Resolver Protocol** | ✅ Stable | Language-agnostic resolver interface |

The protocol is defined by:
- The `.ol` workflow syntax (portable)
- The resolver HTTP contract (portable)
- The audit log schema (portable)
- The governance profile hash (portable)

This means an organization can use the JavaScript kernel in production today, migrate to the Python kernel later, and **all existing workflows and resolvers continue to work unchanged**.

---

## 🚀 Quick Start: The Resilience Test

This test proves the kernel's ability to survive gateway failures gracefully without silent data corruption.

### 1. Install
```bash
npm install
```
*Requires Node 18+ (uses global `fetch` and `AbortSignal.timeout`).*

### 2. Run with Mock Resolvers (No API Keys Needed)
```bash
node src/run-test.js
```
This runs the full workflow against mock resolvers that simulate:
1. NIM gateway rate-limit failure (`429 Too Many Requests`)
2. Automatic, governed failover to OpenRouter
3. Final local model validation
4. Independent memory persistence

### 3. Run with Real Resolvers (Requires API Keys)
```bash
cp .env.example .env
# Edit .env with your NIM_API_KEY, OPENROUTER_API_KEY, etc.
node src/run-test.js --real
```

---

## 📂 Project Layout

```text
src/
  run-test.js                  # Harness entrypoint (supports --real flag)
  workflows/
    test-workflow.ol           # The governed workflow under test
  resolvers/
    memory-store.js            # Independent state (Map or Redis)
    nvidia-nim.js              # Primary — fails on first call in mock mode
    openrouter.js              # Fallback — handles the SAME generic action
    local-model.js             # Final validation
    real/                      # (Optional) Real API implementations for stress testing
```

---

## 📜 The Workflow

```text
Workflow "Resilience Test" with user_message

Constraint: max_generations = 1

Allow resolvers:
- memory-store
- mock-nim-resolver
- mock-openrouter-resolver
- mock-local-resolver

Step 1: Ask memory-store save_state user_message={user_message}
Save as initial_state

Step 2: Ask analyze_request user_message={user_message} state_id={initial_state.state_id}
Save as analysis_result

Step 3: Ask mock-local-resolver validate_output resolver_name={analysis_result.resolver} reason={analysis_result.decision.reason}
Save as final_decision

Return final_decision, initial_state.state_id
```

**Two critical rules this workflow encodes:**
1. **Generic Actions Enable Failover:** Step 2 uses `analyze_request`. Both NIM and OpenRouter listen for it. That is what makes chain failover possible — the kernel passes the *same* action to the next resolver in the chain.
2. **Dot Notation Prevents Hallucination:** `{analysis_result}` would be rejected by the kernel with `Cannot interpolate object`. Only scalar leaves (e.g., `{analysis_result.resolver}`) may enter an action string.

---

## 📊 Expected Output (Mock Mode)

```text
[MOCK MEMORY]     ✅ Saved state: state_1795209130521
[MOCK NIM]        Attempting request #1
[MOCK NIM]        ❌ 429 Too Many Requests
[O-Lang WARNING]  Resolver "mock-nim-resolver" failed ... GATEWAY_RATE_LIMIT
[MOCK OPENROUTER] ✅ Fallback resolver activated!
[MOCK LOCAL]      ✅ Final validation step

AUDIT TRAIL
Execution Hash: 5001c68e0102acc33838601453c2254676c7801e4ae6bb908453c72ad87c5e61
Merkle Root:    d70bbb9fe9a4f6f7a8e578c886a1fb20892caa55776ba40b2dd0169a76e1598b
Data Hash:      a38c3bb13a183c8eb72052e32763b77b8c4a0cceb7541d6185fef97c752e7f32
Narrative Hash: 12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126
Deterministic:  true
```

---

## 🧪 Stress-Test Matrix

| Scenario | How to trigger | Expected kernel behaviour |
|---|---|---|
| **Rate limit** | Mock mode, or set invalid `NIM_API_KEY` | Warning logged, OpenRouter serves the step |
| **Total gateway outage** | Set `NIM_ENDPOINT` to an unroutable host | Timeout → fallback |
| **Both gateways down** | Break both keys/endpoints | `No resolver handled action` + full attempt table, workflow halts |
| **Slow primary** | Set `NIM_TIMEOUT=1` | Abort → fallback |
| **State store down** | Stop Redis / unset `REDIS_URL` | Resolver throws; kernel halts rather than propagating undefined state |
| **Disallowed resolver** | Remove `mock-openrouter-resolver` from `Allow resolvers:` | Blocked by policy, logged as `security_violation` |
| **PII in input** | Send `"... BVN 12345678901 ..."` | `block` mode halts; `redact` mode replaces with `[NG_BVN_REDACTED]` |
| **Object interpolation** | Change Step 3 to `result={analysis_result}` | Hard halt: `Cannot interpolate object` |
| **Trace drift** | Run twice with a real model | `executionHash` stable in structure, `narrativeHash` differs |
| **Cross-language PII** | Send `"... fi owo ranṣẹ ..."` (Yoruba) | Blocked as unauthorized financial intent |

---

## 🔐 Enable Cryptographic Signing (Optional)

Unsigned entries are still hash-chained and Merkle-rooted. To cryptographically sign them:

```bash
mkdir -p kernel-keys
openssl genpkey -algorithm ED25519 -out kernel-keys/kernel-private.pem
openssl pkey -in kernel-keys/kernel-private.pem -pubout -out kernel-keys/kernel-public.pem
```

Add to `.env`:
```env
KERNEL_PRIVATE_KEY_PATH=./kernel-keys/kernel-private.pem
OLANG_AUDIT_LOG=true
```
The kernel derives the public key from the private key if the public file is absent. `result.__audit.signature` and `.publicKey` will now be populated.

> 🛑 **Never commit `kernel-keys/` or `.env` to version control.**

---

## 🛠️ Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `require is not defined in ES module scope` | `"type": "module"` in `package.json` | Use `import`, or rename file to `.cjs` |
| `Private key not found` | No signing key configured | Harmless for mocks; see "Enable Signing" |
| `Cannot interpolate object` | Whole object in an action string | Use `{result.field}` dot notation |
| `No resolver handled action` | Every resolver returned `undefined` or threw | Read the attempt table in the error — it names each resolver and its failure |
| `Converting circular structure to JSON` | Resolver returned the live `context` object | Return a copy: `{ ...context }` |
| Wrong resolver in `final_decision` | Resolvers accept any action | Guard each with `if (!action.includes('...')) return undefined;` |
| Workflow blocked on legitimate transfer | `OLANG_PII_MODE=block` + financial-intent pattern | Set `OLANG_PII_MODE=redact`, or scope the intent via `__verified_intent` |

---

## 📜 License

MIT