# ⚛️ Technical Architecture — AgentFusionPurity

**AgentFusionPurity** is an autonomous magnetic confinement fusion plasma and tritium breeding oracle built natively on **GenLayer StudioNet (Chain ID: 61999)**.

---

## 🔬 System Overview & Problem Statement

Nuclear fusion energy research facilities (such as Tokamaks, Stellarators, and Magnetized Target Fusion experiments including ITER, SPARC/CFS, WEST, and JET) invest millions of dollars into experimental fuel subsidies and high-temperature plasma confinement trials.

When DeepTech sponsors, research foundations, or fuel vendors escrow grants for net-energy ($Q > 1.0$) pulse shots, traditional EVM smart contracts cannot inspect raw physics diagnostics:
1. **Soft X-Ray Spectroscopy:** Monitoring impurity radiation and core electron temperatures.
2. **Laser Interferometry:** Line-integrated electron density ($n_e$) measurements.
3. **Neutron Spectrometry & Lithium Blanket Sensors:** Verifying Tritium Breeding Ratio ($\text{TBR} \ge 1.05$) for closed-cycle fuel sustainability.
4. **MHD Disruption Warning Systems:** Catching thermal quenches and runaway electron avalanches.

**GenLayer Intelligent Contracts** bridge this gap by enabling non-deterministic web rendering (`gl.nondet.web.render`) and multi-validator AI consensus (`gl.vm.run_nondet`) to parse accredited diagnostic feeds directly on-chain.

---

## 🏛️ End-to-End Protocol Flow

```mermaid
sequenceDiagram
    autonumber
    actor Sponsor as DeepTech Sponsor / DAO
    actor Operator as Tokamak Facility Operator
    participant Contract as Intelligent Contract (GenLayer)
    participant Jury as GenLayer AI Plasma Tribunal
    participant Diagnostics as Accredited Telemetry (IAEA/ITER)

    Sponsor->>Contract: create_fusion_shot_escrow() [Locks GEN Grant]
    Note over Contract: Status: STATUS_POLICY_OPEN (0)

    Operator->>Contract: submit_shot_diagnostics(policy_id, feed_url)
    Note over Contract: Validates domain in ACCREDITED_FUSION_DIAGNOSTICS<br/>Status: STATUS_TELEMETRY_SUBMITTED (1)

    Operator->>Contract: adjudicate_plasma_shot(policy_id)
    Contract->>Jury: gl.vm.run_nondet(leader_fn, validator_fn)
    Jury->>Diagnostics: gl.nondet.web.render(feed_url)
    Jury-->>Contract: Verdict: Q-Net / Partial / Quench + Evidence Hash
    Note over Contract: Status: STATUS_AWAITING_PAYOUT (2)<br/>Starts 24-Block (~72s) Cooling-Off Window

    alt Sponsor or Operator Appeals within Cooling-Off
        Sponsor->>Contract: appeal_verdict(reason, supp_url) [Stakes 10% Bond]
        Note over Contract: Status: STATUS_DISPUTED (6)
        Contract->>Jury: adjudicate_appeal()
        Jury-->>Contract: Overturns or Upholds Verdict
    else Uncontested Settlement
        Operator->>Contract: finalize_settlement(policy_id)
        Note over Contract: Pure Pull-Payment Ledger Updated
    end

    Operator->>Contract: claim_payout()
    Contract-->>Operator: Emits verified outbound GEN transfer
```

---

## 📊 Parametric Lawson Decision Matrix

```
                                 [ Shot Telemetry Submitted ]
                                               │
                                               ▼
                              Did Major Thermal Quench Occur?
                              OR tau_E < min_confinement / 2?
                                        │               │
                                       YES              NO
                                        │               │
                                        ▼               ▼
                        [ PLASMA_DISRUPTION_QUENCH ]   Is tau_E >= min_confinement
                        - 100% escrow refunded         AND Q >= target_q
                          to sponsor fund              AND TBR >= 1.05?
                                                        │              │
                                                       YES             NO
                                                        │              │
                                                        ▼              ▼
                                     [ FUSION_Q_NET_CERTIFIED ]   [ PARTIAL_CONFINEMENT ]
                                     - 100% research grant        - 40% fuel grant released
                                       released to tokamak          to tokamak facility
                                       facility operator          - 60% refunded to sponsor
```

---

## 🛡️ Security Architecture & Non-Settling State Machine

```mermaid
stateDiagram-v2
    [*] --> STATUS_POLICY_OPEN : create_fusion_shot_escrow
    STATUS_POLICY_OPEN --> STATUS_TELEMETRY_SUBMITTED : submit_shot_diagnostics
    STATUS_POLICY_OPEN --> STATUS_EXPIRED_RECLAIMED : cancel_or_reclaim (if expired)

    STATUS_TELEMETRY_SUBMITTED --> STATUS_AWAITING_PAYOUT : adjudicate_plasma_shot
    STATUS_TELEMETRY_SUBMITTED --> STATUS_UNRESOLVED : Fetch / Parse / Canary Failure

    STATUS_UNRESOLVED --> STATUS_TELEMETRY_SUBMITTED : retry submit_shot_diagnostics
    STATUS_UNRESOLVED --> STATUS_EXPIRED_RECLAIMED : cancel_or_reclaim (after expiry)

    STATUS_AWAITING_PAYOUT --> STATUS_DISPUTED : appeal_verdict (24-block window + 10% bond)
    STATUS_AWAITING_PAYOUT --> STATUS_SETTLED_CERTIFIED_FULL : finalize_settlement (Q-Net)
    STATUS_AWAITING_PAYOUT --> STATUS_SETTLED_PARTIAL : finalize_settlement (Partial)
    STATUS_AWAITING_PAYOUT --> STATUS_SETTLED_REJECTED : finalize_settlement (Quench)

    STATUS_DISPUTED --> STATUS_SETTLED_CERTIFIED_FULL : adjudicate_appeal (Upheld Q-Net)
    STATUS_DISPUTED --> STATUS_SETTLED_PARTIAL : adjudicate_appeal (Upheld Partial)
    STATUS_DISPUTED --> STATUS_SETTLED_REJECTED : adjudicate_appeal (Upheld Quench)
    STATUS_DISPUTED --> STATUS_AWAITING_PAYOUT : resolve_stale_appeal (7-day timeout recovery)
```

---

## 💻 Tech Stack Summary

- **Contract Layer:** Python Intelligent Contract (`py-genlayer` pragma, `TreeMap`, `gl.nondet.web.render`, `gl.vm.run_nondet`).
- **Chain:** GenLayer StudioNet (`61999` / `0xF22F`).
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Lucide Icons, HTML5 Canvas.
- **Testing:** Pytest, GenLayer Test Harness (`gltest`).
