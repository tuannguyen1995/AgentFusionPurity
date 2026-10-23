import React, { useState } from 'react';
import {
  Zap,
  Wallet,
  ExternalLink,
  ChevronDown,
  Layers,
  Settings,
  ShieldCheck,
  Radio,
  Check,
  Copy,
} from 'lucide-react';
import {
  STUDIONET_CHAIN_ID,
  STUDIONET_CHAIN_ID_HEX,
  STUDIONET_RPC_URL,
  STUDIO_URL,
  getSavedContractAddress,
  saveContractAddress,
} from '../config/genlayer';
import { formatAddress } from '../utils/formatters';

interface NavbarProps {
  account: string;
  balance: string;
  chainId: number | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onContractAddressChange: (newAddress: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  account,
  balance,
  chainId,
  onConnectWallet,
  onDisconnectWallet,
  onContractAddressChange,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [contractInput, setContractInput] = useState(getSavedContractAddress());
  const [copied, setCopied] = useState(false);

  const isCorrectChain = chainId === STUDIONET_CHAIN_ID;

  const handleSwitchNetwork = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: STUDIONET_CHAIN_ID_HEX,
                chainName: 'GenLayer StudioNet',
                nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
                rpcUrls: [STUDIONET_RPC_URL],
                blockExplorerUrls: [STUDIO_URL],
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add GenLayer StudioNet:', addError);
        }
      }
    }
  };

  const handleSaveContract = () => {
    if (contractInput.trim().startsWith('0x') && contractInput.trim().length === 42) {
      saveContractAddress(contractInput.trim());
      onContractAddressChange(contractInput.trim());
      setShowSettings(false);
    } else {
      alert('Please enter a valid 42-character 0x-prefixed contract address.');
    }
  };

  const handleCopyContract = () => {
    navigator.clipboard.writeText(getSavedContractAddress());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#04030A]/85 border-b border-[#2A1B4E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-400 p-[1.5px] shadow-lg shadow-violet-900/30">
            <div className="w-full h-full bg-[#0D081B] rounded-[10px] flex items-center justify-center">
              <Zap className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-space font-bold text-xl tracking-tight text-white flex items-center gap-1.5">
                Agent<span className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">Fusion</span>Purity
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                <Radio className="w-2.5 h-2.5 animate-ping text-cyan-400" />
                ORACLE v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-wide hidden sm:block">
              Magnetic Confinement Plasma &amp; Tritium Breeding Escrow
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Network Switcher / Badge */}
          {account && (
            <div>
              {isCorrectChain ? (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  StudioNet (61999)
                </div>
              ) : (
                <button
                  onClick={handleSwitchNetwork}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition text-xs font-mono animate-bounce"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Switch to StudioNet
                </button>
              )}
            </div>
          )}

          {/* Contract Config Button */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl bg-[#0D081B] border border-[#2A1B4E] hover:border-cyan-500/50 text-slate-300 hover:text-cyan-400 transition"
              title="Contract Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 p-4 rounded-2xl bg-[#0D081B] border border-[#3D2870] shadow-2xl shadow-violet-950/60 z-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Contract Target
                  </h4>
                  <button
                    onClick={handleCopyContract}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <input
                  type="text"
                  value={contractInput}
                  onChange={(e) => setContractInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#04030A] border border-[#2A1B4E] rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 mb-3"
                  placeholder="0x..."
                />
                <div className="flex justify-between items-center">
                  <a
                    href={`${STUDIO_URL}/address/${getSavedContractAddress()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 font-mono"
                  >
                    Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={handleSaveContract}
                    className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-xs font-medium rounded-lg hover:brightness-110 transition"
                  >
                    Save Address
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Wallet Connection */}
          {!account ? (
            <button
              onClick={onConnectWallet}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-fuchsia-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-medium text-sm transition shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-[#0D081B] border border-[#2A1B4E] rounded-xl p-1.5">
              <div className="px-2.5 py-1 text-xs font-mono text-cyan-400 font-semibold bg-cyan-950/40 rounded-lg border border-cyan-500/20">
                {balance} GEN
              </div>
              <button
                onClick={onDisconnectWallet}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white transition"
                title="Click to disconnect"
              >
                <span>{formatAddress(account, 4)}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
