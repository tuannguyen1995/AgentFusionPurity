import pytest
import json
from genlayer import *


def test_fusion_appeal_flow_overturn_to_certified(client):
    """Proves that a legitimate dispute overturns quench to certified with bond returned."""
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "SPARC-EXP-02", 500, 1000, 6000],
        value=1000000000000000000  # 1 GEN
    )
    policy_id = str(tx_create.return_value)

    # Telemetry
    diag_url = "https://cfs.energy/telemetry/sparc_02.json"
    contract.connect(operator).submit_shot_diagnostics(args=[policy_id, diag_url])

    # Initial flawed verdict: quench
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "PLASMA_DISRUPTION_QUENCH",
                    "confidence": 70,
                    "reactor_facility_id": "SPARC-EXP-02",
                    "measured_confinement_ms": 200,
                    "measured_q_factor_bps": 400,
                    "tbr_ratio_bps": 50,
                    "reason": "Preliminary sensor reading flagged potential drop."
                })
            },
            "web_mocks": {
                diag_url: {"status": 200, "body": '{"FACILITY": "SPARC-EXP-02", "RAW": "INITIAL"}'}
            }
        }
    )
    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])

    # Operator files appeal with 10% bond (0.1 GEN) and supplemental audit url
    supp_url = "https://fusionenergysciences.org/audits/sparc_02_verified.json"
    contract.connect(operator).appeal_verdict(
        args=[policy_id, "Bolometer calibration confirms continuous H-mode with no quench", supp_url],
        value=100000000000000000  # 0.1 GEN
    )

    p_disp = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_disp["status"] == 6  # STATUS_DISPUTED

    # Appellate mock: APPEAL_UPHELD_CERTIFIED
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "APPEAL_UPHELD_CERTIFIED",
                    "reactor_facility_id": "SPARC-EXP-02",
                    "disruption_detected": False,
                    "measured_confinement_ms": 580,
                    "measured_q_factor_bps": 1150,
                    "tbr_ratio_bps": 110,
                    "reason": "Recalibrated Thomson scattering validates Q=1.15 net energy gain."
                })
            },
            "web_mocks": {
                supp_url: {"status": 200, "body": '{"FACILITY": "SPARC-EXP-02", "VERIFIED_Q": 1.15}'}
            }
        }
    )

    contract.connect(operator).adjudicate_appeal(args=[policy_id])
    p_final = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_final["status"] == 3  # STATUS_SETTLED_CERTIFIED_FULL
    assert p_final["verdict"] == "FUSION_Q_NET_CERTIFIED"

    # Operator receives 1 GEN escrow + 0.1 GEN returned bond = 1.1 GEN
    op_bal = int(contract.get_claimable_balance(args=[str(operator)]).call())
    assert op_bal == 1100000000000000000


def test_fusion_stale_appeal_recovery(client):
    """Proves that a timed-out or unresolvable appeal refunds 100% bond to appellant and restores prior state."""
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "ORNL-MPEX-01", 500, 1000, 6000],
        value=1000000000000000000
    )
    policy_id = str(tx_create.return_value)

    diag_url = "https://ornl.gov/diagnostics/mpex_shot_401.json"
    contract.connect(operator).submit_shot_diagnostics(args=[policy_id, diag_url])

    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "FUSION_Q_NET_CERTIFIED",
                    "confidence": 95,
                    "reactor_facility_id": "ORNL-MPEX-01",
                    "measured_confinement_ms": 600,
                    "measured_q_factor_bps": 1200,
                    "tbr_ratio_bps": 110,
                    "reason": "Q-net verified"
                })
            },
            "web_mocks": {
                diag_url: {"status": 200, "body": '{"Q": 1.2}'}
            }
        }
    )
    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])

    # Sponsor appeals
    supp_url = "https://energy.gov/fusion/audit_mpex.json"
    contract.connect(sponsor).appeal_verdict(
        args=[policy_id, "Potential sensor drift requires re-inspection", supp_url],
        value=100000000000000000
    )

    # Time advances beyond 7 days (7 * 86400 = 604800s)
    p_before = json.loads(contract.get_policy(args=[policy_id]).call())
    appeal_time = int(p_before["dispute_filed_time"])
    contract.set_time(appeal_time + 604900)

    contract.connect(sponsor).resolve_stale_appeal(args=[policy_id])

    p_after = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_after["status"] == 2  # restored to STATUS_AWAITING_PAYOUT
    assert p_after["verdict"] == "FUSION_Q_NET_CERTIFIED"

    # Sponsor gets 100% of dispute bond refunded
    sp_bal = int(contract.get_claimable_balance(args=[str(sponsor)]).call())
    assert sp_bal == 100000000000000000


