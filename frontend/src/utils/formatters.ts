export function formatGen(val: string | number | bigint | undefined | null): string {
  if (val === undefined || val === null) return '0.000';
  try {
    let big: bigint;
    if (typeof val === 'string') {
      if (val.startsWith('0x') || val.startsWith('0X')) {
        big = BigInt(val);
      } else {
        big = BigInt(val.trim() || '0');
      }
    } else {
      big = BigInt(val);
    }
    const divisor = 10n ** 18n;
    const whole = big / divisor;
    const remainder = big % divisor;
    const remStr = remainder.toString().padStart(18, '0').slice(0, 3);
    return `${whole}.${remStr}`;
  } catch {
    return '0.000';
  }
}

export function formatAddress(addr: string | undefined | null, chars = 4): string {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return 'None / System';
  const clean = addr.toLowerCase().trim();
  if (clean.length < chars * 2 + 2) return clean;
  return `${clean.slice(0, chars + 2)}...${clean.slice(-chars)}`;
}

export function formatTimestamp(ts: string | number | bigint | undefined | null): string {
  if (!ts) return 'N/A';
  try {
    const num = Number(ts);
    if (isNaN(num) || num <= 0) return 'N/A';
    const date = new Date(num * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return 'N/A';
  }
}

export function formatQFactor(bps: number): string {
  if (!bps || bps <= 0) return '0.00 Q';
  const q = bps / 1000;
  return `Q = ${q.toFixed(2)}`;
}

export function formatTBR(bps: number): string {
  if (!bps || bps <= 0) return '0.00 TBR';
  const tbr = bps / 100;
  return `TBR = ${tbr.toFixed(2)}`;
}

export function formatConfinement(ms: number): string {
  if (!ms || ms <= 0) return '0 ms';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  return `${ms} ms`;
}

export function getStatusLabel(status: number): {
  label: string;
  bg: string;
  text: string;
  border: string;
  glow: string;
} {
  switch (status) {
    case 0:
      return {
        label: 'POLICY OPEN',
        bg: 'bg-cyan-950/40',
        text: 'text-cyan-400',
        border: 'border-cyan-500/40',
        glow: 'shadow-[0_0_12px_rgba(6,182,212,0.25)]',
      };
    case 1:
      return {
        label: 'TELEMETRY SUBMITTED',
        bg: 'bg-violet-950/40',
        text: 'text-violet-300',
        border: 'border-violet-500/40',
        glow: 'shadow-[0_0_12px_rgba(139,92,246,0.25)]',
      };
    case 2:
      return {
        label: 'AWAITING PAYOUT (COOLING-OFF)',
        bg: 'bg-amber-950/40',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        glow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
      };
    case 3:
      return {
        label: 'FUSION Q-NET CERTIFIED (100% DISBURSED)',
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]',
      };
    case 4:
      return {
        label: 'PARTIAL CONFINEMENT (40% RELEASED)',
        bg: 'bg-amber-950/40',
        text: 'text-amber-300',
        border: 'border-amber-500/40',
        glow: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]',
      };
    case 5:
      return {
        label: 'PLASMA DISRUPTION QUENCH (REFUNDED)',
        bg: 'bg-red-950/40',
        text: 'text-red-400',
        border: 'border-red-500/40',
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]',
      };
    case 6:
      return {
        label: 'DISPUTE UNDER APPEAL',
        bg: 'bg-fuchsia-950/40',
        text: 'text-fuchsia-400',
        border: 'border-fuchsia-500/40',
        glow: 'shadow-[0_0_12px_rgba(217,70,239,0.3)]',
      };
    case 7:
      return {
        label: 'EXPIRED & RECLAIMED',
        bg: 'bg-slate-900/60',
        text: 'text-slate-400',
        border: 'border-slate-700/50',
        glow: '',
      };
    case 8:
      return {
        label: 'STATUS UNRESOLVED (PROTECTED)',
        bg: 'bg-orange-950/50',
        text: 'text-orange-400',
        border: 'border-orange-500/40',
        glow: 'shadow-[0_0_12px_rgba(249,115,22,0.3)]',
      };
    default:
      return {
        label: 'UNKNOWN',
        bg: 'bg-slate-900',
        text: 'text-slate-400',
        border: 'border-slate-800',
        glow: '',
      };
  }
}
