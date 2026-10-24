import pytest
import json
from genlayer import *


def test_fusion_q_net_certified_full_payout(client):
    """Proves that a verified Q-net plasma shot releases 100% grant to the tokamak facility."""
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    # Step 1: Sponsor locks 3 GEN research subsidy
    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "SPARC-EXPERIMENTAL-01", 500, 1000, 6000],
        value=3000000000000000000  # 3 GEN
    )
    policy_id = str(tx_create.return_value)

    # Step 2: Operator submits diagnostic telemetry from IAEA accredited data center
    telemetry_url = "https://iaea.org/api/v1/fusion/diagnostics/sparc_shot_90214.json"
    contract.connect(operator).submit_shot_diagnostics(
        args=[policy_id, telemetry_url]
    )

    # Step 3: Mock AI Fusion Tribunal -> Confinement 620ms (> 500ms), Q=1.25 (1250 bps), TBR=1.08 (108 bps)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "FUSION_Q_NET_CERTIFIED",
                    "confidence": 98,
                    "reactor_facility_id": "SPARC-EXPERIMENTAL-01",
                    "measured_confinement_ms": 620,
                    "measured_q_factor_bps": 1250,
                    "tbr_ratio_bps": 108,
                    "reason": "Stable H-mode confinement verified. Lawson triple product exceeded with Q=1.25 and TBR=1.08."
                })
            },
            "web_mocks": {
                telemetry_url: {"status": 200, "body": '{"FACILITY": "SPARC-EXPERIMENTAL-01", "CONFINEMENT_MS": 620, "Q_FACTOR": 1.25, "TBR": 1.08}'}
            }
        }
    )

    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])

    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["status"] == 2  # STATUS_AWAITING_PAYOUT
    assert p_data["verdict"] == "FUSION_Q_NET_CERTIFIED"
    assert p_data["measured_confinement_ms"] == 620
    assert p_data["measured_q_factor_bps"] == 1250
    assert p_data["tbr_ratio_bps"] == 108

    # Advance time beyond cooling-off window (72s)
    contract.set_time(int(p_data["audit_completed_time"]) + 75)
    contract.connect(operator).finalize_settlement(args=[policy_id])

    p_settled = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_settled["status"] == 3  # STATUS_SETTLED_CERTIFIED_FULL

    # Verify pull-payment claimable balance credited to operator
    operator_bal = contract.get_claimable_balance(args=[str(operator)]).call()
    assert int(operator_bal) == 3000000000000000000


def test_fusion_unaccredited_source_rejected(client):
    """Proves that trigger telemetry from unaccredited sources is strictly rejected."""
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "ITER-MOCK-CHAMBER", 400, 1000, 6000],
        value=1000000000000000000
    )
    policy_id = str(tx_create.return_value)

    # Fake blog link must revert
    with pytest.raises(Exception) as exc_info:
        contract.connect(operator).submit_shot_diagnostics(
            args=[policy_id, "https://amateur-plasma-hobbyist.com/tokamak_shot.json"]
        )
    assert "Telemetry unauthenticated" in str(exc_info.value)


def test_fusion_partial_confinement_milestone_payout(client):
    """Proves that a partial confinement run releases 40% milestone grant and refunds 60%."""
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "WEST-TOKAMAK-04", 600, 1000, 6000],
        value=1000000000000000000  # 1 GEN
    )
    policy_id = str(tx_create.return_value)

    telemetry_url = "https://ipp.mpg.de/diagnostics/west_shot_1102.json"
    contract.connect(operator).submit_shot_diagnostics(
        args=[policy_id, telemetry_url]
    )

    # Confinement is 350ms (>= 300ms, half of 600ms) but Q is 750 (< 1000)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "PARTIAL_CONFINEMENT_MILESTONE",
                    "confidence": 92,
                    "reactor_facility_id": "WEST-TOKAMAK-04",
                    "measured_confinement_ms": 350,
                    "measured_q_factor_bps": 750,
                    "tbr_ratio_bps": 95,
                    "reason": "Partial confinement milestone achieved. Q=0.75, tau_E=350ms."
                })
            },
            "web_mocks": {
                telemetry_url: {"status": 200, "body": '{"FACILITY": "WEST-TOKAMAK-04", "CONFINEMENT_MS": 350, "Q_FACTOR": 0.75, "TBR": 0.95}'}
            }
        }
    )

    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])
    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["verdict"] == "PARTIAL_CONFINEMENT_MILESTONE"

    contract.set_time(int(p_data["audit_completed_time"]) + 80)
    contract.connect(operator).finalize_settlement(args=[policy_id])

    p_settled = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_settled["status"] == 4  # STATUS_SETTLED_PARTIAL

    op_bal = int(contract.get_claimable_balance(args=[str(operator)]).call())
    sp_bal = int(contract.get_claimable_balance(args=[str(sponsor)]).call())
    assert op_bal == 400000000000000000  # 40%
    assert sp_bal == 600000000000000000  # 60%


