import React, { useState } from 'react';
import { X, Flame, ShieldAlert, AlertCircle, Sparkles, Check } from 'lucide-react';
import { encodeCalldata, waitForTransactionReceipt, getSavedContractAddress } from '../config/genlayer';

interface CreatePolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account: string;
}

const PRESET_FACILITIES = [
  {
    id: 'SPARC-EXPERIMENTAL-01',
    name: 'SPARC (Commonwealth Fusion Systems / MIT)',
    defaultOperator: '0x2222222222222222222222222222222222222222',
    minConfinement: 500,
    targetQ: 1000,
  },
  {
    id: 'ITER-BURNING-PLASMA-01',
    name: 'ITER (International Thermonuclear Experimental Reactor)',
    defaultOperator: '0x3333333333333333333333333333333333333333',
    minConfinement: 1000,
    targetQ: 1000,
  },
  {
    id: 'WEST-TUNGSTEN-TOKAMAK',
    name: 'WEST (CEA / Cadarache Fusion Center)',
    defaultOperator: '0x4444444444444444444444444444444444444444',
    minConfinement: 600,
    targetQ: 800,
  },
  {
    id: 'JET-DEUTERIUM-TRITIUM',
    name: 'JET (Culham Centre for Fusion Energy - CCFE)',
    defaultOperator: '0x2222222222222222222222222222222222222222',
    minConfinement: 400,
    targetQ: 1000,
  },
];

export const CreatePolicyModal: React.FC<CreatePolicyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  account,
}) => {
  const [operator, setOperator] = useState('0x2222222222222222222222222222222222222222');
  const [facilityId, setFacilityId] = useState('SPARC-EXPERIMENTAL-01');
  const [minConfinement, setMinConfinement] = useState(500);
  const [targetQ, setTargetQ] = useState(1000);
  const [durationBlocks, setDurationBlocks] = useState(6000);
  const [escrowGen, setEscrowGen] = useState('1.5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: (typeof PRESET_FACILITIES)[0]) => {
    setFacilityId(preset.id);
    setOperator(preset.defaultOperator);
    setMinConfinement(preset.minConfinement);
    setTargetQ(preset.targetQ);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!account) {
      setError('Please connect your Web3 wallet first.');
      return;
    }

    if (!operator || !operator.startsWith('0x') || operator.length !== 42) {
      setError('Please provide a valid 42-character Tokamak Operator address.');
      return;
    }

    if (operator.toLowerCase() === account.toLowerCase()) {
      setError('Sponsor cannot designate themselves as Tokamak Operator.');
      return;
    }

    if (!facilityId || facilityId.trim().length < 4) {
      setError('Reactor Chamber ID must be at least 4 characters.');
      return;
    }

    const genVal = parseFloat(escrowGen);
    if (isNaN(genVal) || genVal <= 0) {
      setError('Grant escrow deposit must be greater than 0 GEN.');
      return;
    }

    try {
      setLoading(true);
      const weiAmount = BigInt(Math.floor(genVal * 1e18));
      const contractAddress = getSavedContractAddress();

      const calldata = encodeCalldata('create_fusion_shot_escrow', [
        operator.trim(),
        facilityId.trim().toUpperCase(),
        minConfinement,
        targetQ,
        durationBlocks,
      ]);

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: contractAddress,
            data: calldata,
            value: `0x${weiAmount.toString(16)}`,
          },
        ],
      });

      console.log('Submitted create_fusion_shot_escrow tx:', txHash);
      await waitForTransactionReceipt(txHash);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating fusion shot escrow:', err);
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
            <Flame className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-space text-white">Create Fusion Shot Escrow</h3>
            <p className="text-xs text-slate-400 font-mono">
              Deposit research subsidy locked for verifiable net-energy plasma pulse
            </p>
          </div>
        </div>

        {/* Facility Presets */}
        <div className="mb-6">
          <label className="block text-xs font-mono text-slate-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Preset Tokamak Facilities
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_FACILITIES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`p-2.5 rounded-xl text-left border transition text-xs font-mono ${
                  facilityId === preset.id
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
                    : 'bg-[#04030A] border-[#2A1B4E] text-slate-400 hover:text-white hover:border-[#3D2870]'
                }`}
              >
                <div className="font-bold text-white truncate">{preset.id}</div>
                <div className="text-[10px] text-slate-400 truncate">{preset.name}</div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Reactor Facility Chamber ID
            </label>
            <input
              type="text"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
              placeholder="e.g. SPARC-EXPERIMENTAL-01"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Tokamak Operator Address
            </label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
              placeholder="0x..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Min Confinement (&tau;<sub>E</sub> ms)
              </label>
              <input
                type="number"
                value={minConfinement}
                onChange={(e) => setMinConfinement(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
                min={100}
                max={60000}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Target Q-Factor (bps)
              </label>
              <input
                type="number"
                value={targetQ}
                onChange={(e) => setTargetQ(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
                min={100}
                step={50}
                required
              />
              <span className="text-[10px] text-slate-500 font-mono">1000 = Q 1.00 net breakeven</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Duration (Blocks @ 3s)
              </label>
              <input
                type="number"
                value={durationBlocks}
                onChange={(e) => setDurationBlocks(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-white font-mono text-sm focus:border-cyan-500 focus:outline-none"
                min={10}
                required
              />
              <span className="text-[10px] text-slate-500 font-mono">
                &asymp; {Math.round((durationBlocks * 3) / 60)} minutes
              </span>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Subsidy Escrow (GEN)
              </label>
              <input
                type="text"
                value={escrowGen}
                onChange={(e) => setEscrowGen(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#04030A] border border-[#2A1B4E] rounded-xl text-cyan-400 font-mono font-bold text-sm focus:border-cyan-500 focus:outline-none"
                placeholder="1.5"
                required
              />
            </div>
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
                  Locking Grant in GenLayer Consensus...
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 text-amber-200" />
                  Deposit Escrow &amp; Initialize Shot Policy
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
