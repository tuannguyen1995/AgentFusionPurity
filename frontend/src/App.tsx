import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ScadaHeaderRibbon } from './components/ScadaHeaderRibbon';
import { TokamakReactorRadar } from './components/TokamakReactorRadar';
import { ReactorFacilityMatrix, KNOWN_FACILITIES, ReactorFacilityInfo } from './components/ReactorFacilityMatrix';
import { RoleCommandDeck } from './components/RoleCommandDeck';
import { FusionPulseStream } from './components/FusionPulseStream';
import { PullPayoutButton } from './components/PullPayoutButton';
import { CreatePolicyModal } from './components/CreatePolicyModal';
import { SubmitTelemetryModal } from './components/SubmitTelemetryModal';
import { SpectrometryInspectorModal } from './components/SpectrometryInspectorModal';
import { AppealModal } from './components/AppealModal';
import { ErrorBoundary } from './components/ErrorBoundary';

import {
  FusionPolicyData,
  ContractStats,
  readContract,
  fetchStudionetBalance,
  STUDIONET_CHAIN_ID,
  getSavedContractAddress,
  STUDIO_URL,
} from './config/genlayer';
import {
  RefreshCw,
  Search,
  ExternalLink,
  Flame,
  Radio,
  Layers,
  Atom,
  Sliders,
  Cpu,
} from 'lucide-react';
import { formatGen } from './utils/formatters';

