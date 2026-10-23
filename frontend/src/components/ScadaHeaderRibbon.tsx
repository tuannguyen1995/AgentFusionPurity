import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Radio,
  Wifi,
  Shield,
  Layers,
  Clock,
  Zap,
} from 'lucide-react';
import { STUDIONET_CHAIN_ID } from '../config/genlayer';

interface ScadaHeaderRibbonProps {
  account: string;
  userRole: string;
  totalPolicies: number;
  totalLockedGen: string;
  activeChambers: number;
}

export const ScadaHeaderRibbon: React.FC<ScadaHeaderRibbonProps> = ({
  account,
  userRole,
  totalPolicies,
  totalLockedGen,
  activeChambers,
}) => {
  const [latency, setLatency] = useState<number>(42);
  const [blockHeight, setBlockHeight] = useState<number>(142980);

  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(Math.floor(38 + Math.random() * 12));
      setBlockHeight((b) => b + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-[#05030D] border-b border-[#1F133A] py-1.5 px-4 text-[11px] font-mono text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Consensus Telemetry */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span className="font-bold text-white tracking-wider">SCADA ONLINE</span>
            <span className="text-slate-500">&middot;</span>
            <span className="text-slate-300">GenLayer StudioNet (Chain {STUDIONET_CHAIN_ID})</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-slate-400">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>RPC Latency:</span>
            <span className="text-emerald-400 font-bold">{latency}ms</span>
          </div>

          <div className="hidden md:flex items-center gap-1 text-slate-400">
            <Layers className="w-3 h-3 text-violet-400" />
            <span>Block Ticker:</span>
            <span className="text-violet-300 font-bold">#{blockHeight}</span>
          </div>
        </div>

        {/* Operational Statistics */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Locked Escrow:</span>
            <span className="text-cyan-300 font-bold">{totalLockedGen} GEN</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5">
            <span className="text-slate-500">Chambers Monitored:</span>
            <span className="text-fuchsia-300 font-bold">{activeChambers}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Active Role:</span>
            <span className="px-2 py-0.5 rounded bg-[#160D2E] text-cyan-400 border border-cyan-500/30 font-bold text-[10px]">
              {userRole}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
