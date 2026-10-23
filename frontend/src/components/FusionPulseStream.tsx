import React, { useState } from 'react';
import {
  Activity,
  Flame,
  ShieldCheck,
  Clock,
  Cpu,
  ChevronRight,
  ExternalLink,
  Award,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { FusionPolicyData, STUDIO_URL, getSavedContractAddress } from '../config/genlayer';
import {
  formatGen,
  formatAddress,
  formatTimestamp,
  formatQFactor,
  formatTBR,
  formatConfinement,
  getStatusLabel,
} from '../utils/formatters';

interface FusionPulseStreamProps {
  policies: FusionPolicyData[];
  selectedPolicyId: string | null;
  onSelectPolicy: (id: string) => void;
  onInspectSpectrometry: (p: FusionPolicyData) => void;
  onSubmitTelemetry: (p: FusionPolicyData) => void;
  onAppeal: (p: FusionPolicyData) => void;
}

export const FusionPulseStream: React.FC<FusionPulseStreamProps> = ({
  policies,
  selectedPolicyId,
  onSelectPolicy,
  onInspectSpectrometry,
  onSubmitTelemetry,
  onAppeal,
}) => {
  return (
    <div className="rounded-3xl bg-[#0D081B] border border-[#2A1B4E] p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold font-space text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Live Tokamak Pulse Telemetry Ledger
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time on-chain Lawson criteria verification records and pulse states
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          Total Pulses: <strong className="text-white">{policies.length}</strong>
        </span>
      </div>

      {policies.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#04030A] border border-[#2A1B4E] font-mono text-xs text-slate-400">
          No experimental fusion shot policies recorded on this contract yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#2A1B4E] text-slate-400 text-[11px] uppercase tracking-wider bg-[#04030A]/60">
                <th className="py-3 px-4">Policy / Chamber</th>
                <th className="py-3 px-4">Escrow</th>
                <th className="py-3 px-4">Confinement &tau;<sub>E</sub></th>
                <th className="py-3 px-4">Q-Factor</th>
                <th className="py-3 px-4">TBR Ratio</th>
                <th className="py-3 px-4">Status / Verdict</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F133A]">
              {policies.map((p) => {
                const isSelected = selectedPolicyId === p.policy_id;
                const statusStyle = getStatusLabel(p.status);

                return (
                  <tr
                    key={p.policy_id}
                    onClick={() => onSelectPolicy(p.policy_id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#160D2E] text-white'
                        : 'hover:bg-[#070412] text-slate-300'
                    }`}
                  >
                    {/* Policy ID & Chamber */}
                    <td className="py-3.5 px-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-bold font-space text-sm">
                          #{p.policy_id}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#04030A] border border-[#2A1B4E] text-[10px] text-slate-300">
                          {p.reactor_facility_id}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {formatTimestamp(p.created_at_time)}
                      </div>
                    </td>

                    {/* Escrow */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-white">{formatGen(p.escrow_amount)}</span>{' '}
                      <span className="text-cyan-400 text-[10px]">GEN</span>
                    </td>

                    {/* Confinement */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">
                        {formatConfinement(p.measured_confinement_ms)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Req: &ge;{p.min_confinement_ms}ms
                      </div>
                    </td>

                    {/* Q-Factor */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-emerald-400">
                        {formatQFactor(p.measured_q_factor_bps)}
                      </span>
                    </td>

                    {/* TBR Ratio */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-fuchsia-400">
                        {formatTBR(p.tbr_ratio_bps)}
                      </span>
                    </td>

                    {/* Status / Verdict */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {statusStyle.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectSpectrometry(p);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#04030A] border border-[#2A1B4E] hover:border-cyan-500 text-cyan-400 text-[11px] transition flex items-center gap-1"
                        >
                          <Cpu className="w-3 h-3" /> Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
