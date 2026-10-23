# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json
import hashlib

CANARY_TOKEN = "CANARY_AGENT_FUSION_PURITY_V1"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

# Time & Cooling-Off Parameters
SECONDS_PER_BLOCK = 3
COOLING_OFF_BLOCKS = 24
COOLING_OFF_SECONDS = bigint(COOLING_OFF_BLOCKS * SECONDS_PER_BLOCK)  # 72 seconds
APPEAL_TIMEOUT_SECONDS = bigint(7 * 86400)                             # 7 days bounded appeal timeout
DEFAULT_SHOT_EXPIRY_SECONDS = bigint(86400 * 30)                      # 30 days coverage

# Lifecycle Statuses
STATUS_POLICY_OPEN = u8(0)           # Sponsor deposited fusion shot grant, awaiting pulse diagnostics
STATUS_TELEMETRY_SUBMITTED = u8(1)   # Tokamak facility submitted plasma diagnostics & TLE spectra
STATUS_AWAITING_PAYOUT = u8(2)       # AI Astrodynamics / Fusion Jury rendered verdict, cooling-off active
STATUS_SETTLED_CERTIFIED_FULL = u8(3)# Confirmed Q-net Lawson criterion & stable TBR, 100% grant released
STATUS_SETTLED_PARTIAL = u8(4)       # Partial confinement duration milestone, 40% released
STATUS_SETTLED_REJECTED = u8(5)      # Plasma thermal quench / disruption damage, 100% refunded to sponsor
STATUS_DISPUTED = u8(6)              # Under appellate review with 10% staked bond
STATUS_EXPIRED_RECLAIMED = u8(7)     # Shot window expired without valid diagnostics, reclaimed by sponsor
STATUS_UNRESOLVED = u8(8)            # Diagnostic fetch, parse, or canary failure (protected non-settling state)


class ContractError(Exception):
    """Domain-specific error for AgentFusionPurity protocol."""
    pass


def _to_address(val) -> Address:
    """Converts any Address, int, or str into a valid GenLayer Address instance."""
    if isinstance(val, Address):
        return val
    if isinstance(val, int):
        hex_str = f"0x{val:040x}"
        return Address(hex_str)
    if isinstance(val, str):
        clean = val.strip()
        if clean.startswith("0x") or clean.startswith("0X"):
            return Address(clean.lower())
        try:
            int_val = int(clean)
            return Address(f"0x{int_val:040x}")
        except ValueError:
            return Address(clean.lower())
    if isinstance(val, (bytes, bytearray)):
        return Address("0x" + val.hex())
    return Address(str(val))


def _addr_str(addr) -> str:
    """Safely format an Address or address-like value into a lowercase hex string."""
    if addr is None:
        return ZERO_ADDRESS
    if isinstance(addr, int):
        return f"0x{addr:040x}".lower()
    try:
        return addr.as_hex.lower()
    except Exception:
        return str(addr).lower()


