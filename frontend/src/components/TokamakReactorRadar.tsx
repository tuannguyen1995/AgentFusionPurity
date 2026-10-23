import React, { useEffect, useRef, useState } from 'react';
import { Activity, ShieldCheck, Flame, Compass, Maximize2, Sliders, Zap } from 'lucide-react';
import { FusionPolicyData } from '../config/genlayer';
import { formatQFactor, formatTBR, formatConfinement } from '../utils/formatters';

interface TokamakReactorRadarProps {
  policies: FusionPolicyData[];
  selectedPolicyId: string | null;
  onSelectPolicy: (id: string) => void;
}

export const TokamakReactorRadar: React.FC<TokamakReactorRadarProps> = ({
  policies,
  selectedPolicyId,
  onSelectPolicy,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePolicy =
    policies.find((p) => p.policy_id === selectedPolicyId) || policies[0] || null;

  // Interactive SCADA Controls
  const [magneticFieldB, setMagneticFieldB] = useState<number>(12.2); // Tesla
  const [plasmaCurrentIp, setPlasmaCurrentIp] = useState<number>(8.7); // MA

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angleOffset = 0;

    // Generate plasma particle cloud scaled with magnetic field & temperature
    const count = 90;
    const pts = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 65;
      return {
        angle,
        r,
        speed: (Math.random() * 0.05 + 0.02) * (Math.random() > 0.5 ? 1 : -1) * (magneticFieldB / 10),
        size: Math.random() * 2.8 + 1.2,
        hue: Math.random() > 0.4 ? 185 : 290, // Cyan or Magenta
      };
    });

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Background subtle grid
      ctx.strokeStyle = '#1D1236';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(cx, cy);

      // Outer cryostat vacuum vessel
      ctx.beginPath();
      ctx.ellipse(0, 0, 165, 115, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#2A1B4E';
      ctx.lineWidth = 4;
      ctx.stroke();

      // D-Shaped Magnetic Field Coils
      ctx.strokeStyle = '#3D2870';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 142, 98, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Central Solenoid Induction Pillar
      const gradientSolenoid = ctx.createLinearGradient(-25, 0, 25, 0);
      gradientSolenoid.addColorStop(0, '#1E1238');
      gradientSolenoid.addColorStop(0.5, '#5B21B6');
      gradientSolenoid.addColorStop(1, '#1E1238');
      ctx.fillStyle = gradientSolenoid;
      ctx.fillRect(-22, -100, 44, 200);
      ctx.strokeStyle = '#7C3AED';
      ctx.strokeRect(-22, -100, 44, 200);

      // Plasma Torus Glow
      const isQuenched = activePolicy?.status === 5;
      const isCertified = activePolicy?.status === 3;

      const plasmaRadius = isQuenched ? 60 : 118;
      const plasmaGrad = ctx.createRadialGradient(0, 0, 25, 0, 0, plasmaRadius);

      if (isQuenched) {
        plasmaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
        plasmaGrad.addColorStop(0.6, 'rgba(185, 28, 28, 0.25)');
        plasmaGrad.addColorStop(1, 'transparent');
      } else if (isCertified) {
        plasmaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
        plasmaGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.5)');
        plasmaGrad.addColorStop(1, 'transparent');
      } else {
        plasmaGrad.addColorStop(0, 'rgba(217, 70, 239, 0.85)');
        plasmaGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.45)');
        plasmaGrad.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = plasmaGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 118, 78, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dynamic Poloidal Magnetic Flux lines
      angleOffset += 0.009 * (plasmaCurrentIp / 5);
      ctx.strokeStyle = isQuenched
        ? 'rgba(239, 68, 68, 0.5)'
        : 'rgba(6, 182, 212, 0.65)';
      ctx.lineWidth = 1.5;

      for (let i = 0; i < 8; i++) {
        const phi = angleOffset + (i * Math.PI) / 4;
        ctx.beginPath();
        const rx = 100 * Math.cos(phi);
        ctx.ellipse(rx * 0.25, 0, Math.abs(rx) + 22, 52, phi * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Swirling Deuterium-Tritium plasma particles
      pts.forEach((pt) => {
        pt.angle += pt.speed;
        const px = pt.r * Math.cos(pt.angle) * 1.35;
        const py = pt.r * Math.sin(pt.angle) * 0.82;

        ctx.fillStyle = isQuenched
          ? '#EF4444'
          : pt.hue === 185
          ? '#06B6D4'
          : '#D946EF';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 9;
        ctx.beginPath();
        ctx.arc(px, py, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Ultra-Hot Fusion Plasma Core Hotspot
      ctx.beginPath();
      ctx.arc(0, 0, isQuenched ? 8 : 18, 0, Math.PI * 2);
      ctx.fillStyle = isQuenched ? '#F87171' : '#FFFFFF';
      ctx.shadowColor = isQuenched ? '#EF4444' : '#06B6D4';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [activePolicy, magneticFieldB, plasmaCurrentIp]);

  const betaN = (plasmaCurrentIp * 0.28).toFixed(2);

  return (
    <div className="rounded-3xl bg-[#0D081B] border border-[#2A1B4E] p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="text-lg font-bold font-space text-white tracking-tight flex items-center gap-2">
              Tokamak Magnetic Confinement Cockpit
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Lawson Triple Product (n<sub>e</sub> &middot; T<sub>i</sub> &middot; &tau;<sub>E</sub>) &middot; HTS Toroidal Field B<sub>0</sub>
          </p>
        </div>

        {/* Policy Selector Pills */}
        {policies.length > 0 && (
          <div className="flex items-center gap-1.5 bg-[#04030A] p-1 rounded-xl border border-[#2A1B4E] max-w-full overflow-x-auto">
            {policies.slice(0, 4).map((p) => {
              const isSelected = activePolicy?.policy_id === p.policy_id;
              return (
                <button
                  key={p.policy_id}
                  onClick={() => onSelectPolicy(p.policy_id)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  #{p.policy_id} &middot; {p.reactor_facility_id}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Radar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Canvas Display */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative bg-[#04030A]/90 rounded-2xl border border-[#2A1B4E]/80 p-3">
          <canvas
            ref={canvasRef}
            width={460}
            height={280}
            className="w-full max-w-[460px] h-[280px]"
          />
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-[#1F143A] pt-1.5">
            <span className="flex items-center gap-1 text-cyan-400">
              <Compass className="w-3.5 h-3.5" />
              Chamber: {activePolicy?.reactor_facility_id || 'SPARC-EXPERIMENTAL-01'}
            </span>
            <span className="text-violet-300">
              Troyon Limit &beta;<sub>N</sub> &asymp; {betaN}
            </span>
          </div>
        </div>

        {/* Live Lawson Criterion Telemetry Cards & Controls */}
        <div className="lg:col-span-5 space-y-2.5 font-mono">
          <div className="p-3 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Energy Confinement (&tau;<sub>E</sub>)</span>
              <span className="text-cyan-400 font-semibold">
                Target: {formatConfinement(activePolicy?.min_confinement_ms || 500)}
              </span>
            </div>
            <div className="text-lg font-bold text-white flex items-baseline gap-2">
              {formatConfinement(activePolicy?.measured_confinement_ms || 0)}
              <span className="text-xs text-slate-400 font-normal">
                {activePolicy?.measured_confinement_ms &&
                activePolicy.measured_confinement_ms >= (activePolicy.min_confinement_ms || 500)
                  ? '(Sustained)'
                  : '(Stabilized)'}
              </span>
            </div>
            <div className="w-full bg-[#1A0E33] h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  activePolicy?.status === 3 ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    ((activePolicy?.measured_confinement_ms || 0) /
                      (activePolicy?.min_confinement_ms || 500)) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Net Energy Gain Factor (Q)</span>
              <span className="text-violet-400 font-semibold">
                Target: {formatQFactor(activePolicy?.target_q_factor_bps || 1000)}
              </span>
            </div>
            <div className="text-lg font-bold text-emerald-400 flex items-baseline gap-2">
              {formatQFactor(activePolicy?.measured_q_factor_bps || 0)}
              <span className="text-xs text-slate-400 font-normal">
                (P<sub>fusion</sub> / P<sub>in</sub>)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Tritium Breeding Ratio (TBR)</span>
              <span className="text-cyan-400 font-semibold">Self-Sustaining &ge; 1.05</span>
            </div>
            <div className="text-lg font-bold text-cyan-300 flex items-baseline gap-2">
              {formatTBR(activePolicy?.tbr_ratio_bps || 0)}
            </div>
          </div>

          {/* Interactive SCADA Sliders */}
          <div className="p-2.5 rounded-xl bg-[#04030A] border border-[#2A1B4E] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Sliders className="w-3 h-3 text-cyan-400" /> TF Coil Field B<sub>0</sub>
              </span>
              <span className="text-cyan-400 font-bold">{magneticFieldB} T</span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              step="0.1"
              value={magneticFieldB}
              onChange={(e) => setMagneticFieldB(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-[#1A0E33] rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
