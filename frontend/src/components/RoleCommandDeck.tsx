import React, { useState } from 'react';
import {
  ShieldAlert,
  Flame,
  Activity,
  Cpu,
  Scale,
  Clock,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  Zap,
} from 'lucide-react';
import {
  FusionPolicyData,
  encodeCalldata,
  waitForTransactionReceipt,
  getSavedContractAddress,
} from '../config/genlayer';
import { formatGen, formatTimestamp, formatConfinement, formatQFactor } from '../utils/formatters';

interface RoleCommandDeckProps {
  policies: FusionPolicyData[];
  selectedPolicy: FusionPolicyData | null;
  account: string;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onOpenSubmitTelemetry: (p: FusionPolicyData) => void;
  onOpenAppeal: (p: FusionPolicyData) => void;
  onInspectSpectrometry: (p: FusionPolicyData) => void;
}

export const RoleCommandDeck: React.FC<RoleCommandDeckProps> = ({
  policies,
  selectedPolicy,
  account,
  onRefresh,
  onOpenCreate,
  onOpenSubmitTelemetry,
  onOpenAppeal,
  onInspectSpectrometry,
}) => {
  const [activeTab, setActiveTab] = useState<'SPONSOR' | 'OPERATOR' | 'APPELLATE'>('OPERATOR');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  const policy = selectedPolicy || policies[0] || null;

  const executeTx = async (method: string, args: any[], actionKey: string) => {
    setFeedbackMsg(null);
    if (!account) {
      setFeedbackMsg({ type: 'error', text: 'Please connect your Web3 wallet first.' });
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
      setFeedbackMsg({ type: 'success', text: `Successfully executed ${method}!` });
      onRefresh();
    } catch (err: any) {
      console.error(`Error executing ${method}:`, err);
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Transaction rejected or execution failed.',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-3xl bg-[#0D081B] border border-[#2A1B4E] p-6 shadow-2xl relative overflow-hidden">
      {/* Deck Header Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-[#1F133A] pb-4">
        <div>
          <h2 className="text-xl font-bold font-space text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            SCADA Role Operations Console
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Execute on-chain smart contract functions according to participant permissions
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-[#04030A] p-1.5 rounded-2xl border border-[#2A1B4E] font-mono text-xs">
          <button
            onClick={() => setActiveTab('SPONSOR')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'SPONSOR'
                ? 'bg-gradient-to-r from-amber-500 to-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Sponsor Vault
          </button>

          <button
            onClick={() => setActiveTab('OPERATOR')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'OPERATOR'
                ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Tokamak Operator
          </button>

          <button
            onClick={() => setActiveTab('APPELLATE')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
              activeTab === 'APPELLATE'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Appellate Court
          </button>
        </div>
      </div>

      {/* Selected Policy Context Banner */}
      {policy ? (
        <div className="p-4 rounded-2xl bg-[#04030A] border border-[#2A1B4E] mb-6 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white font-space">
              Target Policy #{policy.policy_id}
            </span>
            <span className="px-2 py-0.5 rounded bg-[#0D081B] text-cyan-400 border border-cyan-500/30">
              {policy.reactor_facility_id}
            </span>
            <span className="text-slate-400">
              Escrow: <strong className="text-white">{formatGen(policy.escrow_amount)} GEN</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onInspectSpectrometry(policy)}
              className="px-3 py-1.5 rounded-xl bg-[#0D081B] border border-[#2A1B4E] hover:border-cyan-500 text-cyan-400 transition flex items-center gap-1 text-[11px]"
            >
              <Cpu className="w-3 h-3" /> Inspect Telemetry
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-[#04030A] border border-[#2A1B4E] mb-6 text-center text-xs font-mono text-slate-400">
          No active pulse policies selected. Create an escrow below.
        </div>
      )}

      {/* Terminal Content based on activeTab */}
      {activeTab === 'SPONSOR' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#060310] border border-[#2A1B4E]">
              <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold font-space text-sm">
                <Flame className="w-4 h-4" />
                Initialize DeepTech Shot Escrow
              </div>
              <p className="text-xs text-slate-400 font-mono mb-4 leading-relaxed">
                Deposit and lock GEN research grants to back a verified high-temperature plasma confinement run. Funds are disbursed strictly upon Lawson net-energy certification.
              </p>
              <button
                onClick={onOpenCreate}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-fuchsia-600 to-violet-600 hover:from-amber-400 hover:to-violet-500 text-white font-space font-bold text-xs tracking-wide shadow-lg transition flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4 text-amber-200" />
                Open Grant Deployment Modal
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-[#060310] border border-[#2A1B4E]">
              <div className="flex items-center gap-2 mb-2 text-slate-300 font-bold font-space text-sm">
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                Reclaim Expired Escrow
              </div>
              <p className="text-xs text-slate-400 font-mono mb-4 leading-relaxed">
                If the test duration concludes without valid diagnostic telemetry from the operator, the sponsor can safely reclaim 100% of the locked escrow.
              </p>
              <button
                onClick={() => policy && executeTx('cancel_or_reclaim', [policy.policy_id], 'reclaim')}
                disabled={!policy || policy.status !== 0 || loadingAction === 'reclaim'}
                className="w-full py-3 rounded-xl bg-[#04030A] border border-[#2A1B4E] hover:border-cyan-500 text-slate-300 hover:text-white font-space font-bold text-xs tracking-wide transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loadingAction === 'reclaim' ? 'Reclaiming...' : 'Reclaim Expired Escrow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'OPERATOR' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1: Submit Diagnostics */}
            <div className="p-4 rounded-2xl bg-[#060310] border border-[#2A1B4E] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block mb-1">
                  Step 1 &middot; Diagnostics
                </span>
                <h4 className="text-sm font-bold font-space text-white mb-1.5 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-cyan-400" />
                  Submit Shot Telemetry
                </h4>
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed mb-3">
                  Upload accredited spectrometry, laser interferometer, and neutron detector feeds (IAEA/ITER).
                </p>
              </div>
              <button
                onClick={() => policy && onOpenSubmitTelemetry(policy)}
                disabled={!policy || (policy.status !== 0 && policy.status !== 8)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-space font-bold text-xs shadow-md transition disabled:opacity-40"
              >
                Submit Diagnostics
              </button>
            </div>

            {/* Action 2: Trigger AI Tribunal */}
            <div className="p-4 rounded-2xl bg-[#060310] border border-[#2A1B4E] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-violet-400 uppercase tracking-wider block mb-1">
                  Step 2 &middot; Verification
                </span>
                <h4 className="text-sm font-bold font-space text-white mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-violet-400" />
                  Trigger AI Adjudication
                </h4>
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed mb-3">
                  GenLayer AI Jury digests telemetry via non-deterministic web rendering and multi-validator consensus.
                </p>
              </div>
              <button
                onClick={() => policy && executeTx('adjudicate_plasma_shot', [policy.policy_id], 'adjudicate')}
                disabled={!policy || (policy.status !== 1 && policy.status !== 8) || loadingAction === 'adjudicate'}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-space font-bold text-xs shadow-md transition disabled:opacity-40"
              >
                {loadingAction === 'adjudicate' ? 'Consensus Running...' : 'Adjudicate Plasma Shot'}
              </button>
            </div>

            {/* Action 3: Finalize Settlement */}
            <div className="p-4 rounded-2xl bg-[#060310] border border-[#2A1B4E] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block mb-1">
                  Step 3 &middot; Disbursement
                </span>
                <h4 className="text-sm font-bold font-space text-white mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Finalize Settlement
                </h4>
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed mb-3">
                  Execute uncontested payout strictly after the 24-block (~72s) challenge cooling-off window.
                </p>
              </div>
              <button
                onClick={() => policy && executeTx('finalize_settlement', [policy.policy_id], 'finalize')}
                disabled={!policy || policy.status !== 2 || loadingAction === 'finalize'}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-space font-bold text-xs shadow-md transition disabled:opacity-40"
              >
                {loadingAction === 'finalize' ? 'Finalizing...' : 'Finalize Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'APPELLATE' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Appeal 1: File Dispute */}
            <div className="p-4 rounded-2xl bg-[#060310] border border-[#2A1B4E] flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold font-space text-white mb-1 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-fuchsia-400" />
                  Stake Bond &amp; Dispute
                </h4>
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed mb-3">
                  Challenge initial verdict within 24 blocks (~72s) by staking a 10% bond with supplemental audit logs.
                </p>
              </div>
              <button
                onClick={() => policy && onOpenAppeal(policy)}
                disabled={!policy || policy.status !== 2}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-space font-bold text-xs shadow-md transition disabled:opacity-40"
              >
                File Appellate Challenge
              </button>
            </div>

            {/* Appeal 2: Adjudicate Appeal */}
            <div className="p-4 rounded-2xl bg-[#060310] border border-[#2A1B4E] flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold font-space text-white mb-1 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-violet-400" />
                  Adjudicate Appeal
                </h4>
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed mb-3">
                  Supreme Fusion Appellate Tribunal evaluates bound third-party bolometer and Thomson scattering spectra.
                </p>
              </div>
              <button
                onClick={() => policy && executeTx('adjudicate_appeal', [policy.policy_id], 'adjudicate_appeal')}
                disabled={!policy || policy.status !== 6 || loadingAction === 'adjudicate_appeal'}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-space font-bold text-xs shadow-md transition disabled:opacity-40"
              >
                {loadingAction === 'adjudicate_appeal' ? 'Appellate Consensus...' : 'Adjudicate Appeal'}
              </button>
            </div>

            {/* Appeal 3: Recover Stale Appeal */}
            <div className="p-4 rounded-2xl bg-[#060310] border border-[#2A1B4E] flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold font-space text-white mb-1 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  Recover Stale Appeal
                </h4>
                <p className="text-[11px] text-slate-400 font-mono leading-relaxed mb-3">
                  If an appeal times out (7 days) or errors, safely refunds 100% of the dispute bond back to the appellant.
                </p>
              </div>
              <button
                onClick={() => policy && executeTx('resolve_stale_appeal', [policy.policy_id], 'resolve_stale')}
                disabled={!policy || (policy.status !== 6 && policy.status !== 8) || loadingAction === 'resolve_stale'}
                className="w-full py-2.5 rounded-xl bg-[#04030A] border border-[#2A1B4E] hover:border-amber-500 text-amber-300 font-space font-bold text-xs shadow-md transition disabled:opacity-40"
              >
                {loadingAction === 'resolve_stale' ? 'Recovering...' : 'Recover 100% Bond'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`mt-4 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
            feedbackMsg.type === 'error'
              ? 'bg-red-950/40 border-red-500/40 text-red-300'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
          }`}
        >
          {feedbackMsg.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}
    </div>
  );
};