def test_fusion_plasma_disruption_thermal_quench_refund(client):
    """Proves that a plasma disruption thermal quench refunds 100% of escrow to the sponsor."""
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "JET-CULHAM-02", 500, 1000, 6000],
        value=2000000000000000000  # 2 GEN
    )
    policy_id = str(tx_create.return_value)

    telemetry_url = "https://ccfe.ukaea.uk/diagnostics/jet_pulse_9941.json"
    contract.connect(operator).submit_shot_diagnostics(
        args=[policy_id, telemetry_url]
    )

    # Disruption: confinement collapsed to 80ms (< 250ms)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "PLASMA_DISRUPTION_QUENCH",
                    "confidence": 99,
                    "reactor_facility_id": "JET-CULHAM-02",
                    "measured_confinement_ms": 80,
                    "measured_q_factor_bps": 210,
                    "tbr_ratio_bps": 40,
                    "reason": "MHD tearing mode induced rapid thermal quench at t=80ms."
                })
            },
            "web_mocks": {
                telemetry_url: {"status": 200, "body": '{"FACILITY": "JET-CULHAM-02", "CONFINEMENT_MS": 80, "STATUS": "QUENCH"}'}
            }
        }
    )

    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])
    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["verdict"] == "PLASMA_DISRUPTION_QUENCH"

    contract.set_time(int(p_data["audit_completed_time"]) + 80)
    contract.connect(sponsor).finalize_settlement(args=[policy_id])

    p_settled = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_settled["status"] == 5  # STATUS_SETTLED_REJECTED

    sp_bal = int(contract.get_claimable_balance(args=[str(sponsor)]).call())
    assert sp_bal == 2000000000000000000


def test_mismatched_q_and_tbr_rejected_by_validator(client):
    """
    Steward Requirement 1:
    Verifies that the validator independently compares Q-factor and TBR values,
    and rejects consensus when leader and validator measurements diverge beyond tolerance.
    """
    contract = client.deploy("contracts/contract.py")

    base_payload = {
        "canary": "CANARY_AGENT_FUSION_PURITY_V1",
        "verdict": "FUSION_Q_NET_CERTIFIED",
        "evidence_hash": "a" * 64,
        "reactor_facility_id": "SPARC-01",
        "disruption_detected": False,
        "measured_confinement_ms": 600,
        "measured_q_factor_bps": 1200,
        "tbr_ratio_bps": 108,
    }

    # 1. Matching payloads within tolerance -> Accepted (True)
    matching_validator = dict(base_payload)
    matching_validator["measured_confinement_ms"] = 610  # diff 10 <= 25 ms
    matching_validator["measured_q_factor_bps"] = 1220    # diff 20 <= 50 bps
    matching_validator["tbr_ratio_bps"] = 109            # diff 1 <= 5 bps
    assert contract.validate_measurements_agreement_view(
        args=[json.dumps(matching_validator), json.dumps(base_payload)]
    ).call() is True

    # 2. Mismatched Q-factor (> 50 bps difference) -> Rejected (False)
    mismatched_q = dict(base_payload)
    mismatched_q["measured_q_factor_bps"] = 900  # diff 300 > 50 bps tolerance
    assert contract.validate_measurements_agreement_view(
        args=[json.dumps(mismatched_q), json.dumps(base_payload)]
    ).call() is False

    # 3. Mismatched TBR (> 5 bps difference) -> Rejected (False)
    mismatched_tbr = dict(base_payload)
    mismatched_tbr["tbr_ratio_bps"] = 95  # diff 13 > 5 bps tolerance
    assert contract.validate_measurements_agreement_view(
        args=[json.dumps(mismatched_tbr), json.dumps(base_payload)]
    ).call() is False

    # 4. Mismatched disruption detected flag -> Rejected (False)
    mismatched_disrupt = dict(base_payload)
    mismatched_disrupt["disruption_detected"] = True
    assert contract.validate_measurements_agreement_view(
        args=[json.dumps(mismatched_disrupt), json.dumps(base_payload)]
    ).call() is False


