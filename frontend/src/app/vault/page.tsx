'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useVault, DecryptedCredentialItem } from '@/context/VaultContext';
import CredentialModal from '@/components/vault/CredentialModal';
import PasswordGeneratorModal from '@/components/vault/PasswordGeneratorModal';
import { soundFX } from '@/lib/audio';
import { evaluatePasswordStrength, CredentialPayload } from '@/lib/crypto';
import {
  Shield,
  Lock,
  Unlock,
  Plus,
  Search,
  Star,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  Trash2,
  KeyRound,
  CreditCard,
  FileText,
  Server,
  Wand2,
  Download,
  Upload,
  Clock,
  Eye,
  EyeOff,
  UserCheck,
  LogOut,
  ChevronRight,
  Activity,
  AlertCircle,
  AlertTriangle,
  Volume2,
  VolumeX,
  FileJson,
  X,
  ShieldCheck,
} from 'lucide-react';

export default function VaultPage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isVaultUnlocked,
    credentials,
    isLoading,
    isDecrypting,
    secondsUntilLock,
    activityLogs,
    lockVault,
    logout,
    createCredential,
    updateCredential,
    deleteCredential,
    toggleFavorite,
    logActivity,
  } = useVault();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'login' | 'card' | 'note' | 'server' | 'favorites' | 'weak'>('all');
  
  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DecryptedCredentialItem | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Visible password tracking (per-item ID)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedToast, setCopiedToast] = useState<{ id: string; field: string; time: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Redirect if not unlocked or not logged in
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !isVaultUnlocked)) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, isVaultUnlocked, router]);

  // Audio mute toggle
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFX.isMuted = next;
  };

  // Vault Security Health Audit Calculation
  const securityStats = useMemo(() => {
    let weakCount = 0;
    let strongCount = 0;
    let reusedCount = 0;
    const passMap = new Map<string, number>();

    credentials.forEach((c) => {
      if (c.password) {
        const str = evaluatePasswordStrength(c.password);
        if (str.score < 2) weakCount++;
        if (str.score >= 3) strongCount++;
        passMap.set(c.password, (passMap.get(c.password) || 0) + 1);
      }
    });

    passMap.forEach((count) => {
      if (count > 1) reusedCount += count;
    });

    let score = 100;
    if (credentials.length > 0) {
      score -= weakCount * 18;
      score -= reusedCount * 12;
      score = Math.max(15, Math.min(100, score));
    }

    return {
      score: credentials.length === 0 ? 100 : score,
      weakCount,
      strongCount,
      reusedCount,
      totalPasswords: credentials.filter((c) => !!c.password).length,
    };
  }, [credentials]);

  // Filtered credentials
  const filteredItems = useMemo(() => {
    return credentials.filter((item) => {
      // Weak filter
      if (selectedCategory === 'weak') {
        if (!item.password) return false;
        const str = evaluatePasswordStrength(item.password);
        if (str.score >= 2) return false;
      }
      // Favorites filter
      else if (selectedCategory === 'favorites' && !item.isFavorite) return false;
      // Category filter
      else if (selectedCategory !== 'all' && selectedCategory !== 'favorites' && item.category !== selectedCategory) {
        return false;
      }

      // Search match
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = item.title?.toLowerCase().includes(q);
      const inUsername = item.username?.toLowerCase().includes(q);
      const inUrl = item.url?.toLowerCase().includes(q);
      const inNotes = item.notes?.toLowerCase().includes(q);
      return inTitle || inUsername || inUrl || inNotes;
    });
  }, [credentials, selectedCategory, searchQuery]);

  // Copy to clipboard with auto-clearing toast
  const handleCopy = (text: string, id: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    soundFX.tick();
    setCopiedToast({ id, field, time: 15 });
    logActivity('Secret Copied', `Copied ${field} to clipboard (clearing in 15s)`);

    setTimeout(() => {
      setCopiedToast((prev) => (prev?.id === id && prev?.field === field ? null : prev));
    }, 15000);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = !prev[id];
      if (next) {
        soundFX.tick();
        logActivity('Secret Revealed', `Unhid password for credential entry`);
      }
      return { ...prev, [id]: next };
    });
  };

  // Export encrypted backup
  const handleExportBackup = () => {
    const backupData = {
      vaultVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      userEmail: user?.email,
      totalEntries: credentials.length,
      notice: 'Argus Vault Zero-Knowledge JSON Export',
      items: credentials,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logActivity('Backup Exported', `Exported ${credentials.length} vault entries to JSON`);
    soundFX.accessGranted();
  };

  // Import JSON backup handler
  const handleExecuteImport = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const itemsToImport = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(itemsToImport) || itemsToImport.length === 0) {
        setImportStatus('Error: JSON does not contain a valid array of items.');
        return;
      }

      setImportStatus(`Encrypting and storing ${itemsToImport.length} items...`);
      for (const raw of itemsToImport) {
        const payload: CredentialPayload = {
          title: raw.title || 'Imported Credential',
          category: raw.category || 'general',
          username: raw.username || '',
          password: raw.password || '',
          url: raw.url || '',
          notes: raw.notes || '',
        };
        await createCredential(payload, raw.isFavorite || false);
      }

      setImportStatus(`Successfully imported ${itemsToImport.length} items!`);
      soundFX.accessGranted();
      setTimeout(() => {
        setIsImportOpen(false);
        setImportJsonText('');
        setImportStatus(null);
      }, 1500);
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message}`);
    }
  };

  const formatLockTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading || isDecrypting) {
    return (
      <div className="min-h-screen bg-[#06090e] text-slate-100 flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center animate-spin">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <p className="text-sm text-cyan-300">Decrypting Zero-Knowledge Vault in Client Memory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06090e] bg-cyber-grid text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative">
      {/* Ambient Lighting Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Top Application Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 p-0.5 shadow-md shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                <Shield className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white">ARGUS</span>
              <span className="text-[10px] font-mono ml-1 px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                VAULT
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <Unlock className="w-3.5 h-3.5" />
            <span>Vault Unlocked (AES-256-GCM Active)</span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* Audio FX Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Auto-Lock Indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono transition-colors ${
              secondsUntilLock < 60
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="Time until client memory purges master key"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Lock in: {formatLockTime(secondsUntilLock)}</span>
          </div>

          {/* Admin Session Console Link */}
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-mono transition-colors shadow-sm"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </button>
          )}

          {/* Lock Vault */}
          <button
            type="button"
            onClick={lockVault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 hover:border-amber-500/40 text-xs font-mono transition-colors"
            title="Immediately purges master keys from memory"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock Vault</span>
          </button>

          {/* User Account / Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <span className="text-xs text-slate-400 hidden lg:inline font-mono">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Log out and destroy session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Sidebar: Categories, Health Score, Activity Feed */}
        <aside className="md:col-span-4 lg:col-span-3 space-y-5">
          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsCreateOpen(true);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-semibold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>NEW SECURE ITEM</span>
          </button>

          {/* Security Health Score Widget */}
          <div className="vault-panel rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Vault Health
              </span>
              <strong
                className={`${
                  securityStats.score > 80
                    ? 'text-emerald-400'
                    : securityStats.score > 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {securityStats.score}/100
              </strong>
            </div>

            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  securityStats.score > 80
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                    : securityStats.score > 50
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${securityStats.score}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1 text-slate-400">
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Strong:</span>
                <span className="text-emerald-400 font-bold">{securityStats.strongCount} items</span>
              </div>
              <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">Weak/Reused:</span>
                <span className={securityStats.weakCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  {securityStats.weakCount + securityStats.reusedCount} items
                </span>
              </div>
            </div>
          </div>

          {/* Category Filter List */}
          <div className="vault-panel rounded-2xl p-2.5 space-y-1">
            {[
              { id: 'all', label: 'All Items', icon: Shield, count: credentials.length },
              { id: 'favorites', label: 'Favorites', icon: Star, count: credentials.filter((c) => c.isFavorite).length },
              { id: 'weak', label: 'Weak Passwords', icon: AlertTriangle, count: securityStats.weakCount },
              { id: 'login', label: 'Logins', icon: KeyRound, count: credentials.filter((c) => c.category === 'login').length },
              { id: 'card', label: 'Payment Cards', icon: CreditCard, count: credentials.filter((c) => c.category === 'card').length },
              { id: 'note', label: 'Secure Notes', icon: FileText, count: credentials.filter((c) => c.category === 'note').length },
              { id: 'server', label: 'Servers & Keys', icon: Server, count: credentials.filter((c) => c.category === 'server').length },
            ].map((cat) => {
              const Icon = cat.icon;
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-md shadow-cyan-500/10 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{cat.label}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 text-slate-500">
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Tools Box */}
          <div className="vault-panel rounded-2xl p-3.5 space-y-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
              Vault Utilities
            </span>
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs transition-colors border border-slate-800 hover:border-emerald-500/30"
            >
              <Wand2 className="w-4 h-4 text-emerald-400" />
              <span>Password Generator</span>
            </button>
            <button
              type="button"
              onClick={handleExportBackup}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs transition-colors border border-slate-800 hover:border-cyan-500/30"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export Encrypted JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs transition-colors border border-slate-800 hover:border-purple-500/30"
            >
              <Upload className="w-4 h-4 text-purple-400" />
              <span>Restore Backup (Import)</span>
            </button>
          </div>

          {/* Inline Activity Log / Audit Feed */}
          <div className="vault-panel rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-2 text-xs font-mono text-slate-400">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inline Activity Stream</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-[11px]">
              {activityLogs.length === 0 ? (
                <p className="text-slate-600 font-mono text-center py-4">No recent activity</p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="p-2 rounded bg-slate-900/70 border border-slate-800/60 font-mono">
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span>{log.action}</span>
                      <span className="text-slate-600 text-[10px]">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-500 text-[10px] truncate mt-0.5">{log.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Right Main Panel: Search Bar & Decrypted Item Grid */}
        <main className="md:col-span-8 lg:col-span-9 space-y-4">
          {/* Search Bar & Stats Header */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search credentials, usernames, URLs, or notes..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-slate-600 text-xs font-sans focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="text-xs font-mono text-slate-500 shrink-0 self-center">
              Displaying <strong className="text-slate-300">{filteredItems.length}</strong> of{' '}
              <strong className="text-slate-300">{credentials.length}</strong> items
            </div>
          </div>

          {/* Zero-Knowledge Security Notice Pill */}
          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-cyan-300 text-xs flex items-center gap-2.5">
            <Shield className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>
              All entries below are decrypted purely in client memory using your Master Key. Database stores only raw
              AES-256-GCM ciphertext blobs.
            </span>
          </div>

          {/* Credentials Grid / Cards */}
          {filteredItems.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center bg-slate-950/40">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500 mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">No credentials found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                {searchQuery
                  ? 'No matching entries found for your query. Try searching for something else.'
                  : 'Your vault is empty. Secure your first set of credentials with client-side encryption.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsCreateOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Item</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredItems.map((item) => {
                const isRevealed = !!revealedIds[item.id];
                const isPassCopied = copiedToast?.id === item.id && copiedToast?.field === 'password';
                const isUserCopied = copiedToast?.id === item.id && copiedToast?.field === 'username';
                const str = item.password ? evaluatePasswordStrength(item.password) : null;

                return (
                  <div
                    key={item.id}
                    className="group vault-panel rounded-2xl p-4 transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Category Icon + Title + Username */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-cyan-400">
                          {item.category === 'login' && <KeyRound className="w-5 h-5" />}
                          {item.category === 'card' && <CreditCard className="w-5 h-5 text-amber-400" />}
                          {item.category === 'note' && <FileText className="w-5 h-5 text-emerald-400" />}
                          {item.category === 'server' && <Server className="w-5 h-5 text-purple-400" />}
                          {item.category === 'general' && <Lock className="w-5 h-5 text-slate-400" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-slate-100">{item.title}</h3>
                            <button
                              type="button"
                              onClick={() => toggleFavorite(item.id)}
                              className="text-slate-600 hover:text-amber-400 transition-colors"
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  item.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                                }`}
                              />
                            </button>
                            {str && str.score < 2 && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                Weak
                              </span>
                            )}
                          </div>

                          {item.username && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-400 font-mono">{item.username}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.username!, item.id, 'username')}
                                className="text-slate-600 hover:text-slate-300 p-0.5"
                                title="Copy username"
                              >
                                {isUserCopied ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}

                          {item.url && (
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-cyan-500 hover:text-cyan-400">
                              <a
                                href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 font-mono hover:underline truncate max-w-xs"
                              >
                                <span>{item.url.replace(/^https?:\/\//, '')}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Secret & Password Controls */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {item.password && (
                          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 font-mono text-xs">
                            <span className="w-28 truncate text-slate-300">
                              {isRevealed ? item.password : '••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleReveal(item.id)}
                              className="p-1 text-slate-500 hover:text-slate-300 ml-1"
                              title={isRevealed ? 'Hide' : 'Reveal'}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.password!, item.id, 'password')}
                              className="p-1 text-slate-500 hover:text-emerald-400 ml-1"
                              title="Copy password"
                            >
                              {isPassCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Edit & Delete Action Buttons */}
                        <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsCreateOpen(true);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                            title="Edit credential"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
                                deleteCredential(item.id);
                              }
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete credential"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Notes Section if present */}
                    {item.notes && (
                      <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400 font-mono bg-slate-950/40 p-2.5 rounded-lg whitespace-pre-wrap">
                        {item.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Floating Auto-Clear Clipboard Notification */}
      {copiedToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl flex flex-col gap-2 font-mono text-xs text-slate-200 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Copied {copiedToast.field} to clipboard!</span>
          </div>
          <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 animate-[pulse_1s_infinite] w-full" />
          </div>
          <span className="text-[10px] text-slate-500">Auto-clearing clipboard buffer for security.</span>
        </div>
      )}

      {/* Add / Edit Credential Modal */}
      <CredentialModal
        isOpen={isCreateOpen}
        item={editingItem}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingItem(null);
        }}
        onSave={async (payload, isFavorite) => {
          if (editingItem) {
            await updateCredential(editingItem.id, payload, isFavorite);
          } else {
            await createCredential(payload, isFavorite);
          }
        }}
      />

      {/* Standalone Password Generator Modal */}
      <PasswordGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
      />

      {/* Backup Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-sm text-slate-100">Restore Vault Backup (JSON)</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportOpen(false);
                  setImportStatus(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-400 font-mono">
                Paste your previously exported Argus Vault JSON backup below. All items will be re-encrypted using your
                current master key prior to storage.
              </p>
              <textarea
                rows={6}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='Paste JSON backup here... {"items": [...]}'
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
              />
              {importStatus && (
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono">
                  {importStatus}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={!importJsonText.trim()}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-all disabled:opacity-50"
              >
                Import & Re-Encrypt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
