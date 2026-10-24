# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json

CANARY_TOKEN = "CANARY_AGENT_FUSION_PURITY_V1"

# Time & Cooling-Off Parameters
SECONDS_PER_BLOCK = 3
COOLING_OFF_BLOCKS = 24
COOLING_OFF_SECONDS = bigint(COOLING_OFF_BLOCKS * SECONDS_PER_BLOCK)  # 72 seconds
APPEAL_TIMEOUT_SECONDS = bigint(7 * 86400)                             # 7 days bounded appeal timeout
DEFAULT_SHOT_EXPIRY_SECONDS = bigint(86400 * 30)                      # 30 days coverage

# Lifecycle Statuses
STATUS_POLICY_OPEN = u8(0)           # Sponsor deposited fusion shot grant, awaiting pulse diagnostics
STATUS_TELEMETRY_SUBMITTED = u8(1)   # Tokamak facility submitted plasma diagnostics
STATUS_AWAITING_PAYOUT = u8(2)       # AI Jury rendered verdict, cooling-off active
STATUS_SETTLED_CERTIFIED_FULL = u8(3)# Confirmed Q-net Lawson criterion & stable TBR, 100% grant released
STATUS_SETTLED_PARTIAL = u8(4)       # Partial confinement duration milestone, 40% released
STATUS_SETTLED_REJECTED = u8(5)      # Plasma thermal quench / disruption damage, 100% refunded to sponsor
STATUS_DISPUTED = u8(6)              # Under appellate review with 10% staked bond
STATUS_EXPIRED_RECLAIMED = u8(7)     # Shot window expired without valid diagnostics, reclaimed by sponsor
STATUS_UNRESOLVED = u8(8)            # Diagnostic fetch, parse, or canary failure


class ContractError(Exception):
    """Domain-specific error for AgentFusionPurity protocol."""
    pass


def _addr_str(addr) -> str:
    """Safely format an Address instance into a lowercase hex string."""
    try:
        return addr.as_hex.lower()
    except Exception:
        return str(addr).lower()


def _get_sender() -> Address:
    """Safely obtain transaction sender across GenVM runtime versions."""
    try:
        return gl.message.sender_address
    except Exception:
        try:
            return gl.message.sender
        except Exception:
            raise ContractError("Cannot resolve sender address.")


ACCREDITED_FUSION_DIAGNOSTICS = [
    "iaea.org",
    "iter.org",
    "energy.gov",
    "ccfe.ukaea.uk",
    "ipp.mpg.de",
    "cfs.energy",
    "fusionenergysciences.org",
    "ornl.gov",
]


def _is_accredited_fusion_source(url: str) -> bool:
    """Verifies that plasma spectrometry telemetry originates strictly from accredited fusion research institutions."""
    clean = str(url).strip().lower()
    if not (clean.startswith("http://") or clean.startswith("https://")):
        return False
    try:
        no_proto = clean.split("://", 1)[1]
        host = no_proto.split("/", 1)[0].split(":", 1)[0]
        for domain in ACCREDITED_FUSION_DIAGNOSTICS:
            if host == domain or host.endswith("." + domain):
                return True
    except Exception:
        return False
    return False


def _evaluate_shot_criteria(
    fac_extracted: str,
    expected_facility: str,
    conf_ms: int,
    min_conf: int,
    q_bps: int,
    target_q: int,
    tbr_bps: int,
    disruption_detected: bool,
) -> tuple[str, str]:
    """
    Unified deterministic settlement matrix for both primary and appellate adjudication.
    Enforces documented physical, radiological, and provenance thresholds:
    1. Facility Provenance Rule: Missing or mismatched reactor facility triggers rejection.
    2. Plasma Disruption Rule: Thermal quench takes absolute precedence over confinement time.
    3. Lawson Q-Net Breakeven Rule: Confinement >= min_conf AND Q >= target_q AND TBR >= 1.05 (105 bps).
    4. Partial Confinement Milestone Rule: Confinement >= min_conf // 2 AND Q >= target_q // 2 AND TBR >= 90 bps.
    5. Sub-critical parameters (below floor Q, below floor confinement, or low TBR) trigger Quench.
    """
    clean_fac = str(fac_extracted).strip().upper()
    clean_exp = str(expected_facility).strip().upper()

    # 1. Facility Provenance Rule
    if not clean_fac or clean_fac != clean_exp:
        return (
            "PLASMA_DISRUPTION_QUENCH",
            f"Provenance Failure: Telemetry facility '{clean_fac}' does not match registered facility '{clean_exp}'."
        )

    # 2. Plasma Disruption Rule (absolute precedence)
    if disruption_detected:
        return (
            "PLASMA_DISRUPTION_QUENCH",
            "Disruption Quench: Destructive MHD instability or thermal quench detected during plasma discharge."
        )

    conf_floor = min_conf // 2
    q_floor = target_q // 2
    tbr_full_min = 105       # TBR >= 1.05
    tbr_partial_min = 90     # TBR >= 0.90 floor for partial milestone

    # 3. Lawson Q-Net Breakeven Certification (100% payout)
    if conf_ms >= min_conf and q_bps >= target_q and tbr_bps >= tbr_full_min:
        return (
            "FUSION_Q_NET_CERTIFIED",
            f"Lawson Q-Net Breakeven Verified: Q={q_bps / 1000.0:.3f}, Confinement={conf_ms}ms, TBR={tbr_bps / 100.0:.2f}."
        )

    # 4. Partial Confinement Milestone (40% milestone payout)
    if conf_ms >= conf_floor and q_bps >= q_floor and tbr_bps >= tbr_partial_min:
        return (
            "PARTIAL_CONFINEMENT_MILESTONE",
            f"Partial Confinement Milestone: Confinement={conf_ms}ms (floor {conf_floor}ms), Q={q_bps} bps (floor {q_floor} bps), TBR={tbr_bps} bps."
        )

    # 5. Below-Floor Parameters (100% refund to sponsor)
    fail_reasons = []
    if conf_ms < conf_floor:
        fail_reasons.append(f"Confinement {conf_ms}ms < floor {conf_floor}ms")
    if q_bps < q_floor:
        fail_reasons.append(f"Q-factor {q_bps} bps < floor {q_floor} bps")
    if tbr_bps < tbr_partial_min:
        fail_reasons.append(f"TBR {tbr_bps} bps < partial floor {tbr_partial_min} bps")
    if conf_ms >= min_conf and q_bps >= target_q and tbr_bps < tbr_full_min:
        fail_reasons.append(f"TBR {tbr_bps} bps < full certification threshold {tbr_full_min} bps")

    reason_str = "; ".join(fail_reasons) if fail_reasons else "Sub-critical confinement parameters."
    return (
        "PLASMA_DISRUPTION_QUENCH",
        f"Confinement Failure: {reason_str}"
    )