def test_disruption_above_confinement_threshold_quenched(client):
    """
    Steward Requirement 2:
    Proves that when a major disruption or thermal quench is detected, the policy
    STRICTLY settles as PLASMA_DISRUPTION_QUENCH, even when confinement duration
    and Q-factor comfortably exceed the target thresholds.
    """
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "CFS-SPARC-EXP", 500, 1000, 6000],
        value=2000000000000000000  # 2 GEN
    )
    policy_id = str(tx_create.return_value)
    diag_url = "https://cfs.energy/diagnostics/sparc_quench_high_conf.json"
    contract.connect(operator).submit_shot_diagnostics(args=[policy_id, diag_url])

    # Confinement is 720ms (>= 500ms) and Q is 1350 (>= 1000), but disruption_detected is True
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "PLASMA_DISRUPTION_QUENCH",
                    "confidence": 99,
                    "reactor_facility_id": "CFS-SPARC-EXP",
                    "disruption_detected": True,
                    "measured_confinement_ms": 720,
                    "measured_q_factor_bps": 1350,
                    "tbr_ratio_bps": 110,
                    "reason": "Late-discharge violent thermal quench destroyed outer divertor tiles at t=720ms."
                })
            },
            "web_mocks": {
                diag_url: {"status": 200, "body": '{"FACILITY": "CFS-SPARC-EXP", "CONFINEMENT_MS": 720, "Q_FACTOR": 1.35, "DISRUPTION": true}'}
            }
        }
    )

    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])
    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["verdict"] == "PLASMA_DISRUPTION_QUENCH"
    assert "Disruption Quench" in p_data["reason"]

    contract.set_time(int(p_data["audit_completed_time"]) + 80)
    contract.connect(sponsor).finalize_settlement(args=[policy_id])

    p_settled = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_settled["status"] == 5  # STATUS_SETTLED_REJECTED

    # 100% refunded to sponsor, 0 to operator
    assert int(contract.get_claimable_balance(args=[str(sponsor)]).call()) == 2000000000000000000
    assert int(contract.get_claimable_balance(args=[str(operator)]).call()) == 0


def test_below_floor_q_rejected(client):
    """
    Steward Requirement 3:
    Proves that a run with confinement above the partial threshold (e.g. 400ms >= 250ms)
    but below-floor Q-factor (e.g. 350 bps < target_q // 2 = 500 bps) is strictly rejected
    and cannot settle as a partial confinement milestone.
    """
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "ITER-SECTOR-04", 500, 1000, 6000],  # min_conf=500, target_q=1000
        value=1500000000000000000  # 1.5 GEN
    )
    policy_id = str(tx_create.return_value)
    diag_url = "https://iter.org/diagnostics/sub_floor_q.json"
    contract.connect(operator).submit_shot_diagnostics(args=[policy_id, diag_url])

    # Confinement 420ms (>= 250ms floor) but Q is 320 bps (< 500 bps floor)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "PARTIAL_CONFINEMENT_MILESTONE",  # Even if LLM naively claimed partial!
                    "confidence": 88,
                    "reactor_facility_id": "ITER-SECTOR-04",
                    "disruption_detected": False,
                    "measured_confinement_ms": 420,
                    "measured_q_factor_bps": 320,  # Below 500 bps floor!
                    "tbr_ratio_bps": 95,
                    "reason": "Stable discharge but minimal fusion yield."
                })
            },
            "web_mocks": {
                diag_url: {"status": 200, "body": '{"FACILITY": "ITER-SECTOR-04", "CONFINEMENT_MS": 420, "Q": 0.32}'}
            }
        }
    )

    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])
    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    # On-chain deterministic matrix MUST override LLM and enforce QUENCH/REJECTION
    assert p_data["verdict"] == "PLASMA_DISRUPTION_QUENCH"
    assert "Q-factor 320 bps < floor 500 bps" in p_data["reason"]

    contract.set_time(int(p_data["audit_completed_time"]) + 80)
    contract.connect(sponsor).finalize_settlement(args=[policy_id])
    p_settled = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_settled["status"] == 5  # STATUS_SETTLED_REJECTED
    assert int(contract.get_claimable_balance(args=[str(sponsor)]).call()) == 1500000000000000000


