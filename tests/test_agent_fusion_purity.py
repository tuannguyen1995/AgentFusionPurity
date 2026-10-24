import pytest
import json

def test_mismatched_q_and_tbr_validator_agreement_rejects(contract):
    """
    CRITICAL TEST 1:
    Verifies that when validators report disparate Q-factor or TBR exceeding tolerances,
    consensus agreement fails and the transaction is rejected.
    """
    leader_payload = {
        "canary": "CANARY_AGENT_FUSION_PURITY_V1",
        "verdict": "FUSION_Q_NET_CERTIFIED",
        "evidence_hash": "a" * 64,
        "reactor_facility_id": "SPARC-EXPERIMENTAL-01",
        "disruption_detected": False,
        "measured_confinement_ms": 600,
        "measured_q_factor_bps": 1200,
        "tbr_ratio_bps": 110,
    }

    # Validator measures divergent Q-factor (> 50 bps difference)
    mine_mismatched_q = dict(leader_payload)
    mine_mismatched_q["measured_q_factor_bps"] = 1100  # 100 bps delta > 50 bps tolerance

    agrees_q = contract.validate_measurements_agreement_view(
        args=[json.dumps(mine_mismatched_q), json.dumps(leader_payload)]
    ).call()
    assert agrees_q is False

    # Validator measures divergent TBR (> 5 bps difference)
    mine_mismatched_tbr = dict(leader_payload)
    mine_mismatched_tbr["tbr_ratio_bps"] = 100  # 10 bps delta > 5 bps tolerance

    agrees_tbr = contract.validate_measurements_agreement_view(
        args=[json.dumps(mine_mismatched_tbr), json.dumps(leader_payload)]
    ).call()
    assert agrees_tbr is False


def test_disruption_above_confinement_threshold_enforces_quench(contract):
    """
    CRITICAL TEST 2:
    Verifies that even if confinement duration is well above target (e.g. 800ms >= 500ms),
    detecting thermal quench / disruption forces absolute verdict PLASMA_DISRUPTION_QUENCH.
    """
    verdict = contract.evaluate_shot_criteria_view(
        args=[
            "SPARC-EXPERIMENTAL-01", # fac_extracted
            "SPARC-EXPERIMENTAL-01", # expected_facility
            800,                     # conf_ms >= min_conf (500)
            500,                     # min_conf
            1500,                    # q_bps >= target_q (1000)
            1000,                    # target_q
            115,                     # tbr_bps >= 105
            True,                    # disruption_detected == True (QUENCH!)
        ]
    ).call()

    assert verdict == "PLASMA_DISRUPTION_QUENCH"


def test_below_floor_q_strictly_rejects_without_partial_payout(contract):
    """
    CRITICAL TEST 3:
    Verifies that a Q-factor below the 50% floor (e.g. 400 bps < 500 bps floor when target is 1000)
    strictly triggers PLASMA_DISRUPTION_QUENCH, preventing any partial payout.
    """
    verdict = contract.evaluate_shot_criteria_view(
        args=[
            "SPARC-EXPERIMENTAL-01",
            "SPARC-EXPERIMENTAL-01",
            600,   # conf_ms (above 500ms)
            500,   # min_conf
            400,   # q_bps < floor (1000 // 2 = 500 bps) -> MUST REJECT!
            1000,  # target_q
            105,   # tbr_bps
            False, # disruption_detected
        ]
    ).call()

    assert verdict == "PLASMA_DISRUPTION_QUENCH"


def test_certification_without_valid_tbr_or_facility_evidence_rejects(contract):
    """
    CRITICAL TEST 4:
    Verifies:
    1. Even if Q and confinement are certified, TBR < 1.05 (105 bps) cannot be certified.
    2. Telemetry reporting a mismatched reactor facility triggers immediate quench/rejection.
    """
    # Case A: TBR < 105 bps (e.g. 100 bps)
    verdict_low_tbr = contract.evaluate_shot_criteria_view(
        args=[
            "SPARC-EXPERIMENTAL-01",
            "SPARC-EXPERIMENTAL-01",
            700,
            500,
            1200,
            1000,
            100,   # TBR = 1.00 < 1.05 required for net energy certification
            False,
        ]
    ).call()
    assert verdict_low_tbr != "FUSION_Q_NET_CERTIFIED"
    assert verdict_low_tbr == "PARTIAL_CONFINEMENT_MILESTONE"

    # Case B: Facility mismatch (e.g. ITER telemetry sent for a SPARC policy)
    verdict_fac_mismatch = contract.evaluate_shot_criteria_view(
        args=[
            "ITER-TOKAMAK-CADARACHE", # fac_extracted
            "SPARC-EXPERIMENTAL-01",  # expected_facility
            700,
            500,
            1200,
            1000,
            110,
            False,
        ]
    ).call()
    assert verdict_fac_mismatch == "PLASMA_DISRUPTION_QUENCH"
