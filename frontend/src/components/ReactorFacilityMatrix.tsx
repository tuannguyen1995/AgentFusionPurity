import React from 'react';
import { Atom, Zap, Gauge, Flame, Sparkles, ChevronRight, ShieldCheck } from 'lucide-react';
import { FusionPolicyData } from '../config/genlayer';

export interface ReactorFacilityInfo {
  id: string;
  name: string;
  organization: string;
  location: string;
  magneticField: string;
  plasmaCurrent: string;
  coreTempTarget: string;
  status: 'ACTIVE_SHOT' | 'STANDBY' | 'MAINTENANCE';
  accreditedDomain: string;
}

export const KNOWN_FACILITIES: ReactorFacilityInfo[] = [
  {
    id: 'SPARC-EXPERIMENTAL-01',
    name: 'SPARC Tokamak',
    organization: 'Commonwealth Fusion Systems / MIT',
    location: 'Devens, Massachusetts, USA',
    magneticField: '12.2 Tesla (HTS Magnets)',
    plasmaCurrent: '8.7 MA',
    coreTempTarget: '140M °C (~12.1 keV)',
    status: 'ACTIVE_SHOT',
    accreditedDomain: 'cfs.energy / energy.gov',
  },
  {
    id: 'ITER-BURNING-PLASMA-01',
    name: 'ITER Tokamak',
    organization: 'ITER International Organization',
    location: 'Saint-Paul-lez-Durance, France',
    magneticField: '5.3 Tesla (Superconducting Nb3Sn)',
    plasmaCurrent: '15.0 MA',
    coreTempTarget: '150M °C (~13.0 keV)',
    status: 'ACTIVE_SHOT',
    accreditedDomain: 'iter.org / iaea.org',
  },
  {
    id: 'WEST-TUNGSTEN-TOKAMAK',
    name: 'WEST Tokamak',
    organization: 'CEA / Cadarache Fusion Center',
    location: 'Bouches-du-Rhône, France',
    magneticField: '3.7 Tesla',
    plasmaCurrent: '1.0 MA',
    coreTempTarget: '80M °C (~7.0 keV)',
    status: 'STANDBY',
    accreditedDomain: 'ipp.mpg.de',
  },
  {
    id: 'JET-DEUTERIUM-TRITIUM',
    name: 'JET Facility',
    organization: 'Culham Centre for Fusion Energy (UKAEA)',
    location: 'Oxfordshire, United Kingdom',
    magneticField: '3.45 Tesla',
    plasmaCurrent: '4.8 MA',
    coreTempTarget: '100M °C (~8.6 keV)',
    status: 'STANDBY',
    accreditedDomain: 'ccfe.ukaea.uk',
  },
];

interface ReactorFacilityMatrixProps {
  selectedFacilityId: string;
  onSelectFacility: (id: string) => void;
  policies: FusionPolicyData[];
  onQuickCreate: (facility: ReactorFacilityInfo) => void;
}

export const ReactorFacilityMatrix: React.FC<ReactorFacilityMatrixProps> = ({
  selectedFacilityId,
  onSelectFacility,
  policies,
  onQuickCreate,
}) => {
  return (
    <div className="rounded-3xl bg-[#0D081B] border border-[#2A1B4E] p-5 shadow-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold font-space text-white flex items-center gap-2">
            <Atom className="w-5 h-5 text-cyan-400" />
            Accredited Fusion Reactor Matrix
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Select a verified chamber to view pulse history or deploy new grants
          </p>
        </div>
        <span className="text-xs font-mono text-cyan-400 font-bold px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
          {KNOWN_FACILITIES.length} Chambers Online
        </span>
      </div>

      {/* Facilities Cards Grid */}
      <div className="space-y-2.5">
        {KNOWN_FACILITIES.map((facility) => {
          const isSelected = selectedFacilityId === facility.id;
          const facilityPolicies = policies.filter(
            (p) => p.reactor_facility_id.toUpperCase() === facility.id
          );
          const activeShotCount = facilityPolicies.filter(
            (p) => p.status === 0 || p.status === 1 || p.status === 2
          ).length;

          return (
            <div
              key={facility.id}
              onClick={() => onSelectFacility(facility.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                isSelected
                  ? 'bg-[#160D2E] border-cyan-500/60 shadow-lg shadow-cyan-500/15'
                  : 'bg-[#04030A] border-[#2A1B4E] hover:border-[#3D2870] hover:bg-[#0A0617]'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-space text-sm">
                      {facility.name}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-[#0D081B] border border-[#2A1B4E] text-slate-300">
                      {facility.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {facility.organization} &middot; {facility.location}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      activeShotCount > 0
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {activeShotCount > 0 ? `${activeShotCount} Active Pulses` : 'Ready for Shot'}
                  </span>
                </div>
              </div>

              {/* Physical specifications */}
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#1F133A] font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Magnetic Field B<sub>0</sub></span>
                  <span className="text-cyan-300 font-semibold">{facility.magneticField}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Plasma Current I<sub>p</sub></span>
                  <span className="text-violet-300 font-semibold">{facility.plasmaCurrent}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">Core Target T<sub>i</sub></span>
                  <span className="text-emerald-300 font-semibold">{facility.coreTempTarget}</span>
                </div>
              </div>

              {/* Quick Action Button */}
              {isSelected && (
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#2A1B4E]">
                  <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Domain: {facility.accreditedDomain}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickCreate(facility);
                    }}
                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-space font-bold text-[11px] shadow-md transition flex items-center gap-1"
                  >
                    <Flame className="w-3 h-3 text-amber-200" />
                    Deploy Shot Grant
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
