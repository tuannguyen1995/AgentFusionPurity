import React, { useState, useEffect, useCallback } from 'react';
import {
  Navbar,
} from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { TokamakReactorRadar } from './components/TokamakReactorRadar';
import { PolicyCard } from './components/PolicyCard';
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
  Filter,
  Search,
  ExternalLink,
  Flame,
  Radio,
  Layers,
  Atom,
  AlertCircle,
} from 'lucide-react';

export const App: React.FC = () => {
  const [account, setAccount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0.000');
  const [chainId, setChainId] = useState<number | null>(null);

  const [stats, setStats] = useState<ContractStats | null>(null);
  const [policies, setPolicies] = useState<FusionPolicyData[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
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

      // Check current accounts
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
            // Sort newest first
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

      // Refresh wallet balance
      if (account) {
        const bal = await fetchStudionetBalance(account);
        setBalance(bal);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [account, selectedPolicyId]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Filtered policies list
  const filteredPolicies = policies.filter((p) => {
    const matchesSearch =
      p.policy_id.includes(searchQuery) ||
      p.reactor_facility_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tokamak_operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sponsor.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'ACTIVE') {
      return p.status === 0 || p.status === 1 || p.status === 2;
    }
    if (filterStatus === 'CERTIFIED') {
      return p.status === 3;
    }
    if (filterStatus === 'PARTIAL') {
      return p.status === 4;
    }
    if (filterStatus === 'QUENCHED') {
      return p.status === 5;
    }
    if (filterStatus === 'DISPUTED') {
      return p.status === 6;
    }
    return true;
  });

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#04030A] text-slate-100 flex flex-col justify-between">
        {/* Navbar */}
        <Navbar
          account={account}
          balance={balance}
          chainId={chainId}
          onConnectWallet={connectWallet}
          onDisconnectWallet={disconnectWallet}
          onContractAddressChange={fetchAllData}
        />

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1 w-full">
          {/* Stats Overview Banner */}
          <StatsOverview
            stats={stats}
            policies={policies}
            onOpenCreateModal={() => setIsCreateOpen(true)}
          />

          {/* Interactive Tokamak Reactor Radar */}
          <TokamakReactorRadar
            policies={policies}
            selectedPolicyId={selectedPolicyId}
            onSelectPolicy={(id) => setSelectedPolicyId(id)}
          />

          {/* Pull-Payment Beneficiary Ledger */}
          <PullPayoutButton
            account={account}
            onClaimSuccess={fetchAllData}
          />

          {/* Pulse Policies Explorer & Action Bar */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold font-space text-white tracking-tight flex items-center gap-2">
                  <Atom className="w-6 h-6 text-cyan-400" />
                  Fusion Pulse Policies &amp; Confinement Ledgers
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Showing {filteredPolicies.length} of {policies.length} registered experimental pulse runs
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:w-60">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by facility or ID..."
                    className="w-full pl-9 pr-3 py-2 bg-[#0D081B] border border-[#2A1B4E] rounded-xl text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-[#0D081B] p-1 rounded-xl border border-[#2A1B4E] overflow-x-auto text-xs font-mono">
                  {['ALL', 'ACTIVE', 'CERTIFIED', 'PARTIAL', 'QUENCHED', 'DISPUTED'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilterStatus(tab)}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        filterStatus === tab
                          ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchAllData}
                  disabled={refreshing}
                  className="p-2 bg-[#0D081B] border border-[#2A1B4E] hover:border-cyan-500 text-slate-400 hover:text-cyan-400 rounded-xl transition"
                  title="Refresh policies"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Policies Cards Grid */}
            {loading ? (
              <div className="p-16 text-center rounded-3xl bg-[#0D081B] border border-[#2A1B4E]">
                <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-mono text-slate-400">Loading GenLayer StudioNet telemetry...</p>
              </div>
            ) : filteredPolicies.length === 0 ? (
              <div className="p-16 text-center rounded-3xl bg-[#0D081B] border border-[#2A1B4E]">
                <Flame className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold font-space text-white mb-1">No Fusion Policies Found</h3>
                <p className="text-xs text-slate-400 font-mono mb-5">
                  {policies.length === 0
                    ? 'No experimental shot escrows have been created on this contract yet.'
                    : 'No policies match the selected filter criteria.'}
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-space font-bold text-xs tracking-wide shadow-lg shadow-cyan-500/20"
                >
                  <Flame className="w-4 h-4 text-amber-200" />
                  Create First Shot Escrow
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPolicies.map((policy) => (
                  <PolicyCard
                    key={policy.policy_id}
                    policy={policy}
                    account={account}
                    onRefresh={fetchAllData}
                    onSubmitTelemetry={(p) => setTelemetryPolicy(p)}
                    onInspectSpectrometry={(p) => setInspectPolicy(p)}
                    onAppeal={(p) => setAppealPolicy(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-[#2A1B4E] bg-[#04030A] py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>AgentFusionPurity &middot; GenLayer StudioNet (Chain 61999)</span>
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
