import React, { useState, useEffect } from 'react';
import { DownloadCloud, CheckCircle2, AlertCircle, RefreshCw, Wallet } from 'lucide-react';
import {
  readContract,
  encodeCalldata,
  waitForTransactionReceipt,
  getSavedContractAddress,
} from '../config/genlayer';
import { formatGen } from '../utils/formatters';

interface PullPayoutButtonProps {
  account: string;
  onClaimSuccess: () => void;
}

export const PullPayoutButton: React.FC<PullPayoutButtonProps> = ({
  account,
  onClaimSuccess,
}) => {
  const [claimable, setClaimable] = useState<string>('0');
  const [withdrawn, setWithdrawn] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadBalances = async () => {
    if (!account) return;
    try {
      setFetching(true);
      const c = await readContract('get_claimable_balance', [account]);
      const w = await readContract('get_total_withdrawn', [account]);
      setClaimable(String(c || '0'));
      setWithdrawn(String(w || '0'));
    } catch (err) {
      console.warn('Error reading claimable balance:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadBalances();
    const interval = setInterval(loadBalances, 12000);
    return () => clearInterval(interval);
  }, [account]);

  const handleClaim = async () => {
    if (!account) return;
    setError(null);
    setSuccessMsg(null);

    try {
      setLoading(true);
      const contractAddress = getSavedContractAddress();
      const calldata = encodeCalldata('claim_payout', []);

      const txHash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: contractAddress,
            data: calldata,
          },
        ],
      });

      console.log('Claim payout tx submitted:', txHash);
      await waitForTransactionReceipt(txHash);

      setSuccessMsg('Successfully claimed accrued fusion subsidies!');
      await loadBalances();
      onClaimSuccess();
    } catch (err: any) {
      console.error('Claim error:', err);
      setError(err?.message || 'Failed to claim balance.');
    } finally {
      setLoading(false);
    }
  };

  const hasClaimable = BigInt(claimable || '0') > 0n;

  return (
    <div className="p-5 rounded-2xl bg-[#0D081B] border border-[#2A1B4E] shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold font-space text-white">Pull-Payment Beneficiary Ledger</h4>
            <button
              onClick={loadBalances}
              disabled={fetching}
              className="text-slate-400 hover:text-cyan-400 p-1"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3 h-3 ${fetching ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Pure pull-payment architecture eliminates reentrancy &amp; guarantees safe escrow disbursements.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="font-mono text-right">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Claimable Balance</div>
            <div className="text-xl font-bold text-cyan-400">
              {formatGen(claimable)} <span className="text-xs text-slate-400">GEN</span>
            </div>
          </div>

          <div className="font-mono text-right hidden md:block">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Total Withdrawn</div>
            <div className="text-sm font-semibold text-slate-300">
              {formatGen(withdrawn)} <span className="text-xs text-slate-400">GEN</span>
            </div>
          </div>

          <button
            onClick={handleClaim}
            disabled={!hasClaimable || loading}
            className={`px-5 py-2.5 rounded-xl font-space font-bold text-xs tracking-wide transition flex items-center gap-2 ${
              hasClaimable && !loading
                ? 'bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white shadow-lg shadow-cyan-500/25 active:scale-95'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <DownloadCloud className="w-3.5 h-3.5" />
                Claim Payout
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
};