export const App: React.FC = () => {
  const [account, setAccount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0.000');
  const [chainId, setChainId] = useState<number | null>(null);

  const [stats, setStats] = useState<ContractStats | null>(null);
  const [policies, setPolicies] = useState<FusionPolicyData[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('SPARC-EXPERIMENTAL-01');
  const [userRole, setUserRole] = useState<string>('OBSERVER');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [telemetryPolicy, setTelemetryPolicy] = useState<FusionPolicyData | null>(null);
  const [inspectPolicy, setInspectPolicy] = useState<FusionPolicyData | null>(null);
  const [appealPolicy, setAppealPolicy] = useState<FusionPolicyData | null>(null);

  // Connect Web3 Wallet
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        if (accounts && accounts.length > 0) {
          const acc = accounts[0].toLowerCase();
          setAccount(acc);
          const bal = await fetchStudionetBalance(acc);
          setBalance(bal);
          const chainHex = await (window as any).ethereum.request({ method: 'eth_chainId' });
          setChainId(parseInt(chainHex, 16));
        }
      } catch (err) {
        console.error('Wallet connection failed:', err);
      }
    } else {
      alert('MetaMask or a Web3 compatible wallet is required.');
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setBalance('0.000');
    setUserRole('OBSERVER');
  };

  // Listen to network and accounts changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;

      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length > 0) {
          const acc = accounts[0].toLowerCase();
          setAccount(acc);
          const bal = await fetchStudionetBalance(acc);
          setBalance(bal);
        } else {
          disconnectWallet();
        }
      };

      const handleChainChanged = (chainHex: string) => {
        setChainId(parseInt(chainHex, 16));
      };

      eth.on('accountsChanged', handleAccountsChanged);
      eth.on('chainChanged', handleChainChanged);

      eth.request({ method: 'eth_accounts' }).then(async (accounts: string[]) => {
        if (accounts.length > 0) {
          const acc = accounts[0].toLowerCase();
          setAccount(acc);
          const bal = await fetchStudionetBalance(acc);
          setBalance(bal);
        }
      });

      eth.request({ method: 'eth_chainId' }).then((chainHex: string) => {
        setChainId(parseInt(chainHex, 16));
      });

      return () => {
        eth.removeListener('accountsChanged', handleAccountsChanged);
        eth.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // Fetch all policies and stats
  const fetchAllData = useCallback(async () => {
    try {
      setRefreshing(true);
      const contractAddress = getSavedContractAddress();

      // Fetch stats
      try {
        const statsRes = await readContract('get_stats', [], contractAddress);
        if (statsRes) {
          const parsed = typeof statsRes === 'string' ? JSON.parse(statsRes) : statsRes;
          setStats(parsed);
        }
      } catch (e) {
        console.warn('Error reading stats:', e);
      }

      // Fetch all policies
      try {
        const policiesRes = await readContract('get_all_policies', [], contractAddress);
        if (policiesRes) {
          const parsed = typeof policiesRes === 'string' ? JSON.parse(policiesRes) : policiesRes;
          if (Array.isArray(parsed)) {
            const sorted = [...parsed].reverse();
            setPolicies(sorted);
            if (!selectedPolicyId && sorted.length > 0) {
              setSelectedPolicyId(sorted[0].policy_id);
            }
          }
        }
      } catch (e) {
        console.warn('Error reading policies:', e);
      }

      // Refresh wallet balance and role
      if (account) {
        const bal = await fetchStudionetBalance(account);
        setBalance(bal);

        if (selectedPolicyId) {
          try {
            const role = await readContract('get_user_role', [selectedPolicyId, account], contractAddress);
            setUserRole(String(role || 'OBSERVER'));
          } catch {
            setUserRole('OBSERVER');
          }
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [account, selectedPolicyId]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 12000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const selectedPolicy = policies.find((p) => p.policy_id === selectedPolicyId) || policies[0] || null;

  const totalLockedGen = stats ? formatGen(stats.total_fusion_locked) : '0.000';
  const totalPoliciesCount = policies.length;
  const uniqueFacilitiesCount = new Set(policies.map((p) => p.reactor_facility_id.toUpperCase())).size || KNOWN_FACILITIES.length;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#04030A] text-slate-100 flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* SCADA Status Ribbon */}
        <ScadaHeaderRibbon
          account={account}
          userRole={userRole}
          totalPolicies={totalPoliciesCount}
          totalLockedGen={totalLockedGen}
          activeChambers={uniqueFacilitiesCount}
        />

        {/* Primary Navbar */}
        <Navbar
          account={account}
          balance={balance}
          chainId={chainId}
          onConnectWallet={connectWallet}
          onDisconnectWallet={disconnectWallet}
          onContractAddressChange={fetchAllData}
        />

        {/* Main SCADA Operations Deck */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
          {/* Top Deck: Dual-Monitor Tokamak Telemetry & Multi-Chamber Facility Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <TokamakReactorRadar
                policies={policies}
                selectedPolicyId={selectedPolicyId}
                onSelectPolicy={(id) => {
                  setSelectedPolicyId(id);
                  const p = policies.find((item) => item.policy_id === id);
                  if (p) setSelectedFacilityId(p.reactor_facility_id.toUpperCase());
                }}
              />
            </div>

            <div className="lg:col-span-5">
              <ReactorFacilityMatrix
                selectedFacilityId={selectedFacilityId}
                onSelectFacility={(id) => {
                  setSelectedFacilityId(id);
                  const p = policies.find((item) => item.reactor_facility_id.toUpperCase() === id);
                  if (p) setSelectedPolicyId(p.policy_id);
                }}
                policies={policies}
                onQuickCreate={() => setIsCreateOpen(true)}
              />
            </div>
          </div>

          {/* Middle Deck: Role-Based Command Console */}
          <RoleCommandDeck
            policies={policies}
            selectedPolicy={selectedPolicy}
            account={account}
            onRefresh={fetchAllData}
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenSubmitTelemetry={(p) => setTelemetryPolicy(p)}
            onOpenAppeal={(p) => setAppealPolicy(p)}
            onInspectSpectrometry={(p) => setInspectPolicy(p)}
          />

          {/* Live Telemetry Pulse Ledger / Stream */}
          <FusionPulseStream
            policies={policies}
            selectedPolicyId={selectedPolicyId}
            onSelectPolicy={(id) => {
              setSelectedPolicyId(id);
              const p = policies.find((item) => item.policy_id === id);
              if (p) setSelectedFacilityId(p.reactor_facility_id.toUpperCase());
            }}
            onInspectSpectrometry={(p) => setInspectPolicy(p)}
            onSubmitTelemetry={(p) => setTelemetryPolicy(p)}
            onAppeal={(p) => setAppealPolicy(p)}
          />

          {/* Pull-Payment Beneficiary Ledger Dock */}
          <PullPayoutButton
            account={account}
            onClaimSuccess={fetchAllData}
          />
        </main>

        {/* Industrial Footer */}
        <footer className="w-full border-t border-[#1F133A] bg-[#05030D] py-6 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>AgentFusionPurity &middot; SCADA Magnetic Confinement Oracle &middot; StudioNet 61999</span>
            </div>
            <div className="flex items-center gap-6">
              <a
                href={`${STUDIO_URL}/address/${getSavedContractAddress()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-400 transition flex items-center gap-1"
              >
                Intelligent Contract <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://github.com/tuannguyen1995/AgentFusionPurity"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-400 transition flex items-center gap-1"
              >
                GitHub Source <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </footer>

        {/* Modals */}
        <CreatePolicyModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={fetchAllData}
          account={account}
        />

        {telemetryPolicy && (
          <SubmitTelemetryModal
            isOpen={!!telemetryPolicy}
            onClose={() => setTelemetryPolicy(null)}
            onSuccess={fetchAllData}
            policy={telemetryPolicy}
            account={account}
          />
        )}

        {inspectPolicy && (
          <SpectrometryInspectorModal
            isOpen={!!inspectPolicy}
            onClose={() => setInspectPolicy(null)}
            policy={inspectPolicy}
          />
        )}

        {appealPolicy && (
          <AppealModal
            isOpen={!!appealPolicy}
            onClose={() => setAppealPolicy(null)}
            onSuccess={fetchAllData}
            policy={appealPolicy}
            account={account}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};
