import React, { useState } from 'react';
import { X, ShieldAlert, AlertCircle, Scale, Sparkles } from 'lucide-react';
import { encodeCalldata, waitForTransactionReceipt, getSavedContractAddress, FusionPolicyData } from '../config/genlayer';
import { formatGen } from '../utils/formatters';

interface AppealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  policy: FusionPolicyData;
  account: string;
}

const PRESET_AUDITS = [
  {
    name: 'Fusion Energy Sciences Verified Bolometer Calibration',
    url: 'https://fusionenergysciences.org/audits/sparc_02_verified.json',
  },
  {
    name: 'US Department of Energy (DOE) Plasma Recalibration',
    url: 'https://energy.gov/fusion/audit_mpex.json',
  },
  {
    name: 'IAEA Nuclear Fusion Appellate Spectrum Re-inspection',
    url: 'https://iaea.org/audits/recalibrated_spectrometry.json',
  },
];

export const AppealModal: React.FC<AppealModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  policy,
  account,
}) => {
  const [reason, setReason] = useState(
    'Recalibrated Thomson scattering and bolometer diagnostics confirm steady-state H-mode without major disruption.'
  );
  const [auditUrl, setAuditUrl] = useState(
    'https://fusionenergysciences.org/audits/sparc_02_verified.json'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate 10% dispute bond
  const escrowBig = BigInt(policy.escrow_amount || '0');
  const bondBig = (escrowBig * 10n) / 100n || 1n;
  const bondGen = formatGen(bondBig);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!account) {
      setError('Please connect your Web3 wallet first.');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Detailed dispute justification (>= 10 characters) is required.');
      return;
    }

    if (!auditUrl.trim().startsWith('http')) {
      setError('Valid accredited supplemental audit URL required.');
      return;
    }

    try {
      setLoading(true);
      const contractAddress = getSavedContractAddress();

      const calldata = encodeCalldata('appeal_verdict', [
        policy.policy_id,
        reason.trim(),
        auditUrl.trim(),
      ]);

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: contractAddress,
            data: calldata,
            value: `0x${bondBig.toString(16)}`,
          },
        ],
      });

      console.log('Submitted appeal_verdict tx:', txHash);
      await waitForTransactionReceipt(txHash);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error filing appeal:', err);
      setError(err?.message || 'Transaction failed or was rejected by user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0D081B] border border-[#3D2870] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-[#04030A] border border-[#2A1B4E] text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/30">
            <Scale className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-space text-white">Appellate Dispute Challenge</h3>
            <p className="text-xs text-slate-400 font-mono">
              Policy #{policy.policy_id} &middot; 24-Block Cooling-Off Window
            </p>
          </div>
        </div>

        {/* Bond Requirement Info */}
        <div className="p-4 rounded-2xl bg-fuchsia-950/30 border border-fuchsia-500/30 mb-5 font-mono text-xs">
          <div className="flex items-center justify-between text-fuchsia-300 font-semibold mb-1">
            <span>Staked Appellate Bond Required (10%):</span>
            <span className="text-sm font-bold text-white">{bondGen} GEN</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mt-2">
            Filing an appeal pauses disbursement and escalates evidence to the Supreme Plasma Physics Tribunal.
            If upheld, 100% of the bond is returned to the appellant. If dismissed, the bond is forfeited to the counterparty.
          </p>
        </div>

        {/* Preset Audit Sources */}
        <div className="mb-4">
          <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Accredited Supplemental Audits
          </label>
          <div className="space-y-1.5">
            {PRESET_AUDITS.map((audit, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setAuditUrl(audit.url)}
                className={`w-full p-2.5 rounded-xl text-left border transition text-xs font-mono ${
                  auditUrl === audit.url
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
                    : 'bg-[#04030A] border-[#2A1B4E] text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-white truncate">{audit.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{audit.url}</div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Dispute Justification &amp; Technical Grounds (&ge; 10 chars)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-white font-mono text-xs focus:border-fuchsia-500 focus:outline-none"
              placeholder="State technical reasons for disputing the initial tribunal verdict..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Supplemental Accredited Telemetry Audit URL
            </label>
            <input
              type="url"
              value={auditUrl}
              onChange={(e) => setAuditUrl(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-white font-mono text-xs focus:border-fuchsia-500 focus:outline-none"
              placeholder="https://iaea.org/..."
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-amber-600 hover:from-fuchsia-500 hover:to-amber-500 text-white font-space font-bold text-sm tracking-wide shadow-xl shadow-fuchsia-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Staking Bond &amp; Filing Dispute...
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4 text-amber-200" />
                  Stake {bondGen} GEN &amp; File Appellate Dispute
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