def _validate_adjudication_payloads(mine: dict, leader: dict) -> bool:
    """
    Independently compares EVERY payout-controlling measurement between validator and leader:
    1. Security Canary Token exact match
    2. Verdict exact match
    3. Telemetry SHA-256 Evidence Hash exact match
    4. Reactor Facility Identifier exact match
    5. Disruption Detected flag exact match
    6. Measured Confinement Time within 25 ms tolerance
    7. Measured Q-Factor within 50 bps tolerance
    8. Tritium Breeding Ratio within 5 bps tolerance
    """
    if not isinstance(leader, dict) or not isinstance(mine, dict):
        return False

    if leader.get("canary") != CANARY_TOKEN or mine.get("canary") != CANARY_TOKEN:
        return False

    if str(leader.get("verdict", "")).strip().upper() != str(mine.get("verdict", "")).strip().upper():
        return False

    if str(leader.get("evidence_hash", "")).strip() != str(mine.get("evidence_hash", "")).strip():
        return False

    if str(leader.get("reactor_facility_id", "")).strip().upper() != str(mine.get("reactor_facility_id", "")).strip().upper():
        return False

    if bool(leader.get("disruption_detected", False)) != bool(mine.get("disruption_detected", False)):
        return False

    try:
        conf_diff = abs(int(leader.get("measured_confinement_ms", 0)) - int(mine.get("measured_confinement_ms", 0)))
        if conf_diff > 25:
            return False
    except (ValueError, TypeError):
        return False

    try:
        q_diff = abs(int(leader.get("measured_q_factor_bps", 0)) - int(mine.get("measured_q_factor_bps", 0)))
        if q_diff > 50:
            return False
    except (ValueError, TypeError):
        return False

    try:
        tbr_diff = abs(int(leader.get("tbr_ratio_bps", 0)) - int(mine.get("tbr_ratio_bps", 0)))
        if tbr_diff > 5:
            return False
    except (ValueError, TypeError):
        return False

    return True


@allow_storage
@dataclass
class FusionPolicy:
    policy_id: str
    sponsor: Address               # DeepTech Fund / Fusion Research DAO
    tokamak_operator: Address      # Plasma physics facility / Tokamak operator
    dispute_initiator: Address     # Appellant who staked bond
    escrow_amount: bigint          # Locked experimental subsidy
    dispute_bond: bigint           # 10% appeal stake
    reactor_facility_id: str       # Reactor chamber identifier (e.g., "SPARC-EXPERIMENTAL-01")
    min_confinement_ms: u32        # Minimum required stable energy confinement time in ms
    target_q_factor_bps: u32       # Target Q-factor in basis points (e.g., 1000 = Q 1.0)
    diagnostic_feed_url: str       # Telemetry endpoint
    evidence_hash: str             # SHA-256 snapshot of raw diagnostics
    status: u8
    verdict: str
    original_verdict: str          # Preserved pre-appeal verdict
    reason: str
    confidence: u8
    measured_confinement_ms: u32   # Measured stable confinement time in ms
    measured_q_factor_bps: u32     # Measured Q-factor (basis points)
    tbr_ratio_bps: u32             # Tritium Breeding Ratio in basis points (e.g. 108 = 1.08)
    created_at_time: bigint        # Trusted Unix timestamp when policy was created
    expires_at_time: bigint        # Trusted Unix timestamp when coverage concludes
    audit_completed_time: bigint   # Trusted Unix timestamp when AI jury rendered verdict
    supplemental_evidence_url: str # Bound appellate evidence URL
    appeal_prior_verdict: str      # Verdict recorded before appeal was filed
    dispute_filed_time: bigint     # Timestamp when appellate dispute was staked


