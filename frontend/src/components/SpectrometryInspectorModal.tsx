import React, { useState } from 'react';
import { X, ShieldCheck, Hash, ExternalLink, Cpu, Check, Copy, Flame, Award, AlertTriangle } from 'lucide-react';
import { FusionPolicyData, STUDIO_URL, getSavedContractAddress } from '../config/genlayer';
import { formatQFactor, formatTBR, formatConfinement, formatTimestamp, getStatusLabel } from '../utils/formatters';

interface SpectrometryInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: FusionPolicyData;
}

export const SpectrometryInspectorModal: React.FC<SpectrometryInspectorModalProps> = ({
  isOpen,
  onClose,
  policy,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  if (!isOpen) return null;

  const statusStyle = getStatusLabel(policy.status);

  const handleCopyHash = () => {
    if (policy.evidence_hash) {
      navigator.clipboard.writeText(policy.evidence_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0D081B] border border-[#3D2870] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-[#04030A] border border-[#2A1B4E] text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-fuchsia-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
            <Cpu className="w-6 h-6 text-cyan-200" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-space text-white">AI Fusion Tribunal Inspector</h3>
            <p className="text-xs text-slate-400 font-mono">
              Diagnostic Spectrometry &amp; Lawson Consensus Analysis
            </p>
          </div>
        </div>

        {/* Verdict Badge Bar */}
        <div className={`p-4 rounded-2xl border mb-6 ${statusStyle.bg} ${statusStyle.border} ${statusStyle.glow}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
              Consensus Adjudication Verdict
            </span>
            <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
              {statusStyle.label}
            </span>
          </div>
          <div className="text-sm font-mono text-white mt-2 leading-relaxed">
            &ldquo;{policy.reason}&rdquo;
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400 border-t border-white/10 pt-2">
            <span>Confidence: <strong className="text-cyan-400">{policy.confidence}%</strong></span>
            <span>Audited At: <strong className="text-slate-300">{formatTimestamp(policy.audit_completed_time)}</strong></span>
          </div>
        </div>

        {/* Measured Physical Plasma Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="text-[11px] font-mono text-slate-400 mb-1">Stable Confinement</div>
            <div className="text-lg font-bold font-mono text-cyan-400">
              {formatConfinement(policy.measured_confinement_ms)}
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              Target &ge; {policy.min_confinement_ms} ms
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="text-[11px] font-mono text-slate-400 mb-1">Q-Factor Breakeven</div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {formatQFactor(policy.measured_q_factor_bps)}
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              Target &ge; {formatQFactor(policy.target_q_factor_bps)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="text-[11px] font-mono text-slate-400 mb-1">Tritium Breeding</div>
            <div className="text-lg font-bold font-mono text-fuchsia-400">
              {formatTBR(policy.tbr_ratio_bps)}
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              Self-sustaining &ge; 1.05
            </div>
          </div>
        </div>

        {/* Evidence Hash Snapshot */}
        <div className="p-4 rounded-2xl bg-[#04030A] border border-[#2A1B4E] mb-6 font-mono text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Hash className="w-3.5 h-3.5 text-cyan-400" /> SHA-256 Telemetry Hash Digest
            </span>
            {policy.evidence_hash && policy.evidence_hash.length > 10 && (
              <button
                onClick={handleCopyHash}
                className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedHash ? 'Copied' : 'Copy Hash'}
              </button>
            )}
          </div>
          <div className="p-2.5 bg-[#080514] rounded-xl border border-[#1E1338] text-slate-300 break-all text-[11px] select-all">
            {policy.evidence_hash || 'No hash recorded yet.'}
          </div>
        </div>

        {/* Diagnostic Links & Verification Sources */}
        <div className="space-y-2.5 font-mono text-xs">
          {policy.diagnostic_feed_url && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
              <span className="text-slate-400 truncate max-w-[280px] sm:max-w-md">
                Telemetry: {policy.diagnostic_feed_url}
              </span>
              <a
                href={policy.diagnostic_feed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1 flex-shrink-0"
              >
                Open Feed <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <span className="text-slate-400">
              On-Chain Contract: {getSavedContractAddress().slice(0, 10)}...
            </span>
            <a
              href={`${STUDIO_URL}/address/${getSavedContractAddress()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:underline flex items-center gap-1"
            >
              GenLayer Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
