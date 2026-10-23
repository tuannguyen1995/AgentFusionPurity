import React, { useState, useEffect } from 'react';
import {
  Flame,
  Activity,
  Cpu,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Scale,
  Send,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  FusionPolicyData,
  encodeCalldata,
  waitForTransactionReceipt,
  getSavedContractAddress,
  fetchUserRole,
  fetchRemainingCoolingOff,
} from '../config/genlayer';
import {
  formatGen,
  formatAddress,
  formatTimestamp,
  formatQFactor,
  formatTBR,
  formatConfinement,
  getStatusLabel,
} from '../utils/formatters';

interface PolicyCardProps {
  policy: FusionPolicyData;
  account: string;
  onRefresh: () => void;
  onSubmitTelemetry: (p: FusionPolicyData) => void;
  onInspectSpectrometry: (p: FusionPolicyData) => void;
  onAppeal: (p: FusionPolicyData) => void;
}

export const PolicyCard: React.FC<PolicyCardProps> = ({
  policy,
  account,
  onRefresh,
  onSubmitTelemetry,
  onInspectSpectrometry,
  onAppeal,
}) => {
  const [userRole, setUserRole] = useState<string>('OBSERVER');
  const [coolingSeconds, setCoolingSeconds] = useState<number>(0);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const statusStyle = getStatusLabel(policy.status);

  // Fetch role and cooling-off timer
  useEffect(() => {
    let mounted = true;
    const fetchMeta = async () => {
      if (account) {
        const role = await fetchUserRole(policy.policy_id, account);
        if (mounted) setUserRole(role);
      }
      if (policy.status === 2) {
        const rem = await fetchRemainingCoolingOff(policy.policy_id);
        if (mounted) setCoolingSeconds(rem);
      }
    };
    fetchMeta();

    const timer = setInterval(() => {
      setCoolingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [policy, account]);

  const executeTx = async (method: string, args: any[], actionKey: string) => {
    setErrorMsg(null);
    if (!account) {
      setErrorMsg('Please connect your Web3 wallet first.');
      return;
    }
    try {
      setLoadingAction(actionKey);
      const contractAddress = getSavedContractAddress();
      const calldata = encodeCalldata(method, args);

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: contractAddress,
            data: calldata,
          },
        ],
      });

      console.log(`Submitted ${method} tx:`, txHash);
      await waitForTransactionReceipt(txHash);
      onRefresh();
    } catch (err: any) {
      console.error(`Error executing ${method}:`, err);
      setErrorMsg(err?.message || 'Transaction rejected or execution failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAdjudicatePlasmaShot = () => {
    executeTx('adjudicate_plasma_shot', [policy.policy_id], 'adjudicate');
  };

  const handleFinalizeSettlement = () => {
    executeTx('finalize_settlement', [policy.policy_id], 'finalize');
  };

  const handleAdjudicateAppeal = () => {
    executeTx('adjudicate_appeal', [policy.policy_id], 'adjudicate_appeal');
  };

  const handleResolveStaleAppeal = () => {
    executeTx('resolve_stale_appeal', [policy.policy_id], 'resolve_stale');
  };

  const handleCancelOrReclaim = () => {
    executeTx('cancel_or_reclaim', [policy.policy_id], 'reclaim');
  };

  const isOperator = userRole === 'TOKAMAK_OPERATOR';
  const isSponsor = userRole === 'SPONSOR';
  const isOwner = userRole === 'OWNER';
  const isParticipant = isOperator || isSponsor || isOwner;

  return (
    <div className="rounded-3xl bg-[#0D081B] border border-[#2A1B4E] hover:border-[#3D2870] transition-all p-6 shadow-xl flex flex-col justify-between relative overflow-hidden group">
      {/* Top Background Glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition" />

      {/* Header Info */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-space font-extrabold text-xl text-white">
                #{policy.policy_id}
              </span>
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-[#04030A] border border-[#2A1B4E] text-cyan-300">
                {policy.reactor_facility_id}
              </span>
              {userRole !== 'OBSERVER' && (
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-500/40">
                  {userRole}
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-1">
              Created: {formatTimestamp(policy.created_at_time)}
            </p>
          </div>

          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} ${statusStyle.glow}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {statusStyle.label}
            </span>
          </div>
        </div>

        {/* Stake and Escrow Figures */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#04030A] border border-[#2A1B4E] mb-4 font-mono">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Research Escrow</div>
            <div className="text-base font-bold text-white flex items-baseline gap-1 mt-0.5">
              {formatGen(policy.escrow_amount)} <span className="text-[10px] text-cyan-400">GEN</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Dispute Staked Bond</div>
            <div className="text-base font-bold text-fuchsia-400 flex items-baseline gap-1 mt-0.5">
              {formatGen(policy.dispute_bond)} <span className="text-[10px] text-slate-400">GEN</span>
            </div>
          </div>
        </div>

        {/* Physical Plasma & Lawson Gauges */}
        <div className="space-y-2 mb-4 font-mono text-xs">
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#080414] border border-[#1F133A]">
            <span className="text-slate-400">Confinement &tau;<sub>E</sub>:</span>
            <div className="text-right">
              <span className="text-white font-bold">
                {formatConfinement(policy.measured_confinement_ms)}
              </span>{' '}
              <span className="text-[10px] text-slate-500">
                (Req: &ge;{policy.min_confinement_ms}ms)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-[#080414] border border-[#1F133A]">
            <span className="text-slate-400">Net Energy Q:</span>
            <div className="text-right">
              <span className="text-emerald-400 font-bold">
                {formatQFactor(policy.measured_q_factor_bps)}
              </span>{' '}
              <span className="text-[10px] text-slate-500">
                (Req: &ge;{formatQFactor(policy.target_q_factor_bps)})
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-[#080414] border border-[#1F133A]">
            <span className="text-slate-400">Tritium Breeding (TBR):</span>
            <span className="text-cyan-400 font-bold">
              {formatTBR(policy.tbr_ratio_bps)}
            </span>
          </div>
        </div>

        {/* Participants Address Strip */}
        <div className="space-y-1 font-mono text-[11px] text-slate-400 mb-4 border-t border-[#1F133A] pt-3">
          <div className="flex items-center justify-between">
            <span>Sponsor:</span>
            <span className="text-slate-300">{formatAddress(policy.sponsor)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Operator:</span>
            <span className="text-cyan-400">{formatAddress(policy.tokamak_operator)}</span>
          </div>
          {policy.dispute_initiator && policy.dispute_initiator !== '0x0000000000000000000000000000000000000000' && (
            <div className="flex items-center justify-between text-fuchsia-400">
              <span>Appellant:</span>
              <span>{formatAddress(policy.dispute_initiator)}</span>
            </div>
          )}
        </div>

        {/* Reason / Verdict snippet */}
        {policy.reason && (
          <div className="p-3 rounded-xl bg-[#04030A] border border-[#2A1B4E] text-slate-300 font-mono text-xs mb-4 line-clamp-2">
            &ldquo;{policy.reason}&rdquo;
          </div>
        )}

        {/* Cooling-off Countdown Badge */}
        {policy.status === 2 && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 font-mono text-xs mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Cooling-Off Window:
            </span>
            <span className="font-bold text-white">
              {coolingSeconds > 0 ? `${coolingSeconds}s remaining` : 'Ready to Finalize'}
            </span>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 font-mono text-xs mb-4">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Action Buttons Toolbar */}
      <div className="space-y-2 pt-2 border-t border-[#1F133A]">
        {/* Step 1: Submit Telemetry (Operator only, status 0 or 8) */}
        {(policy.status === 0 || policy.status === 8) && (
          <button
            onClick={() => onSubmitTelemetry(policy)}
            disabled={!isOperator && !isOwner}
            className={`w-full py-2.5 rounded-xl font-space font-bold text-xs tracking-wide transition flex items-center justify-center gap-2 ${
              isOperator || isOwner
                ? 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {isOperator || isOwner ? 'Submit Shot Telemetry' : 'Awaiting Tokamak Operator Telemetry'}
          </button>
        )}

        {/* Step 2: Trigger AI Tribunal Adjudication (Status 1 or 8) */}
        {(policy.status === 1 || policy.status === 8) && (
          <button
            onClick={handleAdjudicatePlasmaShot}
            disabled={!isParticipant || loadingAction === 'adjudicate'}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-space font-bold text-xs tracking-wide shadow-lg shadow-violet-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadingAction === 'adjudicate' ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI Tribunal Consensus Running...
              </>
            ) : (
              <>
                <Cpu className="w-3.5 h-3.5 text-cyan-200" />
                Adjudicate Plasma Shot (AI Jury)
              </>
            )}
          </button>
        )}

        {/* Step 3: Status 2 (Awaiting Payout) - Appeal or Finalize */}
        {policy.status === 2 && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAppeal(policy)}
              disabled={coolingSeconds <= 0}
              className={`py-2 rounded-xl font-space font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                coolingSeconds > 0
                  ? 'bg-fuchsia-950/60 border border-fuchsia-500/50 text-fuchsia-300 hover:bg-fuchsia-900/60'
                  : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Scale className="w-3.5 h-3.5" /> Appeal (10% Bond)
            </button>

            <button
              onClick={handleFinalizeSettlement}
              disabled={coolingSeconds > 0 || loadingAction === 'finalize'}
              className={`py-2 rounded-xl font-space font-bold text-xs transition flex items-center justify-center gap-1.5 ${
                coolingSeconds <= 0
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              {loadingAction === 'finalize' ? (
                'Finalizing...'
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Payout
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 4: Status 6 (Disputed) - Adjudicate Appeal or Resolve Stale */}
        {policy.status === 6 && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleAdjudicateAppeal}
              disabled={!isParticipant || loadingAction === 'adjudicate_appeal'}
              className="py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white font-space font-bold text-xs transition flex items-center justify-center gap-1.5"
            >
              {loadingAction === 'adjudicate_appeal' ? 'Appellate Jury...' : 'Adjudicate Appeal'}
            </button>

            <button
              onClick={handleResolveStaleAppeal}
              disabled={!isParticipant || loadingAction === 'resolve_stale'}
              className="py-2 rounded-xl bg-[#04030A] border border-[#2A1B4E] hover:border-amber-500 text-amber-300 font-space font-bold text-xs transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Recover Bond
            </button>
          </div>
        )}

        {/* Expired reclaim (Status 0 and expired) */}
        {policy.status === 0 && (
          <button
            onClick={handleCancelOrReclaim}
            disabled={!isSponsor && !isOwner}
            className="w-full py-1.5 rounded-lg bg-[#04030A] border border-[#2A1B4E] text-slate-400 hover:text-white font-mono text-[11px] transition"
          >
            Reclaim Expired Escrow
          </button>
        )}

        {/* Spectrometry Inspector Trigger */}
        <button
          onClick={() => onInspectSpectrometry(policy)}
          className="w-full py-2 rounded-xl bg-[#04030A] hover:bg-[#120B24] border border-[#2A1B4E] text-cyan-400 hover:text-cyan-300 font-mono text-xs transition flex items-center justify-center gap-1.5"
        >
          <Cpu className="w-3.5 h-3.5" />
          Inspect AI Spectrometry Analysis
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
