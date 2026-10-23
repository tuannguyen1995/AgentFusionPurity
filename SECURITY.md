# Security Policy — AgentFusionPurity Protocol

## 🛡️ Overview

**AgentFusionPurity** enforces strict on-chain nuclear safety, financial escrow integrity, and AI consensus guardrails for verifying magnetic confinement fusion pulse experiments and Tritium breeding ratios.

This protocol handles high-value research grants in GEN tokens. To safeguard all parties (DeepTech Research Sponsors, Tokamak Facilities, and Appellate Observers), the Intelligent Contract adopts military-grade and nuclear safety defense mechanisms.

---

## 🔒 Threat Modeling & Security Defenses

### 1. Pure Pull-Payment Accounting
- **Vulnerability Mitigated:** Reentrancy attacks, Denial-of-Service (DoS) via malicious contract fallback reverting, and gas griefing.
- **Implementation:** Escrow disbursements are never pushed synchronously to external accounts during `finalize_settlement` or `adjudicate_appeal`. Instead, beneficiaries are credited in internal accounting (`self.claimable_balances[recipient]`). Users pull their accrued funds safely via `claim_payout()`. If an outbound transfer reverts, beneficiary balance is preserved intact.

### 2. Protected Non-Settling State (`STATUS_UNRESOLVED`)
- **Vulnerability Mitigated:** Wrongful forfeiture of research grants due to transient network dropouts, API downtime, or malformed JSON payloads.
- **Implementation:** If telemetry endpoint is unreachable or AI parsing fails, status becomes `STATUS_UNRESOLVED` (Status 8). The contract **never** automatically settles or refunds on fetch errors. Stakeholders can retry submission or recover via timeout.

### 3. Prompt Injection Defense via Security Canary
- **Vulnerability Mitigated:** Malicious injection inside raw spectrometry or bolometer diagnostic payloads attempting to hijack AI consensus prompts.
- **Implementation:** Leader and validator consensus logic requires echoing a unique cryptographic security canary token:
  ```python
  CANARY_TOKEN = "CANARY_AGENT_FUSION_PURITY_V1"
  ```
  If output fails canary verification or violates structured JSON schemas, consensus immediately defaults to `UNRESOLVED_CANARY_FAILED`.

### 4. Accredited Fusion Source Whitelisting
- **Vulnerability Mitigated:** Operators submitting self-hosted fake pulse data or fabricated Q-net net gain claims.
- **Implementation:** The method `submit_shot_diagnostics` strictly validates domain origins against `ACCREDITED_FUSION_DIAGNOSTICS`:
  - International Atomic Energy Agency (`iaea.org`)
  - ITER International Organization (`iter.org`)
  - US Department of Energy (`energy.gov`)
  - Culham Centre for Fusion Energy / CCFE UK (`ccfe.ukaea.uk`)
  - Max Planck Institute for Plasma Physics (`ipp.mpg.de`)
  - Commonwealth Fusion Systems (`cfs.energy`)
  - Fusion Energy Sciences (`fusionenergysciences.org`)
  - Oak Ridge National Laboratory (`ornl.gov`)

### 5. Multi-Validator Equivalence Consensus
- **Vulnerability Mitigated:** Single validator hallucination or adversarial validator manipulation.
- **Implementation:** Utilizes `gl.vm.run_nondet(leader_fn, validator_fn)` where validators independently fetch telemetry, compute SHA-256 evidence digests, and compare:
  - Exact match of verdict strings.
  - Confinement duration tolerance within $\le 25\text{ ms}$.
  - Reactor chamber provenance verification.
  - Exact match of evidence hashes.

### 6. Double-Payout Elimination
- When a policy settles (`finalize_settlement` or `adjudicate_appeal`), `p.escrow_amount` is set to `bigint(0)` before crediting pull-payment ledgers, preventing double execution.

### 7. 24-Block Cooling-Off Challenge Window & 7-Day Bounded Stale Recovery
- A 24-block (~72 second) cooling-off challenge window is enforced after adjudication before settlement finalization.
- Any participant can appeal by staking a **10% dispute bond**.
- If an appeal stalls or telemetry fails, `resolve_stale_appeal` guarantees **100% refund of the dispute bond** back to the appellant after 7 days, avoiding locked capital deadlocks.

---

## 🚨 Vulnerability Reporting

If you discover a security vulnerability in the AgentFusionPurity Intelligent Contract or frontend application:
1. Do **NOT** file a public GitHub issue.
2. Send a confidential report to `security@agentfusionpurity.org` or contact the core maintainers.
3. Include reproducible proof-of-concept steps and transaction traces.