def _get_sender() -> Address:
    """Safely obtain transaction sender across GenVM runtime versions."""
    try:
        raw = gl.message.sender_address
        return _to_address(raw)
    except Exception:
        try:
            raw = gl.message.sender
            return _to_address(raw)
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
    min_confinement_ms: u32        # Minimum required stable energy confinement time in milliseconds (e.g. 500 ms)
    target_q_factor_bps: u32       # Target Q-factor in basis points (e.g., 1000 = Q 1.0 breakeven)
    diagnostic_feed_url: str       # Accredited spectrometry/interferometer telemetry endpoint
    evidence_hash: str             # SHA-256 snapshot of raw shot diagnostics
    status: u8
    verdict: str                   # "PENDING", "FUSION_Q_NET_CERTIFIED", "PARTIAL_CONFINEMENT_MILESTONE", "PLASMA_DISRUPTION_QUENCH", "DISPUTED", "UNRESOLVED_*"
    original_verdict: str          # Preserved pre-appeal verdict
    reason: str
    confidence: u8
    measured_confinement_ms: u32   # Measured stable confinement time in ms
    measured_q_factor_bps: u32     # Measured Q-factor (basis points)
    tbr_ratio_bps: u32             # Tritium Breeding Ratio in basis points (e.g. 108 = 1.08 TBR)
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

    def __init__(self, initial_owner: Address = Address(ZERO_ADDRESS)):
        target_owner = _to_address(initial_owner) if initial_owner is not None else Address(ZERO_ADDRESS)
        if _addr_str(target_owner) == ZERO_ADDRESS:
            try:
                target_owner = _to_address(_get_sender())
            except Exception:
                pass

        self.owner = target_owner
        self.total_fusion_locked = bigint(0)
        self.total_shots_settled = u32(0)
        self.policy_counter = u64(0)
        self.total_pending_claims = bigint(0)

    def _resolve_pid(self, policy_id) -> str:
        return str(policy_id).strip()

    def _ensure_owner(self) -> None:
        if _addr_str(self.owner) == ZERO_ADDRESS:
            self.owner = _to_address(_get_sender())

    def _credit_payout(self, recipient: Address, amount: bigint) -> None:
        """Pure Pull-Payment accounting: guarantees safe escrow disbursement."""
        if amount <= bigint(0):
            return
        rec_str = _addr_str(_to_address(recipient))
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
        """DeepTech sponsor locks research grant for a verifiable high-temperature plasma confinement run."""
        self._ensure_owner()
        escrow = bigint(gl.message.value)
        if escrow <= bigint(0):
            raise ContractError("Fusion grant escrow deposit must be greater than 0 GEN.")

        clean_fac = str(reactor_facility_id).strip().upper()
        if len(clean_fac) < 4:
            raise ContractError("Valid reactor chamber ID required (>= 4 chars).")

        p_addr = _to_address(tokamak_operator)
        if _addr_str(p_addr) == ZERO_ADDRESS:
            raise ContractError("Valid tokamak operator address required.")

        s_addr = _to_address(_get_sender())
        if _addr_str(s_addr) == _addr_str(p_addr):
            raise ContractError("Sponsor cannot designate themselves as tokamak operator.")

        dur_secs = bigint(int(duration_blocks) * 3 if int(duration_blocks) > 0 else int(DEFAULT_SHOT_EXPIRY_SECONDS))

        self.policy_counter = self.policy_counter + u64(1)
        policy_id = str(self.policy_counter)
        current_time = self._get_current_timestamp()
        expires_at = current_time + dur_secs
        empty_addr = Address(ZERO_ADDRESS)

        new_policy = FusionPolicy(
            policy_id=policy_id,
            sponsor=s_addr,
            tokamak_operator=p_addr,
            dispute_initiator=empty_addr,
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
        """Tokamak operator submits telemetry from laser interferometer, bolometers, and neutron detectors."""
        self._ensure_owner()
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
        """AI Plasma Physics Tribunal evaluates Lawson criterion, thermal quench signals, and Tritium breeding."""
        self._ensure_owner()
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

        feed_url = p.diagnostic_feed_url
        facility = p.reactor_facility_id
        target_q = int(p.target_q_factor_bps)
        min_confinement = int(p.min_confinement_ms)

        def leader_fn():
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
2. Extract measured_confinement_ms (duration of steady-state H-mode without major disruption).
3. Extract measured_q_factor_bps (ratio of fusion power out to heating power in, scaled x1000).
4. Extract tbr_ratio_bps (Tritium Breeding Ratio scaled x100, e.g. 1.05 = 105).
5. Detect signs of thermal quench or runaway electron avalanches.
6. Decision Matrix:
   - FUSION_Q_NET_CERTIFIED: Confinement >= {min_confinement} ms AND Q-factor >= {target_q} AND TBR >= 105 with zero major disruption (100% grant released).
   - PARTIAL_CONFINEMENT_MILESTONE: Confinement >= ({min_confinement} // 2) ms BUT Q-factor between ({target_q} // 2) and ({target_q} - 1) (40% milestone released, 60% preserved).
   - PLASMA_DISRUPTION_QUENCH: Thermal quench detected OR Confinement < ({min_confinement} // 2) ms (100% refunded to sponsor).

SECURITY CANARY: Echo "{CANARY_TOKEN}" in JSON.
Respond ONLY with valid JSON without markdown fences:
{{
  "canary": "{CANARY_TOKEN}",
  "verdict": "FUSION_Q_NET_CERTIFIED" | "PARTIAL_CONFINEMENT_MILESTONE" | "PLASMA_DISRUPTION_QUENCH",
  "confidence": <0-100>,
  "reactor_facility_id": "<exact facility string>",
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
            if not isinstance(leader, dict) or "verdict" not in leader:
                return False
            if leader.get("canary") != CANARY_TOKEN:
                return False

            mine = leader_fn()
            if mine.get("canary") != CANARY_TOKEN:
                return False

            # Independent validation of evidence hash agreement
            if str(mine.get("evidence_hash", "")) != str(leader.get("evidence_hash", "")):
                return False

            # Independent validation of facility provenance
            if str(mine.get("reactor_facility_id", "")).strip() != str(leader.get("reactor_facility_id", "")).strip():
                return False

            # Tolerance check on confinement time (<= 25 ms)
            conf_diff = abs(int(mine.get("measured_confinement_ms", 0)) - int(leader.get("measured_confinement_ms", 0)))
            if conf_diff > 25:
                return False

            return mine["verdict"] == leader["verdict"]

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
        meas_conf = int(adjudication_res.get("measured_confinement_ms", 0))
        meas_q = int(adjudication_res.get("measured_q_factor_bps", 0))
        meas_tbr = int(adjudication_res.get("tbr_ratio_bps", 0))

        p.evidence_hash = ev_hash
        p.measured_confinement_ms = u32(max(0, min(100000, meas_conf)))
        p.measured_q_factor_bps = u32(max(0, min(100000, meas_q)))
        p.tbr_ratio_bps = u32(max(0, min(1000, meas_tbr)))
        p.confidence = u8(max(0, min(100, int(adjudication_res.get("confidence", 85)))))

        # Independent on-chain threshold verification
        if fac_extracted and fac_extracted != p.reactor_facility_id:
            p.verdict = "PLASMA_DISRUPTION_QUENCH"
            p.reason = f"Provenance Failure: Telemetry issued for '{fac_extracted}', expected '{p.reactor_facility_id}'."
        elif meas_conf < int(p.min_confinement_ms) // 2:
            p.verdict = "PLASMA_DISRUPTION_QUENCH"
            p.reason = f"Thermal Quench: Confinement time {meas_conf} ms collapsed below critical threshold ({p.min_confinement_ms // 2} ms)."
        elif meas_q >= int(p.target_q_factor_bps) and meas_conf >= int(p.min_confinement_ms) and meas_tbr >= 105:
            p.verdict = "FUSION_Q_NET_CERTIFIED"
            p.reason = f"Lawson Q-Net Breakeven Verified: Q={meas_q / 1000.0:.3f}, Confinement={meas_conf}ms, TBR={meas_tbr / 100.0:.2f}."
        elif meas_conf >= int(p.min_confinement_ms) // 2:
            p.verdict = "PARTIAL_CONFINEMENT_MILESTONE"
            p.reason = f"Partial Confinement: Confinement {meas_conf} ms achieved, but Q-factor {meas_q} bps fell short of net breakeven ({p.target_q_factor_bps} bps)."
        else:
            p.verdict = "PLASMA_DISRUPTION_QUENCH"
            p.reason = "Plasma disruption detected. Magnetic topology unraveled."

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
        """Sponsor or Operator can appeal within 24 blocks (~72s) with a 10% staked bond."""
        self._ensure_owner()
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
        p.dispute_initiator = _to_address(sender)
        p.dispute_bond = staked
        p.dispute_filed_time = current_time
        p.supplemental_evidence_url = clean_url
        p.reason = f"[DISPUTE by {_addr_str(sender)[:8]}]: {clean_reason} | Prior: {p.reason}"
        self.total_fusion_locked = self.total_fusion_locked + staked

    @gl.public.write
    def adjudicate_appeal(self, policy_id: str) -> None:
        """Supreme Fusion Appellate Tribunal evaluates strictly against bound supplemental diagnostic spectra."""
        self._ensure_owner()
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

        bound_url = p.supplemental_evidence_url
        appellant = p.dispute_initiator
        prior_verdict = p.appeal_prior_verdict
        is_sponsor_appellant = (_addr_str(appellant) == _addr_str(p.sponsor))

        def leader_fn():
            raw_supp = ""
            try:
                raw_supp = gl.nondet.web.render(bound_url, mode="text")
            except Exception:
                pass

            if not raw_supp:
                return {
                    "canary": CANARY_TOKEN,
                    "verdict": "APPEAL_UNRESOLVED_FETCH_FAILED",
                    "measured_confinement_ms": 0,
                    "measured_q_factor_bps": 0,
                    "reason": "Supplemental fusion diagnostic report unreachable.",
                    "evidence_hash": "0000000000000000000000000000000000000000000000000000000000000000",
                }

            ev_hash = hashlib.sha256(raw_supp.encode("utf-8")).hexdigest()

            prompt = f"""You are the Supreme Plasma Physics Appellate Magistrate on GenLayer.
Evaluate bound third-party bolometer and Thomson scattering spectra for facility {p.reactor_facility_id}:
PRIOR VERDICT: {prior_verdict}
APPELLANT: {'SPONSOR' if is_sponsor_appellant else 'TOKAMAK_OPERATOR'}

SUPPLEMENTAL AUDIT DATA:
{raw_supp[:4000]}

DECISION CRITERIA:
- If supplemental logs verify full Q-net breakeven (confinement >= {p.min_confinement_ms} ms and Q >= {p.target_q_factor_bps}): Output "APPEAL_UPHELD_CERTIFIED".
- If partial confinement verified without quench: Output "APPEAL_UPHELD_PARTIAL".
- If severe disruption / runaway electrons verified: Output "APPEAL_UPHELD_REJECTED".
- Otherwise: Output "APPEAL_DISMISSED".

SECURITY CANARY: Echo "{CANARY_TOKEN}" in JSON.
Respond ONLY with valid JSON:
{{
  "canary": "{CANARY_TOKEN}",
  "verdict": "APPEAL_UPHELD_CERTIFIED"|"APPEAL_UPHELD_PARTIAL"|"APPEAL_UPHELD_REJECTED"|"APPEAL_DISMISSED",
  "measured_confinement_ms": <integer>,
  "measured_q_factor_bps": <integer>,
  "reason": "<rationale under 200 chars>"
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
                    "measured_confinement_ms": 0,
                    "measured_q_factor_bps": 0,
                    "reason": "Appellate parsing failure.",
                    "evidence_hash": ev_hash
                }

            v_str = str(parsed.get("verdict", "")).upper().strip()
            if v_str not in {"APPEAL_UPHELD_CERTIFIED", "APPEAL_UPHELD_PARTIAL", "APPEAL_UPHELD_REJECTED", "APPEAL_DISMISSED"}:
                v_str = "APPEAL_UNRESOLVED_PARSE_FAILED"

            return {
                "canary": CANARY_TOKEN,
                "verdict": v_str,
                "measured_confinement_ms": max(0, min(100000, int(parsed.get("measured_confinement_ms", 0)))),
                "measured_q_factor_bps": max(0, min(100000, int(parsed.get("measured_q_factor_bps", 0)))),
                "reason": str(parsed.get("reason", "Appellate review completed."))[:200],
                "evidence_hash": ev_hash,
            }

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader = leader_res.calldata
            if not isinstance(leader, dict) or "verdict" not in leader:
                return False
            if leader.get("canary") != CANARY_TOKEN:
                return False

            mine = leader_fn()
            if mine.get("canary") != CANARY_TOKEN:
                return False

            if str(mine.get("evidence_hash", "")) != str(leader.get("evidence_hash", "")):
                return False

            conf_diff = abs(int(mine.get("measured_confinement_ms", 0)) - int(leader.get("measured_confinement_ms", 0)))
            if conf_diff > 25:
                return False

            return mine["verdict"] == leader["verdict"]

        appeal_res = gl.vm.run_nondet(leader_fn, validator_fn)
        app_verdict = appeal_res["verdict"]
        app_reason = appeal_res["reason"]

        if app_verdict.startswith("APPEAL_UNRESOLVED_"):
            p.status = STATUS_UNRESOLVED
            p.verdict = app_verdict
            p.reason = f"[APPEAL UNRESOLVED] {app_reason}"
            return

        escrow_val = p.escrow_amount
        bond_val = p.dispute_bond
        total_settling = escrow_val + bond_val
        p.dispute_bond = bigint(0)
        p.escrow_amount = bigint(0)  # Double-payout protection

        self.total_fusion_locked = self.total_fusion_locked - total_settling
        self.total_shots_settled = self.total_shots_settled + u32(1)

        counterparty = p.tokamak_operator if is_sponsor_appellant else p.sponsor

        if app_verdict == "APPEAL_UPHELD_CERTIFIED":
            p.status = STATUS_SETTLED_CERTIFIED_FULL
            p.verdict = "FUSION_Q_NET_CERTIFIED"
            p.reason = f"[APPEAL UPHELD] {app_reason}"
            self._credit_payout(p.tokamak_operator, escrow_val)
            if not is_sponsor_appellant:
                self._credit_payout(appellant, bond_val)
            else:
                self._credit_payout(counterparty, bond_val)

        elif app_verdict == "APPEAL_UPHELD_PARTIAL":
            p.status = STATUS_SETTLED_PARTIAL
            p.verdict = "PARTIAL_CONFINEMENT_MILESTONE"
            payout = (escrow_val * bigint(40)) // bigint(100)
            refund = escrow_val - payout
            p.reason = f"[APPEAL RESOLUTION] {app_reason}"
            self._credit_payout(p.tokamak_operator, payout)
            self._credit_payout(p.sponsor, refund)
            self._credit_payout(appellant, bond_val)

        elif app_verdict == "APPEAL_UPHELD_REJECTED":
            p.status = STATUS_SETTLED_REJECTED
            p.verdict = "PLASMA_DISRUPTION_QUENCH"
            p.reason = f"[APPEAL RESOLUTION] {app_reason}"
            self._credit_payout(p.sponsor, escrow_val)
            if is_sponsor_appellant:
                self._credit_payout(appellant, bond_val)
            else:
                self._credit_payout(counterparty, bond_val)

        else:
            # APPEAL_DISMISSED: Forfeit bond to counterparty
            p.reason = f"[APPEAL DISMISSED] {app_reason}"
            self._credit_payout(counterparty, bond_val)

            if p.original_verdict == "FUSION_Q_NET_CERTIFIED":
                p.status = STATUS_SETTLED_CERTIFIED_FULL
                p.verdict = "FUSION_Q_NET_CERTIFIED"
                self._credit_payout(p.tokamak_operator, escrow_val)
            elif p.original_verdict == "PARTIAL_CONFINEMENT_MILESTONE":
                p.status = STATUS_SETTLED_PARTIAL
                p.verdict = "PARTIAL_CONFINEMENT_MILESTONE"
                payout = (escrow_val * bigint(40)) // bigint(100)
                refund = escrow_val - payout
                self._credit_payout(p.tokamak_operator, payout)
                self._credit_payout(p.sponsor, refund)
            else:
                p.status = STATUS_SETTLED_REJECTED
                p.verdict = "PLASMA_DISRUPTION_QUENCH"
                self._credit_payout(p.sponsor, escrow_val)

    @gl.public.write
    def resolve_stale_appeal(self, policy_id: str) -> None:
        """
        Role: Bounded recovery for unresolved or timed-out fusion appeals.
        Safeguards both the experimental escrow and dispute bond:
        1. Refunds 100% of the dispute bond back to the appellant.
        2. Restores policy to pre-appeal verdict and resets cooling-off window.
        """
        self._ensure_owner()
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

        # 1. Safely refund 100% of dispute bond to appellant via Pull-Payment ledger
        self._credit_payout(p.dispute_initiator, bond_val)

        # 2. Restore policy to prior pre-appeal verdict
        p.verdict = p.appeal_prior_verdict if p.appeal_prior_verdict and p.appeal_prior_verdict != "PENDING" else "PLASMA_DISRUPTION_QUENCH"
        p.status = STATUS_AWAITING_PAYOUT
        p.audit_completed_time = current_time
        p.reason = f"[APPEAL TIMEOUT RECOVERY]: Supplemental telemetry timed out or unreachable. 100% dispute bond ({bond_val} wei) refunded to appellant. Policy restored to prior verdict '{p.verdict}'."

    @gl.public.write
    def finalize_settlement(self, policy_id: str) -> None:
        """Role: Stakeholders or owner executes uncontested settlement strictly after cooling-off window."""
        self._ensure_owner()
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
        p.escrow_amount = bigint(0)  # Double-payout protection
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
        """Role: Only sponsor fund can reclaim escrow if coverage expired without diagnostics or stalled."""
        self._ensure_owner()
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
        """Pull-Payment claim: Safely withdraw accrued beneficiary credits with verified delivery accounting."""
        self._ensure_owner()
        sender = _get_sender()
        s_str = _addr_str(sender)
        bal = self.claimable_balances.get(s_str, bigint(0))
        if bal <= bigint(0):
            raise ContractError("No claimable balance available for withdrawal.")

        try:
            gl.get_contract_at(sender).emit_transfer(value=u256(int(bal)))
        except Exception as e:
            raise ContractError(f"Outbound transfer failed during claim: {str(e)}. Balance preserved.")

        # Successfully delivered: clear claimable and credit withdrawn ledger
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
    def get_user_role(self, policy_id: str, account: Address) -> str:
        pid = self._resolve_pid(policy_id)
        acc_str = _addr_str(account)
        if pid not in self.policies:
            if acc_str == _addr_str(self.owner):
                return "OWNER"
            return "OBSERVER"

        p = self.policies[pid]
        if acc_str == _addr_str(p.sponsor):
            return "SPONSOR"
        if acc_str == _addr_str(p.tokamak_operator):
            return "TOKAMAK_OPERATOR"
        if acc_str == _addr_str(p.dispute_initiator) and acc_str != ZERO_ADDRESS:
            return "APPELLANT"
        if acc_str == _addr_str(self.owner):
            return "OWNER"
        return "OBSERVER"

    @gl.public.view
    def get_remaining_cooling_off_seconds(self, policy_id: str) -> u64:
        """Returns remaining cooling off challenge window in seconds (0 if expired or not in cooling off)."""
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
    def get_total_withdrawn(self, account: Address) -> str:
        return str(self.total_withdrawn_ledger.get(_addr_str(account), bigint(0)))

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