def test_fusion_unresolved_protected_state(client):
    """Proves that unreachable telemetry leads to STATUS_UNRESOLVED rather than wrongful settlement."""
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "ITER-SECTOR-09", 500, 1000, 6000],
        value=1000000000000000000
    )
    policy_id = str(tx_create.return_value)

    diag_url = "https://iter.org/diagnostics/offline_feed.json"
    contract.connect(operator).submit_shot_diagnostics(args=[policy_id, diag_url])

    # Empty web mock simulates unreachable feed
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {},
            "web_mocks": {}
        }
    )

    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])
    p_data = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_data["status"] == 8  # STATUS_UNRESOLVED
    assert p_data["verdict"] == "UNRESOLVED_FETCH_FAILED"


def test_fusion_cancel_or_reclaim_expired(client):
    """Proves that a sponsor can reclaim locked escrow if coverage expires with no telemetry."""
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    # Duration = 10 blocks (30 seconds)
    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "CFS-SPARC-EXP", 500, 1000, 10],
        value=1500000000000000000
    )
    policy_id = str(tx_create.return_value)
    p_data = json.loads(contract.get_policy(args=[policy_id]).call())

    # Advance time beyond expiry
    contract.set_time(int(p_data["expires_at_time"]) + 5)

    contract.connect(sponsor).cancel_or_reclaim(args=[policy_id])
    p_reclaimed = json.loads(contract.get_policy(args=[policy_id]).call())
    assert p_reclaimed["status"] == 7  # STATUS_EXPIRED_RECLAIMED

    sp_bal = int(contract.get_claimable_balance(args=[str(sponsor)]).call())
    assert sp_bal == 1500000000000000000


def test_appeal_enforces_disruption_and_q_rules(client):
    """
    Steward Requirement:
    Proves that the appellate branch strictly enforces the same deterministic criteria:
    If an operator appeals a quench claiming certification, but supplemental telemetry
    verifies disruption_detected or below-floor Q, the contract CANNOT settle as certified;
    it strictly settles as PLASMA_DISRUPTION_QUENCH, forfeiting the operator's bond to the sponsor.
    """
    contract = client.deploy("contracts/contract.py")
    sponsor = client.accounts[0]
    operator = client.accounts[1]

    tx_create = contract.connect(sponsor).create_fusion_shot_escrow(
        args=[str(operator), "JET-CULHAM-04", 500, 1000, 6000],
        value=1000000000000000000  # 1 GEN
    )
    policy_id = str(tx_create.return_value)
    diag_url = "https://ccfe.ukaea.uk/diagnostics/jet_04.json"
    contract.connect(operator).submit_shot_diagnostics(args=[policy_id, diag_url])

    # Initial quench verdict
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "PLASMA_DISRUPTION_QUENCH",
                    "confidence": 90,
                    "reactor_facility_id": "JET-CULHAM-04",
                    "disruption_detected": True,
                    "measured_confinement_ms": 100,
                    "measured_q_factor_bps": 200,
                    "tbr_ratio_bps": 30,
                    "reason": "Thermal quench"
                })
            },
            "web_mocks": {
                diag_url: {"status": 200, "body": '{"QUENCH": true}'}
            }
        }
    )
    contract.connect(operator).adjudicate_plasma_shot(args=[policy_id])

    # Operator appeals claiming breakeven
    supp_url = "https://iaea.org/audits/jet_04_appellate.json"
    contract.connect(operator).appeal_verdict(
        args=[policy_id, "Operator disputes quench claim", supp_url],
        value=100000000000000000  # 0.1 GEN bond
    )

    # In appellate audit, operator's supplemental logs still show disruption_detected=True (or below-floor Q)
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": json.dumps({
                    "canary": "CANARY_AGENT_FUSION_PURITY_V1",
                    "verdict": "APPEAL_UPHELD_CERTIFIED",  # LLM erroneously says UPHELD_CERTIFIED
                    "reactor_facility_id": "JET-CULHAM-04",
                    "disruption_detected": True,  # But disruption was actually present!
                    "measured_confinement_ms": 600,
                    "measured_q_factor_bps": 1200,
                    "tbr_ratio_bps": 110,
                    "reason": "High power but runaway electron damage occurred."
                })
            },
            "web_mocks": {
                supp_url: {"status": 200, "body": '{"DISRUPTION": true}'}
            }
        }
    )

    contract.connect(operator).adjudicate_appeal(args=[policy_id])
    p_final = json.loads(contract.get_policy(args=[policy_id]).call())

    # Deterministic matrix enforces QUENCH!
    assert p_final["status"] == 5  # STATUS_SETTLED_REJECTED
    assert p_final["verdict"] == "PLASMA_DISRUPTION_QUENCH"

    # Sponsor receives 1.0 GEN escrow + 0.1 GEN forfeited bond = 1.1 GEN
    sp_bal = int(contract.get_claimable_balance(args=[str(sponsor)]).call())
    assert sp_bal == 1100000000000000000

    # Operator lost bond
    op_bal = int(contract.get_claimable_balance(args=[str(operator)]).call())
    assert op_bal == 0