class Contract(gl.Contract):
    """
    AgentFusionPurity: Autonomous Magnetic Confinement Fusion Plasma & Tritium Breeding Oracle
    Target Network: GenLayer StudioNet (Chain ID: 61999)
    """
    policies: TreeMap[str, FusionPolicy]
    policy_ids: DynArray[str]
    total_fusion_locked: bigint
    total_shots_settled: u32
    policy_counter: u64
    owner: Address
    claimable_balances: TreeMap[str, bigint]
    total_pending_claims: bigint
    total_withdrawn_ledger: TreeMap[str, bigint]

    def __init__(self):
        deployer = _get_sender()
        self.owner = deployer
        self.total_fusion_locked = bigint(0)
        self.total_shots_settled = u32(0)
        self.policy_counter = u64(0)
        self.total_pending_claims = bigint(0)

    def _resolve_pid(self, policy_id) -> str:
        return str(policy_id).strip()

    def _credit_payout(self, recipient: Address, amount: bigint) -> None:
        """Pure Pull-Payment accounting: guarantees safe escrow disbursement."""
        if amount <= bigint(0):
            return
        rec_str = _addr_str(recipient)
        curr = self.claimable_balances.get(rec_str, bigint(0))
        self.claimable_balances[rec_str] = curr + amount
        self.total_pending_claims = self.total_pending_claims + amount

    def _get_current_timestamp(self) -> bigint:
        """Derives trusted Unix timestamp strictly from consensus context (gl.message_raw['datetime'])."""
        import calendar
        from datetime import datetime, timezone
        try:
            if hasattr(gl, "message_raw") and isinstance(gl.message_raw, dict):
                raw_val = gl.message_raw.get("datetime", "")
                if raw_val:
                    dt_str = str(raw_val).strip().replace("Z", "+00:00")
                    dt = datetime.fromisoformat(dt_str)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    ts = calendar.timegm(dt.utctimetuple())
                    if ts > 0:
                        return bigint(ts)
        except Exception:
            pass
        return bigint(1760000000)

    # ── Public Write Methods ──────────────────────────────────────────

    @gl.public.write.payable
    def create_fusion_shot_escrow(
        self,
        tokamak_operator: Address,
        reactor_facility_id: str,
        min_confinement_ms: u32,
        target_q_factor_bps: u32,
        duration_blocks: u32
    ) -> str:
        escrow = bigint(gl.message.value)
        if escrow <= bigint(0):
            raise ContractError("Fusion grant escrow deposit must be greater than 0 GEN.")

        clean_fac = str(reactor_facility_id).strip().upper()
        if len(clean_fac) < 4:
            raise ContractError("Valid reactor chamber ID required (>= 4 chars).")

        sender = _get_sender()
        if _addr_str(sender) == _addr_str(tokamak_operator):
            raise ContractError("Sponsor cannot designate themselves as tokamak operator.")

        dur_secs = bigint(int(duration_blocks) * 3 if int(duration_blocks) > 0 else int(DEFAULT_SHOT_EXPIRY_SECONDS))

        self.policy_counter = self.policy_counter + u64(1)
        policy_id = str(self.policy_counter)
        current_time = self._get_current_timestamp()
        expires_at = current_time + dur_secs

        new_policy = FusionPolicy(
            policy_id=policy_id,
            sponsor=sender,
            tokamak_operator=tokamak_operator,
            dispute_initiator=sender,
            escrow_amount=escrow,
            dispute_bond=bigint(0),
            reactor_facility_id=clean_fac,
            min_confinement_ms=u32(int(min_confinement_ms)),
            target_q_factor_bps=u32(int(target_q_factor_bps)),
            diagnostic_feed_url="",
            evidence_hash="",
            status=STATUS_POLICY_OPEN,
            verdict="PENDING",
            original_verdict="PENDING",
            reason="Fusion shot policy active. Monitored for Lawson triple product and MHD plasma stability.",
            confidence=u8(0),
            measured_confinement_ms=u32(0),
            measured_q_factor_bps=u32(0),
            tbr_ratio_bps=u32(0),
            created_at_time=current_time,
            expires_at_time=expires_at,
            audit_completed_time=bigint(0),
            supplemental_evidence_url="",
            appeal_prior_verdict="",
            dispute_filed_time=bigint(0),
        )

        self.policies[policy_id] = new_policy
        self.policy_ids.append(policy_id)
        self.total_fusion_locked = self.total_fusion_locked + escrow
        return policy_id

    @gl.public.write
    def submit_shot_diagnostics(
        self,
        policy_id: str,
        diagnostic_feed_url: str
    ) -> None:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status not in (STATUS_POLICY_OPEN, STATUS_UNRESOLVED):
            raise ContractError("Policy is not open for diagnostic submission.")

        sender = _get_sender()
        if _addr_str(sender) != _addr_str(p.tokamak_operator):
            raise ContractError("Role Violation: Only registered tokamak operator can submit shot diagnostics.")

        clean_url = str(diagnostic_feed_url).strip()
        if not _is_accredited_fusion_source(clean_url):
            raise ContractError("Telemetry unauthenticated: Must originate from an accredited fusion research institution (IAEA, ITER, CCFE, IPP).")

        current_time = self._get_current_timestamp()
        if current_time > p.expires_at_time:
            raise ContractError("Coverage duration for this fusion pulse policy has expired.")

        p.diagnostic_feed_url = clean_url
        p.status = STATUS_TELEMETRY_SUBMITTED
        p.reason = "Pulse spectrometry and neutron telemetry submitted. Ready for on-chain AI Tribunal verification."

    @gl.public.write
    def adjudicate_plasma_shot(self, policy_id: str) -> None:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status not in (STATUS_TELEMETRY_SUBMITTED, STATUS_UNRESOLVED):
            raise ContractError("Policy is not awaiting shot adjudication.")

        sender_str = _addr_str(_get_sender())
        if (
            sender_str != _addr_str(p.sponsor)
            and sender_str != _addr_str(p.tokamak_operator)
            and sender_str != _addr_str(self.owner)
        ):
            raise ContractError("Permission Denied: Only sponsor, tokamak operator, or owner can trigger adjudication.")

        # Read storage fields outside nondet block
        feed_url = p.diagnostic_feed_url
        facility = p.reactor_facility_id
        target_q = int(p.target_q_factor_bps)
        min_confinement = int(p.min_confinement_ms)

        def leader_fn():
            import hashlib
            raw_feed = ""
            try:
                raw_feed = gl.nondet.web.render(feed_url, mode="text")
            except Exception:
                pass

            if not raw_feed:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "UNRESOLVED_FETCH_FAILED",
                    "confidence": 0,
                    "reactor_facility_id": "",
                    "disruption_detected": False,
                    "measured_confinement_ms": 0,
                    "measured_q_factor_bps": 0,
                    "tbr_ratio_bps": 0,
                    "reason": "Plasma diagnostic feed unreachable or empty.",
                    "evidence_hash": "0000000000000000000000000000000000000000000000000000000000000000",
                }

            ev_hash = hashlib.sha256(raw_feed.encode("utf-8")).hexdigest()

            prompt = f"""You are the Chief Plasma Physicist & Nuclear Confinement Magistrate on GenLayer.
Evaluate the diagnostic pulse run telemetry for tokamak reactor: {facility}.
MINIMUM CONFINEMENT TIME: >= {min_confinement} ms
TARGET Q-FACTOR: >= {target_q} basis points (e.g. 1000 = Q 1.0 net energy gain)

SHOT SPECTROSCOPY & DIAGNOSTIC PAYLOAD:
<fusion_diagnostic_payload>
{raw_feed[:4000]}
</fusion_diagnostic_payload>

EVALUATION RUBRIC:
1. Extract reactor_facility_id from telemetry.
2. Detect signs of thermal quench, runaway electrons, or major plasma disruption (disruption_detected: true/false).
3. Extract measured_confinement_ms (duration of steady-state H-mode without major disruption).
4. Extract measured_q_factor_bps (ratio of fusion power out to heating power in, scaled x1000).
5. Extract tbr_ratio_bps (Tritium Breeding Ratio scaled x100, e.g. 1.05 = 105).
6. Decision Matrix:
   - FUSION_Q_NET_CERTIFIED: Confinement >= {min_confinement} ms AND Q-factor >= {target_q} AND TBR >= 105 with zero disruption.
   - PARTIAL_CONFINEMENT_MILESTONE: Confinement >= ({min_confinement} // 2) ms AND Q-factor >= ({target_q} // 2) AND TBR >= 90 with zero disruption.
   - PLASMA_DISRUPTION_QUENCH: Thermal quench detected OR Confinement < ({min_confinement} // 2) ms OR Q-factor < ({target_q} // 2).

SECURITY CANARY: Echo "{CANARY_TOKEN}" in JSON.
Respond ONLY with valid JSON without markdown fences:
{{
  "canary": "{CANARY_TOKEN}",
  "verdict": "FUSION_Q_NET_CERTIFIED" | "PARTIAL_CONFINEMENT_MILESTONE" | "PLASMA_DISRUPTION_QUENCH",
  "confidence": <0-100>,
  "reactor_facility_id": "<exact facility string>",
  "disruption_detected": true | false,
  "measured_confinement_ms": <integer>,
  "measured_q_factor_bps": <integer>,
  "tbr_ratio_bps": <integer>,
  "reason": "<rigorous plasma physics evaluation under 200 chars>"
}}"""

            raw_res = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = None
            if isinstance(raw_res, dict):
                parsed = raw_res
            elif isinstance(raw_res, str):
                try:
                    parsed = json.loads(raw_res.replace("```json", "").replace("```", "").strip())
                except Exception:
                    pass

            if not parsed or not isinstance(parsed, dict):
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "UNRESOLVED_PARSE_FAILED",
                    "confidence": 0,
                    "reactor_facility_id": "",
                    "disruption_detected": False,
                    "measured_confinement_ms": 0,
                    "measured_q_factor_bps": 0,
                    "tbr_ratio_bps": 0,
                    "reason": "AI validator parsing failed or malformed JSON returned.",
                    "evidence_hash": ev_hash,
                }

            if str(parsed.get("canary", "")) != CANARY_TOKEN:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "UNRESOLVED_CANARY_FAILED",
                    "confidence": 0,
                    "reactor_facility_id": "",
                    "disruption_detected": False,
                    "measured_confinement_ms": 0,
                    "measured_q_factor_bps": 0,
                    "tbr_ratio_bps": 0,
                    "reason": "Security canary mismatch detected in jury output.",
                    "evidence_hash": ev_hash,
                }

            v_raw = str(parsed.get("verdict", "")).upper().strip()
            if v_raw not in {"FUSION_Q_NET_CERTIFIED", "PARTIAL_CONFINEMENT_MILESTONE", "PLASMA_DISRUPTION_QUENCH"}:
                v_raw = "UNRESOLVED_PARSE_FAILED"

            return {
                "canary": CANARY_TOKEN,
                "verdict": v_raw,
                "confidence": max(0, min(100, int(parsed.get("confidence", 85)))),
                "reactor_facility_id": str(parsed.get("reactor_facility_id", "")).strip().upper(),
                "disruption_detected": bool(parsed.get("disruption_detected", False)),
                "measured_confinement_ms": max(0, min(100000, int(parsed.get("measured_confinement_ms", 0)))),
                "measured_q_factor_bps": max(0, min(100000, int(parsed.get("measured_q_factor_bps", 0)))),
                "tbr_ratio_bps": max(0, min(1000, int(parsed.get("tbr_ratio_bps", 0)))),
                "reason": str(parsed.get("reason", "Plasma shot diagnostic concluded."))[:200],
                "evidence_hash": ev_hash,
            }

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader = leader_res.calldata
            if isinstance(leader, str):
                try:
                    leader = json.loads(leader)
                except Exception:
                    return False
            mine = leader_fn()
            return _validate_adjudication_payloads(mine, leader)

        adjudication_res = gl.vm.run_nondet(leader_fn, validator_fn)
        v_res = str(adjudication_res["verdict"])

        if v_res.startswith("UNRESOLVED_"):
            p.status = STATUS_UNRESOLVED
            p.verdict = v_res
            p.reason = str(adjudication_res["reason"])
            p.evidence_hash = str(adjudication_res.get("evidence_hash", ""))
            return

        ev_hash = str(adjudication_res.get("evidence_hash", ""))
        fac_extracted = str(adjudication_res.get("reactor_facility_id", "")).strip().upper()
        disruption_detected = bool(adjudication_res.get("disruption_detected", False))
        meas_conf = int(adjudication_res.get("measured_confinement_ms", 0))
        meas_q = int(adjudication_res.get("measured_q_factor_bps", 0))
        meas_tbr = int(adjudication_res.get("tbr_ratio_bps", 0))

        p.evidence_hash = ev_hash
        p.measured_confinement_ms = u32(max(0, min(100000, meas_conf)))
        p.measured_q_factor_bps = u32(max(0, min(100000, meas_q)))
        p.tbr_ratio_bps = u32(max(0, min(1000, meas_tbr)))
        p.confidence = u8(max(0, min(100, int(adjudication_res.get("confidence", 85)))))

        # Independent on-chain deterministic threshold verification
        det_verdict, det_reason = _evaluate_shot_criteria(
            fac_extracted=fac_extracted,
            expected_facility=p.reactor_facility_id,
            conf_ms=meas_conf,
            min_conf=int(p.min_confinement_ms),
            q_bps=meas_q,
            target_q=int(p.target_q_factor_bps),
            tbr_bps=meas_tbr,
            disruption_detected=disruption_detected,
        )

        p.verdict = det_verdict
        p.reason = det_reason
        p.original_verdict = p.verdict
        p.audit_completed_time = self._get_current_timestamp()
        p.status = STATUS_AWAITING_PAYOUT

    @gl.public.write.payable
    def appeal_verdict(
        self,
        policy_id: str,
        dispute_reason: str,
        supplemental_audit_url: str
    ) -> None:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status != STATUS_AWAITING_PAYOUT:
            raise ContractError("Can only appeal policies in AWAITING_PAYOUT status.")

        sender = _get_sender()
        if _addr_str(sender) != _addr_str(p.sponsor) and _addr_str(sender) != _addr_str(p.tokamak_operator):
            raise ContractError("Role Violation: Only sponsor or tokamak operator can file an appeal.")

        current_time = self._get_current_timestamp()
        if current_time > (p.audit_completed_time + COOLING_OFF_SECONDS):
            raise ContractError(f"Dispute cooling-off window ({int(COOLING_OFF_SECONDS)}s) has expired.")

        clean_url = str(supplemental_audit_url).strip()
        if not _is_accredited_fusion_source(clean_url):
            raise ContractError("Supplemental telemetry unauthenticated: Must originate from an accredited fusion research institution.")

        required_bond = (p.escrow_amount * bigint(10)) // bigint(100)
        if required_bond == bigint(0):
            required_bond = bigint(1)

        staked = bigint(gl.message.value)
        if staked < required_bond:
            raise ContractError(f"Must stake at least 10% dispute bond ({int(required_bond)} wei).")

        clean_reason = str(dispute_reason).strip()
        if len(clean_reason) < 10:
            raise ContractError("Detailed dispute justification (>= 10 chars) required.")

        p.appeal_prior_verdict = p.verdict
        p.status = STATUS_DISPUTED
        p.dispute_initiator = sender
        p.dispute_bond = staked
        p.dispute_filed_time = current_time
        p.supplemental_evidence_url = clean_url
        p.reason = f"[DISPUTE by {_addr_str(sender)[:8]}]: {clean_reason} | Prior: {p.reason}"
        self.total_fusion_locked = self.total_fusion_locked + staked

    @gl.public.write
    def adjudicate_appeal(self, policy_id: str) -> None:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status != STATUS_DISPUTED:
            raise ContractError("Policy is not in DISPUTED status.")

        sender_str = _addr_str(_get_sender())
        if (
            sender_str != _addr_str(p.sponsor)
            and sender_str != _addr_str(p.tokamak_operator)
            and sender_str != _addr_str(self.owner)
        ):
            raise ContractError("Permission Denied: Only sponsor, operator, or owner can adjudicate appeal.")

        # Read storage fields outside nondet block
        bound_url = p.supplemental_evidence_url
        appellant = p.dispute_initiator
        prior_verdict = p.appeal_prior_verdict
        is_sponsor_appellant = (_addr_str(appellant) == _addr_str(p.sponsor))
        facility_id = p.reactor_facility_id
        min_conf = int(p.min_confinement_ms)
        target_q = int(p.target_q_factor_bps)

        def leader_fn():
            import hashlib
            raw_supp = ""
            try:
                raw_supp = gl.nondet.web.render(bound_url, mode="text")
            except Exception:
                pass

            if not raw_supp:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "APPEAL_UNRESOLVED_FETCH_FAILED",
                    "reactor_facility_id": "",
                    "disruption_detected": False,
                    "measured_confinement_ms": 0,
                    "measured_q_factor_bps": 0,
                    "tbr_ratio_bps": 0,
                    "reason": "Supplemental fusion diagnostic report unreachable.",
                    "evidence_hash": "0000000000000000000000000000000000000000000000000000000000000000",
                }

            ev_hash = hashlib.sha256(raw_supp.encode("utf-8")).hexdigest()

            prompt = f"""You are the Supreme Plasma Physics Appellate Magistrate on GenLayer.
Evaluate bound third-party bolometer and Thomson scattering spectra for facility {facility_id}:
PRIOR VERDICT: {prior_verdict}
APPELLANT: {'SPONSOR' if is_sponsor_appellant else 'TOKAMAK_OPERATOR'}
MINIMUM CONFINEMENT TIME: >= {min_conf} ms
TARGET Q-FACTOR: >= {target_q} basis points (e.g. 1000 = Q 1.0 net energy gain)

SUPPLEMENTAL AUDIT DATA:
<supplemental_diagnostic_payload>
{raw_supp[:4000]}
</supplemental_diagnostic_payload>

EVALUATION RUBRIC:
1. Extract reactor_facility_id from supplemental telemetry.
2. Detect signs of thermal quench, runaway electrons, or major plasma disruption (disruption_detected: true/false).
3. Extract measured_confinement_ms (duration of steady-state H-mode without major disruption).
4. Extract measured_q_factor_bps (scaled x1000).
5. Extract tbr_ratio_bps (Tritium Breeding Ratio scaled x100, e.g. 1.05 = 105).
6. Appellate Ruling:
   - APPEAL_UPHELD_CERTIFIED: Confinement >= {min_conf} ms AND Q >= {target_q} AND TBR >= 105 with zero disruption.
   - APPEAL_UPHELD_PARTIAL: Confinement >= ({min_conf} // 2) ms AND Q >= ({target_q} // 2) AND TBR >= 90 with zero disruption.
   - APPEAL_UPHELD_REJECTED: Disruption detected OR Confinement < ({min_conf} // 2) ms OR Q < ({target_q} // 2).
   - APPEAL_DISMISSED: Reaffirms prior verdict without change.

SECURITY CANARY: Echo "{CANARY_TOKEN}" in JSON.
Respond ONLY with valid JSON without markdown fences:
{{
  "canary": "{CANARY_TOKEN}",
  "verdict": "APPEAL_UPHELD_CERTIFIED" | "APPEAL_UPHELD_PARTIAL" | "APPEAL_UPHELD_REJECTED" | "APPEAL_DISMISSED",
  "reactor_facility_id": "<exact facility string>",
  "disruption_detected": true | false,
  "measured_confinement_ms": <integer>,
  "measured_q_factor_bps": <integer>,
  "tbr_ratio_bps": <integer>,
  "reason": "<appellate rationale under 200 chars>"
}}"""

            raw_res = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = None
            if isinstance(raw_res, dict):
                parsed = raw_res
            elif isinstance(raw_res, str):
                try:
                    parsed = json.loads(raw_res.replace("```json", "").replace("```", "").strip())
                except Exception:
                    pass

            if not parsed or not isinstance(parsed, dict) or str(parsed.get("canary", "")) != CANARY_TOKEN:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "APPEAL_UNRESOLVED_PARSE_FAILED",
                    "reactor_facility_id": "",
                    "disruption_detected": False,
                    "measured_confinement_ms": 0,
                    "measured_q_factor_bps": 0,
                    "tbr_ratio_bps": 0,
                    "reason": "Appellate parsing failure or canary mismatch.",
                    "evidence_hash": ev_hash,
                }

            v_str = str(parsed.get("verdict", "")).upper().strip()
            if v_str not in {"APPEAL_UPHELD_CERTIFIED", "APPEAL_UPHELD_PARTIAL", "APPEAL_UPHELD_REJECTED", "APPEAL_DISMISSED"}:
                v_str = "APPEAL_UNRESOLVED_PARSE_FAILED"

            return {
                "canary": CANARY_TOKEN,
                "verdict": v_str,
                "reactor_facility_id": str(parsed.get("reactor_facility_id", "")).strip().upper(),
                "disruption_detected": bool(parsed.get("disruption_detected", False)),
                "measured_confinement_ms": max(0, min(100000, int(parsed.get("measured_confinement_ms", 0)))),
                "measured_q_factor_bps": max(0, min(100000, int(parsed.get("measured_q_factor_bps", 0)))),
                "tbr_ratio_bps": max(0, min(1000, int(parsed.get("tbr_ratio_bps", 0)))),
                "reason": str(parsed.get("reason", "Appellate review completed."))[:200],
                "evidence_hash": ev_hash,
            }

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader = leader_res.calldata
            if isinstance(leader, str):
                try:
                    leader = json.loads(leader)
                except Exception:
                    return False
            mine = leader_fn()
            return _validate_adjudication_payloads(mine, leader)

        appeal_res = gl.vm.run_nondet(leader_fn, validator_fn)
        app_verdict = appeal_res["verdict"]

        if app_verdict.startswith("APPEAL_UNRESOLVED_"):
            p.status = STATUS_UNRESOLVED
            p.verdict = app_verdict
            p.reason = f"[APPEAL UNRESOLVED] {appeal_res['reason']}"
            return

        fac_app = str(appeal_res.get("reactor_facility_id", "")).strip().upper()
        conf_app = int(appeal_res.get("measured_confinement_ms", 0))
        q_app = int(appeal_res.get("measured_q_factor_bps", 0))
        tbr_app = int(appeal_res.get("tbr_ratio_bps", 0))
        disrupt_app = bool(appeal_res.get("disruption_detected", False))

        # Enforce the EXACT SAME documented deterministic settlement criteria
        det_outcome, det_reason = _evaluate_shot_criteria(
            fac_extracted=fac_app,
            expected_facility=p.reactor_facility_id,
            conf_ms=conf_app,
            min_conf=min_conf,
            q_bps=q_app,
            target_q=target_q,
            tbr_bps=tbr_app,
            disruption_detected=disrupt_app,
        )

        p.measured_confinement_ms = u32(max(0, min(100000, conf_app)))
        p.measured_q_factor_bps = u32(max(0, min(100000, q_app)))
        p.tbr_ratio_bps = u32(max(0, min(1000, tbr_app)))
        p.evidence_hash = str(appeal_res.get("evidence_hash", ""))

        escrow_val = p.escrow_amount
        bond_val = p.dispute_bond
        total_settling = escrow_val + bond_val
        p.dispute_bond = bigint(0)
        p.escrow_amount = bigint(0)

        self.total_fusion_locked = self.total_fusion_locked - total_settling
        self.total_shots_settled = self.total_shots_settled + u32(1)

        counterparty = p.tokamak_operator if is_sponsor_appellant else p.sponsor

        if det_outcome == "FUSION_Q_NET_CERTIFIED":
            p.status = STATUS_SETTLED_CERTIFIED_FULL
            p.verdict = "FUSION_Q_NET_CERTIFIED"
            p.reason = f"[APPEAL RESOLUTION - CERTIFIED] {det_reason}"
            self._credit_payout(p.tokamak_operator, escrow_val)
            if not is_sponsor_appellant:
                self._credit_payout(appellant, bond_val)
            else:
                self._credit_payout(counterparty, bond_val)

        elif det_outcome == "PARTIAL_CONFINEMENT_MILESTONE":
            p.status = STATUS_SETTLED_PARTIAL
            p.verdict = "PARTIAL_CONFINEMENT_MILESTONE"
            payout = (escrow_val * bigint(40)) // bigint(100)
            refund = escrow_val - payout
            p.reason = f"[APPEAL RESOLUTION - PARTIAL] {det_reason}"
            self._credit_payout(p.tokamak_operator, payout)
            self._credit_payout(p.sponsor, refund)
            if p.original_verdict != "PARTIAL_CONFINEMENT_MILESTONE":
                self._credit_payout(appellant, bond_val)
            else:
                self._credit_payout(counterparty, bond_val)

        else:
            p.status = STATUS_SETTLED_REJECTED
            p.verdict = "PLASMA_DISRUPTION_QUENCH"
            p.reason = f"[APPEAL RESOLUTION - QUENCH] {det_reason}"
            self._credit_payout(p.sponsor, escrow_val)
            if is_sponsor_appellant:
                self._credit_payout(appellant, bond_val)
            else:
                self._credit_payout(counterparty, bond_val)

    @gl.public.write
    def resolve_stale_appeal(self, policy_id: str) -> None:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status not in (STATUS_DISPUTED, STATUS_UNRESOLVED):
            raise ContractError("Policy is not in a disputed or unresolved appellate state.")

        if p.dispute_bond <= bigint(0):
            raise ContractError("No active dispute bond locked on this policy.")

        current_time = self._get_current_timestamp()
        timeout_threshold = p.dispute_filed_time + APPEAL_TIMEOUT_SECONDS
        is_timed_out = (current_time > timeout_threshold)
        is_unresolvable_error = (p.status == STATUS_UNRESOLVED and str(p.verdict).startswith("APPEAL_UNRESOLVED_"))

        if not is_timed_out and not is_unresolvable_error:
            rem = int(timeout_threshold - current_time)
            raise ContractError(f"Appellate window is active. Timeout recovery available in {max(0, rem)} seconds.")

        sender_str = _addr_str(_get_sender())
        if (
            sender_str != _addr_str(p.sponsor)
            and sender_str != _addr_str(p.tokamak_operator)
            and sender_str != _addr_str(p.dispute_initiator)
            and sender_str != _addr_str(self.owner)
        ):
            raise ContractError("Permission Denied: Only policy participants, appellant, or owner can trigger appeal recovery.")

        bond_val = p.dispute_bond
        p.dispute_bond = bigint(0)
        self.total_fusion_locked = self.total_fusion_locked - bond_val if self.total_fusion_locked >= bond_val else bigint(0)

        self._credit_payout(p.dispute_initiator, bond_val)

        p.verdict = p.appeal_prior_verdict if p.appeal_prior_verdict and p.appeal_prior_verdict != "PENDING" else "PLASMA_DISRUPTION_QUENCH"
        p.status = STATUS_AWAITING_PAYOUT
        p.audit_completed_time = current_time
        p.reason = f"[APPEAL TIMEOUT RECOVERY]: Supplemental telemetry timed out or unreachable. 100% dispute bond ({bond_val} wei) refunded to appellant. Policy restored to prior verdict '{p.verdict}'."

    @gl.public.write
    def finalize_settlement(self, policy_id: str) -> None:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if p.status != STATUS_AWAITING_PAYOUT:
            raise ContractError("Policy is not in STATUS_AWAITING_PAYOUT state.")

        current_time = self._get_current_timestamp()
        if current_time <= (p.audit_completed_time + COOLING_OFF_SECONDS):
            remaining = (p.audit_completed_time + COOLING_OFF_SECONDS) - current_time
            raise ContractError(f"Cooling-off challenge window ({int(COOLING_OFF_SECONDS)}s) is active. Payout locked for another {remaining}s.")

        sender_str = _addr_str(_get_sender())
        if (
            sender_str != _addr_str(p.sponsor)
            and sender_str != _addr_str(p.tokamak_operator)
            and sender_str != _addr_str(self.owner)
        ):
            raise ContractError("Permission Denied: Only stakeholders or owner can finalize payout.")

        escrow_val = p.escrow_amount
        p.escrow_amount = bigint(0)
        self.total_fusion_locked = self.total_fusion_locked - escrow_val
        self.total_shots_settled = self.total_shots_settled + u32(1)

        if p.verdict == "FUSION_Q_NET_CERTIFIED":
            p.status = STATUS_SETTLED_CERTIFIED_FULL
            self._credit_payout(p.tokamak_operator, escrow_val)

        elif p.verdict == "PARTIAL_CONFINEMENT_MILESTONE":
            p.status = STATUS_SETTLED_PARTIAL
            payout = (escrow_val * bigint(40)) // bigint(100)
            refund = escrow_val - payout
            self._credit_payout(p.tokamak_operator, payout)
            self._credit_payout(p.sponsor, refund)

        else:
            p.status = STATUS_SETTLED_REJECTED
            self._credit_payout(p.sponsor, escrow_val)

    @gl.public.write
    def cancel_or_reclaim(self, policy_id: str) -> None:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        if _addr_str(_get_sender()) != _addr_str(p.sponsor) and _addr_str(_get_sender()) != _addr_str(self.owner):
            raise ContractError("Role Violation: Only sponsor fund or owner can reclaim expired experimental escrow.")

        current_time = self._get_current_timestamp()
        if p.status in (STATUS_POLICY_OPEN, STATUS_UNRESOLVED):
            if current_time < p.expires_at_time:
                raise ContractError(f"Cannot reclaim: Policy is still active (expires at {int(p.expires_at_time)}).")
        else:
            raise ContractError("Cannot reclaim: Shot telemetry is actively undergoing evaluation or already settled.")

        p.status = STATUS_EXPIRED_RECLAIMED
        p.verdict = "EXPIRED_CLEAN"
        p.reason = "Pulse duration completed without valid plasma diagnostics. Escrow reclaimed by sponsor fund."

        escrow_val = p.escrow_amount
        p.escrow_amount = bigint(0)
        self.total_fusion_locked = self.total_fusion_locked - escrow_val
        self._credit_payout(p.sponsor, escrow_val)

    @gl.public.write
    def claim_payout(self) -> None:
        sender = _get_sender()
        s_str = _addr_str(sender)
        bal = self.claimable_balances.get(s_str, bigint(0))
        if bal <= bigint(0):
            raise ContractError("No claimable balance available for withdrawal.")

        try:
            gl.get_contract_at(sender).emit_transfer(value=u256(int(bal)))
        except Exception as e:
            raise ContractError(f"Outbound transfer failed during claim: {str(e)}. Balance preserved.")

        self.claimable_balances[s_str] = bigint(0)
        self.total_pending_claims = self.total_pending_claims - bal if self.total_pending_claims >= bal else bigint(0)
        prev_w = self.total_withdrawn_ledger.get(s_str, bigint(0))
        self.total_withdrawn_ledger[s_str] = prev_w + bal

    # ── Read-only Views ───────────────────────────────────────────────

    @gl.public.view
    def get_policy(self, policy_id: str) -> str:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            raise ContractError(f"Policy {pid} does not exist.")

        p = self.policies[pid]
        data = {
            "policy_id": p.policy_id,
            "sponsor": _addr_str(p.sponsor),
            "tokamak_operator": _addr_str(p.tokamak_operator),
            "dispute_initiator": _addr_str(p.dispute_initiator),
            "escrow_amount": str(p.escrow_amount),
            "dispute_bond": str(p.dispute_bond),
            "reactor_facility_id": p.reactor_facility_id,
            "min_confinement_ms": int(p.min_confinement_ms),
            "target_q_factor_bps": int(p.target_q_factor_bps),
            "diagnostic_feed_url": p.diagnostic_feed_url,
            "evidence_hash": p.evidence_hash,
            "status": int(p.status),
            "verdict": p.verdict,
            "original_verdict": p.original_verdict,
            "reason": p.reason,
            "confidence": int(p.confidence),
            "measured_confinement_ms": int(p.measured_confinement_ms),
            "measured_q_factor_bps": int(p.measured_q_factor_bps),
            "tbr_ratio_bps": int(p.tbr_ratio_bps),
            "created_at_time": str(p.created_at_time),
            "expires_at_time": str(p.expires_at_time),
            "audit_completed_time": str(p.audit_completed_time),
            "supplemental_evidence_url": p.supplemental_evidence_url,
            "appeal_prior_verdict": p.appeal_prior_verdict,
            "dispute_filed_time": str(p.dispute_filed_time),
        }
        return json.dumps(data)

    @gl.public.view
    def get_remaining_cooling_off_seconds(self, policy_id: str) -> u64:
        pid = self._resolve_pid(policy_id)
        if pid not in self.policies:
            return u64(0)
        p = self.policies[pid]
        if p.status != STATUS_AWAITING_PAYOUT or p.audit_completed_time <= bigint(0):
            return u64(0)
        current_time = self._get_current_timestamp()
        expiry = p.audit_completed_time + COOLING_OFF_SECONDS
        remaining = int(expiry - current_time)
        return u64(remaining if remaining > 0 else 0)

    @gl.public.view
    def get_policy_count(self) -> u64:
        return u64(len(self.policy_ids))

    @gl.public.view
    def get_all_policies(self) -> str:
        policies_list = []
        for pid in self.policy_ids:
            if pid in self.policies:
                p = self.policies[pid]
                policies_list.append({
                    "policy_id": p.policy_id,
                    "sponsor": _addr_str(p.sponsor),
                    "tokamak_operator": _addr_str(p.tokamak_operator),
                    "dispute_initiator": _addr_str(p.dispute_initiator),
                    "escrow_amount": str(p.escrow_amount),
                    "dispute_bond": str(p.dispute_bond),
                    "reactor_facility_id": p.reactor_facility_id,
                    "min_confinement_ms": int(p.min_confinement_ms),
                    "target_q_factor_bps": int(p.target_q_factor_bps),
                    "diagnostic_feed_url": p.diagnostic_feed_url,
                    "evidence_hash": p.evidence_hash,
                    "status": int(p.status),
                    "verdict": p.verdict,
                    "original_verdict": p.original_verdict,
                    "reason": p.reason,
                    "confidence": int(p.confidence),
                    "measured_confinement_ms": int(p.measured_confinement_ms),
                    "measured_q_factor_bps": int(p.measured_q_factor_bps),
                    "tbr_ratio_bps": int(p.tbr_ratio_bps),
                    "created_at_time": str(p.created_at_time),
                    "expires_at_time": str(p.expires_at_time),
                    "audit_completed_time": str(p.audit_completed_time),
                    "dispute_filed_time": str(p.dispute_filed_time),
                })
        return json.dumps(policies_list)

    @gl.public.view
    def get_claimable_balance(self, account: Address) -> str:
        return str(self.claimable_balances.get(_addr_str(account), bigint(0)))

    @gl.public.view
    def get_stats(self) -> str:
        data = {
            "total_policies": len(self.policy_ids),
            "total_fusion_locked": str(self.total_fusion_locked),
            "total_shots_settled": int(self.total_shots_settled),
            "total_pending_claims": str(self.total_pending_claims),
            "owner": _addr_str(self.owner),
        }
        return json.dumps(data)

    @gl.public.view
    def evaluate_shot_criteria_view(
        self,
        fac_extracted: str,
        expected_facility: str,
        conf_ms: int,
        min_conf: int,
        q_bps: int,
        target_q: int,
        tbr_bps: int,
        disruption_detected: bool,
    ) -> str:
        verdict, _ = _evaluate_shot_criteria(
            fac_extracted, expected_facility, conf_ms, min_conf, q_bps, target_q, tbr_bps, disruption_detected
        )
        return verdict

    @gl.public.view
    def validate_measurements_agreement_view(
        self,
        mine_json: str,
        leader_json: str,
    ) -> bool:
        try:
            m = json.loads(mine_json)
            l = json.loads(leader_json)
            return _validate_adjudication_payloads(m, l)
        except Exception:
            return False
