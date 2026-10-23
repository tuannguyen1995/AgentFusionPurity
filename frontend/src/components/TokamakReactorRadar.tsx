import React, { useEffect, useRef, useState } from 'react';
import { Activity, ShieldCheck, Flame, Compass, Maximize2 } from 'lucide-react';
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

  const [particles, setParticles] = useState<
    { x: number; y: number; vx: number; vy: number; life: number; color: string }[]
  >([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angleOffset = 0;

    // Generate plasma particle cloud
    const count = 75;
    const pts = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const r = 50 + Math.random() * 55;
      return {
        angle,
        r,
        speed: (Math.random() * 0.04 + 0.02) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2.5 + 1.5,
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
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Toroidal Vacuum Chamber Boundary (D-shape approximation)
      ctx.save();
      ctx.translate(cx, cy);

      // Outer cryostat shell
      ctx.beginPath();
      ctx.ellipse(0, 0, 160, 110, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#2A1B4E';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Magnetic field coils (D-coils)
      ctx.strokeStyle = '#3D2870';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 140, 95, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Central Solenoid pillar
      const gradientSolenoid = ctx.createLinearGradient(-25, 0, 25, 0);
      gradientSolenoid.addColorStop(0, '#1E1238');
      gradientSolenoid.addColorStop(0.5, '#4C1D95');
      gradientSolenoid.addColorStop(1, '#1E1238');
      ctx.fillStyle = gradientSolenoid;
      ctx.fillRect(-22, -100, 44, 200);
      ctx.strokeStyle = '#6D28D9';
      ctx.strokeRect(-22, -100, 44, 200);

      // Toroidal Plasma Ring Glow
      const isQuenched = activePolicy?.status === 5;
      const isCertified = activePolicy?.status === 3;

      const plasmaGrad = ctx.createRadialGradient(
        0,
        0,
        25,
        0,
        0,
        isQuenched ? 60 : 115
      );
      if (isQuenched) {
        plasmaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
        plasmaGrad.addColorStop(0.6, 'rgba(185, 28, 28, 0.2)');
        plasmaGrad.addColorStop(1, 'transparent');
      } else if (isCertified) {
        plasmaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
        plasmaGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.45)');
        plasmaGrad.addColorStop(1, 'transparent');
      } else {
        plasmaGrad.addColorStop(0, 'rgba(217, 70, 239, 0.8)');
        plasmaGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.4)');
        plasmaGrad.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = plasmaGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 115, 75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rotating magnetic flux field lines
      angleOffset += 0.008;
      ctx.strokeStyle = isQuenched
        ? 'rgba(239, 68, 68, 0.5)'
        : 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 1.5;

      for (let i = 0; i < 6; i++) {
        const phi = angleOffset + (i * Math.PI) / 3;
        ctx.beginPath();
        const rx = 100 * Math.cos(phi);
        const ry = 60 * Math.sin(phi);
        ctx.ellipse(rx * 0.25, 0, Math.abs(rx) + 20, 50, phi * 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw plasma ion / electron swirl particles
      pts.forEach((pt) => {
        pt.angle += pt.speed;
        const px = pt.r * Math.cos(pt.angle) * 1.3;
        const py = pt.r * Math.sin(pt.angle) * 0.8;

        ctx.fillStyle = isQuenched
          ? '#EF4444'
          : pt.hue === 185
          ? '#06B6D4'
          : '#D946EF';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Core Hotspot
      ctx.beginPath();
      ctx.arc(0, 0, isQuenched ? 8 : 16, 0, Math.PI * 2);
      ctx.fillStyle = isQuenched ? '#F87171' : '#FFFFFF';
      ctx.shadowColor = isQuenched ? '#EF4444' : '#06B6D4';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [activePolicy]);

  return (
    <div className="rounded-3xl bg-[#0D081B] border border-[#2A1B4E] p-6 shadow-2xl relative overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="text-xl font-bold font-space text-white tracking-tight flex items-center gap-2">
              Tokamak Magnetic Confinement Radar
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time Lawson Criterion Triple Product (n<sub>e</sub> &middot; T<sub>i</sub> &middot; &tau;<sub>E</sub>) &amp; Poloidal Magnetic Flux
          </p>
        </div>

        {/* Policy Selector Pills */}
        {policies.length > 0 && (
          <div className="flex items-center gap-1.5 bg-[#04030A] p-1 rounded-xl border border-[#2A1B4E] max-w-full overflow-x-auto">
            {policies.map((p) => {
              const isSelected = (activePolicy?.policy_id === p.policy_id);
              return (
                <button
                  key={p.policy_id}
                  onClick={() => onSelectPolicy(p.policy_id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-[#0D081B]'
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Canvas Display */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative bg-[#04030A]/90 rounded-2xl border border-[#2A1B4E]/80 p-4">
          <canvas
            ref={canvasRef}
            width={460}
            height={300}
            className="w-full max-w-[460px] h-[300px]"
          />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-[#1F143A] pt-2">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              Toroidal / Poloidal Field
            </span>
            <span className="text-cyan-400">
              Chamber: {activePolicy?.reactor_facility_id || 'SPARC-01'}
            </span>
          </div>
        </div>

        {/* Live Lawson Criterion Telemetry Cards */}
        <div className="lg:col-span-5 space-y-3 font-mono">
          <div className="p-4 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Energy Confinement Time (&tau;<sub>E</sub>)</span>
              <span className="text-cyan-400 font-semibold">
                Min: {formatConfinement(activePolicy?.min_confinement_ms || 500)}
              </span>
            </div>
            <div className="text-xl font-bold text-white flex items-baseline gap-2">
              {formatConfinement(activePolicy?.measured_confinement_ms || 0)}
              <span className="text-xs text-slate-400 font-normal">
                {activePolicy?.measured_confinement_ms && activePolicy.measured_confinement_ms >= (activePolicy.min_confinement_ms || 500)
                  ? '(Target Met)'
                  : '(H-Mode Steady State)'}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[#1A0E33] h-2 rounded-full overflow-hidden mt-2">
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

          <div className="p-4 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Fusion Net Energy Factor (Q)</span>
              <span className="text-violet-400 font-semibold">
                Target: {formatQFactor(activePolicy?.target_q_factor_bps || 1000)}
              </span>
            </div>
            <div className="text-xl font-bold text-emerald-400 flex items-baseline gap-2">
              {formatQFactor(activePolicy?.measured_q_factor_bps || 0)}
              <span className="text-xs text-slate-400 font-normal">
                (P<sub>fusion</sub> / P<sub>input</sub>)
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#04030A] border border-[#2A1B4E]">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Tritium Breeding Ratio (TBR)</span>
              <span className="text-cyan-400 font-semibold">Self-Sustaining &ge; 1.05</span>
            </div>
            <div className="text-xl font-bold text-cyan-300 flex items-baseline gap-2">
              {formatTBR(activePolicy?.tbr_ratio_bps || 0)}
              <span className="text-xs text-slate-400 font-normal">Lithium Blanket Efficiency</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
