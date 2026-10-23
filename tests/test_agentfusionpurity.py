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
