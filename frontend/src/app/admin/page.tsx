'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useVault } from '@/context/VaultContext';
import { adminApi, AdminStats, SessionAuditRecord } from '@/lib/api';
import {
  Shield,
  ShieldAlert,
  Users,
  Activity,
  UserX,
  Database,
  Search,
  RefreshCw,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Globe,
  Clock,
  Lock,
  Download,
  FileSpreadsheet,
  FileJson,
  Radio,
  MapPin,
  Trash2,
  Laptop,
  Smartphone,
} from 'lucide-react';

export default function AdminConsolePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useVault();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sessions, setSessions] = useState<SessionAuditRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsData, sessionsData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getSessions({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchQuery || undefined,
        }),
      ]);
      setStats(statsData);
      setSessions(sessionsData);
    } catch (err: any) {
      console.error('Failed to load admin telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
      return;
    }
    fetchData();
  }, [authLoading, isAuthenticated, user, fetchData]);

  // Live Telemetry Auto-refresh interval (every 12 seconds)
  useEffect(() => {
    if (!autoRefresh || !isAuthenticated || user?.role !== 'admin') return;
    const interval = setInterval(() => {
      fetchData();
    }, 12000);
    return () => clearInterval(interval);
  }, [autoRefresh, isAuthenticated, user, fetchData]);

  const handleRevoke = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to forcibly terminate the session for ${email}?`)) {
      return;
    }

    setRevokingId(id);
    try {
      await adminApi.revokeSession(id);
      setActionMessage(`Session for ${email} was terminated.`);
      await fetchData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(`Failed to revoke session: ${err.message}`);
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    const activeOther = sessions.filter(
      (s) => s.status === 'active' && s.user_email !== user?.email
    );
    if (activeOther.length === 0) {
      alert('No other active user sessions found.');
      return;
    }
    if (!confirm(`Revoke all ${activeOther.length} other active user session(s)?`)) {
      return;
    }

    setIsLoading(true);
    try {
      for (const sess of activeOther) {
        await adminApi.revokeSession(sess.id);
      }
      setActionMessage(`Successfully revoked ${activeOther.length} active session(s).`);
      await fetchData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      alert(`Error revoking sessions: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const exportJSON = () => {
    const data = {
      system: 'Argus Vault Enterprise Telemetry',
      exported_at: new Date().toISOString(),
      stats,
      sessions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus-vault-session-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['User Email', 'Device Info', 'IP Address', 'Location', 'Session Key Hash', 'Login Time', 'Status'];
    const rows = sessions.map((s) => [
      `"${s.user_email}"`,
      `"${s.device_info || 'Desktop Browser'}"`,
      `"${s.ip_address || '127.0.0.1'}"`,
      `"${getLocationName(s.ip_address)}"`,
      `"${s.masked_session_key}"`,
      `"${s.login_time}"`,
      `"${s.status}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus-vault-session-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLocationName = (ip?: string | null): string => {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return 'Local Enclave (Subnet)';
    }
    const locations = [
      'US-East (Virginia)',
      'US-West (Oregon)',
      'EU-Central (Frankfurt)',
      'EU-West (London)',
      'AP-South (Mumbai)',
      'AP-Northeast (Tokyo)',
    ];
    let hash = 0;
    for (let i = 0; i < ip.length; i++) hash += ip.charCodeAt(i);
    return locations[hash % locations.length];
  };

  // Access control boundary check
  if (!authLoading && (!isAuthenticated || user?.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-[#070a10] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-100 mb-2 font-mono">
            ACCESS DENIED • ROLE RESTRICTION
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            The Admin Session-Audit Console requires elevated administrative privileges.
            Your account ({user?.email || 'Guest'}) does not possess the <code>role=&quot;admin&quot;</code> flag.
          </p>
          <button
            type="button"
            onClick={() => router.push(isAuthenticated ? '/vault' : '/')}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
          >
            Return to Personal Vault
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06090e] bg-cyber-grid text-slate-100 flex flex-col font-sans selection:bg-purple-500/30 selection:text-purple-200 relative">
      {/* Ambient Lighting Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => router.push('/vault')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Back to Vault"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 p-0.5 shadow-md shadow-purple-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-sm tracking-tight text-white">ARGUS</span>
                <span className="text-[9px] sm:text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ADMIN CONSOLE
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-500 hidden xs:block">Session Telemetry & Access Control</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono transition-all ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Auto-refresh telemetry feed"
          >
            <Radio className={`w-3 h-3 ${autoRefresh ? 'animate-pulse text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">{autoRefresh ? 'LIVE SYNC (12s)' : 'PAUSED'}</span>
          </button>

          {/* Sync Button */}
          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-mono transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <div className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20 hidden md:inline">
            Admin: {user?.email}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Banner Action Message */}
        {actionMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Aggregate Stats Cards (2x2 on mobile, 4 columns on desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-2xl vault-panel shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-mono">Total Users</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-100">
              {stats?.total_users ?? '—'}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 mt-1">
              {stats?.standard_users ?? 0} usr • {stats?.admin_users ?? 0} adm
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl vault-panel shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-mono">Active Sessions</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
              {stats?.active_sessions ?? '—'}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 mt-1">
              Live authenticated connections
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl vault-panel shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-mono">Revoked Sessions</span>
              <UserX className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400">
              {stats?.revoked_sessions ?? '—'}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 mt-1">
              Remotely killed tokens
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl vault-panel shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-xs font-mono">Encrypted Records</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-purple-400">
              {stats?.total_vault_items ?? '—'}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 mt-1">
              Zero-knowledge blobs
            </div>
          </div>
        </div>

        {/* Cryptographic Zero-Knowledge Notice */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/30 via-slate-950 to-indigo-950/20 border border-purple-800/40 text-xs text-slate-300 flex items-start gap-3">
          <Shield className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-purple-300 font-mono block">Zero-Knowledge Administrative Boundary:</strong>
            <p className="text-slate-400">
              This console provides operational telemetry and active session revocation capabilities.
              Under Argus Vault&apos;s zero-knowledge security guarantees, administrators <strong>NEVER</strong> have access to
              user encryption keys, ciphertext blobs, or plaintext passwords. All secret material is encrypted client-side
              via Web Crypto prior to transmission.
            </p>
          </div>
        </div>

        {/* Search, Action Tools & Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search session by email or IP address..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 text-xs font-sans focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 shrink-0 text-xs font-mono">
              {(['all', 'active', 'revoked'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    statusFilter === filter
                      ? 'bg-slate-800 text-purple-300 border border-purple-500/30 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Revoke All Other Sessions */}
            <button
              type="button"
              onClick={handleRevokeAllOtherSessions}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-mono transition-all hover:scale-105 active:scale-95"
              title="Forcibly terminate all active user sessions except this current administrator session"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Revoke All Other</span>
            </button>

            {/* Export CSV & JSON */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                type="button"
                onClick={exportCSV}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Export session audit to CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={exportJSON}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Export session audit to JSON"
              >
                <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Session Table */}
        <div className="vault-panel rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60 font-mono text-slate-400">
                  <th className="py-3 px-4">User Account</th>
                  <th className="py-3 px-4">Device & OS</th>
                  <th className="py-3 px-4">IP & Geolocation</th>
                  <th className="py-3 px-4">Session Hash</th>
                  <th className="py-3 px-4">Login Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No sessions found matching current filter
                    </td>
                  </tr>
                ) : (
                  sessions.map((sess) => {
                    const isMobile = (sess.device_info || '').toLowerCase().includes('mobile') || (sess.device_info || '').toLowerCase().includes('android') || (sess.device_info || '').toLowerCase().includes('iphone');
                    const loc = getLocationName(sess.ip_address);

                    return (
                      <tr
                        key={sess.id}
                        className="hover:bg-slate-900/40 transition-colors text-slate-300"
                      >
                        <td className="py-3.5 px-4 font-sans font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <span>{sess.user_email}</span>
                            {sess.user_email === user?.email && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-mono">
                                YOU
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 text-slate-400">
                            {isMobile ? (
                              <Smartphone className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                            ) : (
                              <Laptop className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            )}
                            <span className="truncate max-w-[150px]">{sess.device_info || 'Desktop Browser'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <Globe className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span>{sess.ip_address || '127.0.0.1'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                              <MapPin className="w-3 h-3 text-cyan-500" />
                              <span>{loc}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          <code>{sess.masked_session_key}</code>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          {new Date(sess.login_time).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                              sess.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : sess.status === 'revoked'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                sess.status === 'active'
                                  ? 'bg-emerald-400 animate-pulse'
                                  : sess.status === 'revoked'
                                  ? 'bg-rose-400'
                                  : 'bg-slate-500'
                              }`}
                            />
                            <span>{sess.status}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {sess.status === 'active' ? (
                            <button
                              type="button"
                              disabled={revokingId === sess.id}
                              onClick={() => handleRevoke(sess.id, sess.user_email)}
                              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-medium transition-all shadow-sm hover:shadow-rose-500/10 disabled:opacity-50"
                            >
                              {revokingId === sess.id ? 'Terminating...' : 'Revoke Session'}
                            </button>
                          ) : (
                            <span className="text-slate-600 text-[11px]">Terminated</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
