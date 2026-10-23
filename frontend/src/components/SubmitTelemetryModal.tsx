import React, { useState } from 'react';
import { X, Send, ShieldCheck, AlertCircle, ExternalLink, Activity } from 'lucide-react';
import { encodeCalldata, waitForTransactionReceipt, getSavedContractAddress, FusionPolicyData } from '../config/genlayer';

interface SubmitTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  policy: FusionPolicyData;
  account: string;
}

const PRESET_TELEMETRY = [
  {
    title: 'IAEA Accredited Q-Net Lawson Breakeven (Full 100% Release)',
    url: 'https://iaea.org/api/v1/fusion/diagnostics/sparc_shot_90214.json',
    expected: 'Q=1.25, tau_E=620ms, TBR=1.08 -> FUSION_Q_NET_CERTIFIED',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  {
    title: 'IPP Max Planck Partial Confinement Milestone (40% Fuel Release)',
    url: 'https://ipp.mpg.de/diagnostics/west_shot_1102.json',
    expected: 'Q=0.75, tau_E=350ms -> PARTIAL_CONFINEMENT_MILESTONE',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  {
    title: 'CCFE UKAEA Thermal Quench Disruption (100% Sponsor Refund)',
    url: 'https://ccfe.ukaea.uk/diagnostics/jet_pulse_9941.json',
    expected: 'MHD tearing mode -> PLASMA_DISRUPTION_QUENCH',
    badge: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
  {
    title: 'Unaccredited Source (Security Rejection Proof)',
    url: 'https://amateur-plasma-hobbyist.com/tokamak_shot.json',
    expected: 'Reverts on-chain with Telemetry unauthenticated error',
    badge: 'bg-slate-800 text-slate-400 border-slate-700',
  },
];

export const SubmitTelemetryModal: React.FC<SubmitTelemetryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  policy,
  account,
}) => {
  const [telemetryUrl, setTelemetryUrl] = useState(
    'https://iaea.org/api/v1/fusion/diagnostics/sparc_shot_90214.json'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!account) {
      setError('Please connect your Web3 wallet first.');
      return;
    }

    if (!telemetryUrl || !telemetryUrl.trim().startsWith('http')) {
      setError('Please enter a valid HTTP/HTTPS diagnostic feed URL.');
      return;
    }

    try {
      setLoading(true);
      const contractAddress = getSavedContractAddress();

      const calldata = encodeCalldata('submit_shot_diagnostics', [
        policy.policy_id,
        telemetryUrl.trim(),
      ]);

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

      console.log('Submitted submit_shot_diagnostics tx:', txHash);
      await waitForTransactionReceipt(txHash);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting shot diagnostics:', err);
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
            <Activity className="w-6 h-6 text-cyan-200" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-space text-white">Submit Pulse Diagnostics</h3>
            <p className="text-xs text-slate-400 font-mono">
              Policy #{policy.policy_id} &middot; Reactor Chamber {policy.reactor_facility_id}
            </p>
          </div>
        </div>

        {/* Accredited Institutions Badge */}
        <div className="p-3.5 rounded-2xl bg-[#04030A] border border-[#2A1B4E] mb-5">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-semibold mb-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Accredited Fusion Research Domain Enforcement
          </div>
          <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
            Telemetry endpoints must strictly originate from IAEA (<code className="text-cyan-400">iaea.org</code>), ITER (<code className="text-cyan-400">iter.org</code>), US DOE (<code className="text-cyan-400">energy.gov</code>), CCFE UK (<code className="text-cyan-400">ccfe.ukaea.uk</code>), IPP Max Planck (<code className="text-cyan-400">ipp.mpg.de</code>), or CFS (<code className="text-cyan-400">cfs.energy</code>).
          </p>
        </div>

        {/* 1-Click Telemetry Presets */}
        <div className="mb-5 space-y-2">
          <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider">
            1-Click Telemetry Endpoints
          </label>
          {PRESET_TELEMETRY.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setTelemetryUrl(item.url)}
              className={`w-full p-3 rounded-xl text-left border transition text-xs font-mono ${
                telemetryUrl === item.url
                  ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                  : 'bg-[#04030A] border-[#2A1B4E] text-slate-400 hover:text-white hover:border-[#3D2870]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-white truncate">{item.title}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${item.badge}`}>
                  Select
                </span>
              </div>
              <div className="text-[10px] text-cyan-400 truncate font-mono mb-0.5">{item.url}</div>
              <div className="text-[10px] text-slate-500 truncate">{item.expected}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Diagnostic Spectrometry &amp; Laser Interferometer URL
            </label>
            <input
              type="url"
              value={telemetryUrl}
              onChange={(e) => setTelemetryUrl(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
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
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-fuchsia-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-space font-bold text-sm tracking-wide shadow-xl shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Broadcasting Telemetry to Consensus...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-cyan-200" />
                  Submit Shot Telemetry
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
