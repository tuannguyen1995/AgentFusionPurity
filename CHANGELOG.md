# Changelog — AgentFusionPurity Protocol

All notable changes to the **AgentFusionPurity** autonomous nuclear confinement protocol and decentralized application are documented in this file.

---

## [1.0.0] - 2026-10-23 (Milestone Release)

### Core Intelligent Contract (`contracts/contract.py`)
- **Py-GenLayer Consensus Implementation:** Native GenLayer Intelligent Contract utilizing `gl.nondet.web.render` and `gl.vm.run_nondet` multi-validator consensus.
- **Lawson Criterion & Plasma Confinement Logic:**
  - Automated distinction between net-energy breakeven ($Q \ge 1.0$, $\text{TBR} \ge 1.05 \rightarrow$ `FUSION_Q_NET_CERTIFIED`), partial steady-state milestones (`PARTIAL_CONFINEMENT_MILESTONE` $\rightarrow$ 40% fuel release), and plasma thermal quench disruption (`PLASMA_DISRUPTION_QUENCH` $\rightarrow$ 100% sponsor refund).
- **Accredited Diagnostic Enforcement:** Whitelisted international atomic and fusion telemetry authorities (`ACCREDITED_FUSION_DIAGNOSTICS`: IAEA, ITER, US DOE, CCFE, Max Planck IPP, CFS, ORNL).
- **Security Canary Defense:** Injection-proof canary verification with `CANARY_AGENT_FUSION_PURITY_V1`.
- **Pure Pull-Payment Accounting:** Secure `_credit_payout` and `claim_payout` ledger eliminating reentrancy and token-locking anomalies.
- **Appellate Dispute & Stale Recovery:** 24-block (~72s) cooling-off challenge requiring 10% staked bond with 7-day bounded recovery refunding 100% of bond on stale deadlock.
- **Consensus Datetime:** Time strictly anchored to `gl.message_raw["datetime"]`.

### Testing Suite (`tests/`)
- `tests/conftest.py`: Authentic execution harness supporting native `gltest` and deterministic multi-validator mocks.
- `tests/test_agentfusionpurity.py`: Full lifecycle tests covering Q-net certified full payout, partial confinement milestone, disruption thermal quench, and unaccredited domain rejection.
- `tests/test_agentfusionpurity_runtime.py`: Runtime verification of `STATUS_UNRESOLVED` state preservation, appeal overturns, stale dispute recoveries, and clean expiration reclaims.

### Operations Center Frontend (`frontend/`)
- **Tokamak Magnetic Confinement Brand System:** Plasma Obsidian & High-Flux Violet theme (`#04030A`, `#0D081B`, `#06B6D4`, `#D946EF`, `#10B981`, `#F59E0B`, `#EF4444`).
- **Interactive Tokamak Plasma Radar (`TokamakReactorRadar.tsx`):** Real-time HTML5 Canvas cross-section simulating toroidal magnetic field coils, poloidal flux lines, plasma particle clouds, and live Lawson triple product metrics ($T_i$, $n_e$, $\tau_E$, TBR).
- **Console Components:**
  - `Navbar.tsx`: Wallet connection via MetaMask, StudioNet chain switch helper (Hex `0xF22F`), and GEN balance display.
  - `StatsOverview.tsx`: Aggregated metrics for Total Fusion Escrow Locked, Q-Net Pulses Certified, and Reactor Chambers Monitored.
  - `CreatePolicyModal.tsx`: Form with 1-click facility presets (SPARC, ITER, WEST, JET) to lock GEN grants.
  - `PolicyCard.tsx`: Interactive cards displaying confinement meters, Q-factor gauges, TBR ratios, and cooling-off countdown timer.
  - `SubmitTelemetryModal.tsx`: Operator portal with 1-click IAEA, ITER, and CCFE diagnostic endpoints.
  - `SpectrometryInspectorModal.tsx`: Modal displaying AI Fusion Jury analysis and SHA-256 evidence hash digest.
  - `AppealModal.tsx`: 24-block (~72s) dispute portal requiring 10% staked bond with accredited supplemental audit.
  - `PullPayoutButton.tsx`: Recovery interface calling `claim_payout()` for buffered balances.

### Deployment & Tooling (`scripts/`)
- `scripts/deploy_studionet.py`: Automated contract deployment to GenLayer StudioNet (Chain 61999). Deployed at `0x5D3D85a66429bdFD9761377B4b66158a54f1CC91`.
- `scripts/verify_lifecycle.py`: Standalone protocol lifecycle simulation script.
- `scripts/generate_logo.py`: High-resolution Tokamak branding generator (`logo.png`).
