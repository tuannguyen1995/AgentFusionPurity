import React from 'react';
import {
  Flame,
  ShieldAlert,
  Award,
  Layers,
  Atom,
  TrendingUp,
} from 'lucide-react';
import { ContractStats, FusionPolicyData } from '../config/genlayer';
import { formatGen } from '../utils/formatters';

interface StatsOverviewProps {
  stats: ContractStats | null;
  policies: FusionPolicyData[];
  onOpenCreateModal: () => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  stats,
  policies,
  onOpenCreateModal,
}) => {
  const totalLocked = stats ? formatGen(stats.total_fusion_locked) : '0.000';
  const totalSettled = stats?.total_shots_settled ?? 0;
  const pendingClaims = stats ? formatGen(stats.total_pending_claims) : '0.000';

  // Count reactor facilities
  const facilities = new Set(policies.map((p) => p.reactor_facility_id.trim().toUpperCase()));
  const facilityCount = facilities.size || 0;

  // Breakdown counts
  const certifiedCount = policies.filter((p) => p.status === 3).length;
  const partialCount = policies.filter((p) => p.status === 4).length;
  const quenchedCount = policies.filter((p) => p.status === 5).length;
  const activeCount = policies.filter((p) => p.status === 0 || p.status === 1 || p.status === 2).length;

  return (
    <div className="space-y-6">
      {/* Hero Banner with Action */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0D081B] via-[#160D2E] to-[#0D081B] border border-[#2A1B4E] p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-gradient-to-br from-violet-600/20 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 text-cyan-300 border border-cyan-500/30 mb-4">
              <Atom className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              Autonomous Magnetic Confinement &amp; Lawson Oracle
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-space text-white tracking-tight leading-tight">
              DeepTech Fusion Plasma &amp; Tritium Breeding Escrow
            </h1>
            <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
              Autonomous AI consensus verification for magnetic confinement fusion experiments (Tokamak &amp; Stellarator).
              Smart oracle cross-examines Soft X-Ray spectroscopy, laser interferometer electron density, and IAEA/ITER diagnostics
              for verifiable net-energy (<span className="text-emerald-400 font-mono font-bold">Q &ge; 1.0</span>) &amp; Tritium Breeding (<span className="text-cyan-400 font-mono font-bold">TBR &ge; 1.05</span>).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={onOpenCreateModal}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-fuchsia-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-space font-bold text-sm tracking-wide shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2.5 active:scale-95"
            >
              <Flame className="w-4 h-4 text-amber-300" />
              Create Fusion Shot Escrow
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Key Nuclear Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl bg-[#0D081B] border border-[#2A1B4E] hover:border-cyan-500/40 transition-all shadow-lg group">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-mono uppercase tracking-wider">Total Escrow Locked</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
              {totalLocked}
            </span>
            <span className="text-xs font-mono font-semibold text-cyan-400">GEN</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            {activeCount} active shot policies
          </p>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl bg-[#0D081B] border border-[#2A1B4E] hover:border-emerald-500/40 transition-all shadow-lg group">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-mono uppercase tracking-wider">Q-Net Pulses Certified</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
              {certifiedCount}
            </span>
            <span className="text-xs font-mono text-slate-400">/ {totalSettled} settled</span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-400/90 font-mono">
            Lawson triple product Q &ge; 1.0 verified
          </p>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl bg-[#0D081B] border border-[#2A1B4E] hover:border-violet-500/40 transition-all shadow-lg group">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-mono uppercase tracking-wider">Reactor Chambers</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 group-hover:scale-110 transition">
              <Atom className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
              {facilityCount}
            </span>
            <span className="text-xs font-mono text-slate-400">Facilities</span>
          </div>
          <p className="mt-2 text-[11px] text-violet-300 font-mono">
            SPARC, ITER, JET, WEST, MPEX
          </p>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl bg-[#0D081B] border border-[#2A1B4E] hover:border-amber-500/40 transition-all shadow-lg group">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-mono uppercase tracking-wider">Pending Claims</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 tracking-tight">
              {pendingClaims}
            </span>
            <span className="text-xs font-mono font-semibold text-amber-300">GEN</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 font-mono">
            Buffered pull-payment ledger
          </p>
        </div>
      </div>
    </div>
  );
};