def test_certification_without_valid_tbr_rejected(client):
    """
    Steward Requirement 4:
    Proves that a plasma shot cannot receive full FUSION_Q_NET_CERTIFIED certification
    if the Tritium Breeding Ratio is below the mandatory 1.05 threshold (105 bps),
    even if confinement duration and Q-factor exceed target breakeven.
    """
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "IPP-ASDEX-U", 500, 1000, 6000],
        value=1000000000000000000  # 1 GEN
    )
    policy_id = str(tx_create.return_value)
    diag_url = "https://ipp.mpg.de/diagnostics/asdex_low_tbr.json"
    contract.connect(operator).submit_shot_diagnostics(args=[policy_id, diag_url])

    # Confinement 650ms (>= 500), Q 1250 (>= 1000), but TBR is only 98 bps (< 105 required for cert)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "FUSION_Q_NET_CERTIFIED",  # LLM erroneously certified
                    "confidence": 95,
                    "reactor_facility_id": "IPP-ASDEX-U",
                    "disruption_detected": False,
                    "measured_confinement_ms": 650,
                    "measured_q_factor_bps": 1250,
                    "tbr_ratio_bps": 98,  # Below 105 full certification requirement
                    "reason": "Q net achieved but tritium breeding lithium blanket ratio was sub-optimal."
                })
            },
            "web_mocks": {
                diag_url: {"status": 200, "body": '{"FACILITY": "IPP-ASDEX-U", "CONFINEMENT_MS": 650, "Q": 1.25, "TBR": 0.98}'}
            }
        }
    )

    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])
    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    # Full certification MUST be denied! It falls back to partial milestone (40% payout)
    assert p_data["verdict"] == "PARTIAL_CONFINEMENT_MILESTONE"
    assert p_data["verdict"] != "FUSION_Q_NET_CERTIFIED"


def test_certification_without_facility_evidence_rejected(client):
    """
    Steward Requirement 5:
    Proves that telemetry missing valid facility evidence or bearing a mismatched reactor ID
    is rejected as a Provenance Failure with 100% refund to sponsor.
    """
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "CCFE-MAST-UP", 500, 1000, 6000],
        value=1000000000000000000
    )
    policy_id = str(tx_create.return_value)
    diag_url = "https://ccfe.ukaea.uk/diagnostics/mast_fake_facility.json"
    contract.connect(operator).submit_shot_diagnostics(args=[policy_id, diag_url])

    # Telemetry extracted an empty facility ID or wrong facility
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "FUSION_Q_NET_CERTIFIED",
                    "confidence": 90,
                    "reactor_facility_id": "FABRICATED-DEVICE-01",  # Mismatched facility
                    "disruption_detected": False,
                    "measured_confinement_ms": 600,
                    "measured_q_factor_bps": 1200,
                    "tbr_ratio_bps": 108,
                    "reason": "High confinement parameters recorded."
                })
            },
            "web_mocks": {
                diag_url: {"status": 200, "body": '{"FACILITY": "FABRICATED-DEVICE-01"}'}
            }
        }
    )

    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])
    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["verdict"] == "PLASMA_DISRUPTION_QUENCH"
    assert "Provenance Failure" in p_data["reason"]
