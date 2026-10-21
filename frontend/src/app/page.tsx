'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useVault } from '@/context/VaultContext';
import VaultDoorContainer from '@/components/vault3d/VaultDoorContainer';
import { soundFX } from '@/lib/audio';
import {
  Shield,
  Lock,
  KeyRound,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Terminal,
  Activity,
  Zap,
  Bomb,
  RotateCcw,
  Flame,
  ShieldAlert,
  Volume2,
  VolumeX,
  Sparkles,
  Wrench,
  Radio,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, isVaultUnlocked, login, register, error, clearError } = useVault();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // 3D Vault Door Animation State
  const [vaultStatus, setVaultStatus] = useState<'idle' | 'typing' | 'unlocking' | 'unlocked' | 'rejecting' | 'destroyed'>('idle');
  const [typingCount, setTypingCount] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security Defense: Failed Attempts & Self-Destruction
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockdown, setIsLockdown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(30);
  const [isBlastFlash, setIsBlastFlash] = useState(false);
  const [isConcussiveShake, setIsConcussiveShake] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairStep, setRepairStep] = useState(0);

  // If already unlocked, redirect to vault
  useEffect(() => {
    if (isVaultUnlocked) {
      router.push('/vault');
    }
  }, [isVaultUnlocked, router]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFX.isMuted = next;
  };

  // Handle password typing to spin dial & play tactile tick
  const handlePasswordChange = (val: string) => {
    setMasterPassword(val);
    setTypingCount((c) => c + 1);
    soundFX.tick();

    if (vaultStatus !== 'destroyed' && vaultStatus !== 'unlocking') {
      setVaultStatus('typing');
      const timeout = setTimeout(() => {
        setVaultStatus((prev) => (prev === 'typing' ? 'idle' : prev));
      }, 1200);
      return () => clearTimeout(timeout);
    }
  };

  // Cooldown timer during lockdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLockdown && cooldownSeconds > 0) {
      timer = setInterval(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLockdown, cooldownSeconds]);

  // Trigger catastrophic blast effect
  const triggerCatastrophicBlast = () => {
    soundFX.selfDestruct();
    setVaultStatus('destroyed');
    setIsLockdown(true);
    setCooldownSeconds(30);
    setIsBlastFlash(true);
    setIsConcussiveShake(true);

    setTimeout(() => setIsBlastFlash(false), 700);
    setTimeout(() => setIsConcussiveShake(false), 900);

    setLocalError('CRITICAL BREACH: 3/3 FAILED ATTEMPTS. VAULT HYDRAULICS DETONATED & DESTROYED.');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockdown) return;

    clearError();
    setLocalError(null);

    if (activeTab === 'register' && masterPassword !== confirmPassword) {
      soundFX.accessDenied();
      setLocalError('Master passwords do not match.');
      setVaultStatus('rejecting');
      setTimeout(() => setVaultStatus('idle'), 1500);
      return;
    }

    if (masterPassword.length < 8) {
      soundFX.accessDenied();
      setLocalError('Master password must be at least 8 characters.');
      setVaultStatus('rejecting');
      setTimeout(() => setVaultStatus('idle'), 1500);
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === 'login') {
        await login(email, masterPassword);
      } else {
        await register(email, masterPassword, fullName);
      }

      // --- SUCCESS: CORRECT PASSWORD ---
      soundFX.accessGranted();
      setTimeout(() => soundFX.mechanicalUnlock(), 850);
      setFailedAttempts(0);

      // Trigger Green Light Blinking + Door Open sequence!
      setVaultStatus('unlocking');
    } catch (err: any) {
      // --- FAILURE: WRONG PASSWORD ---
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);

      if (nextFailures < 3) {
        soundFX.accessDenied();
        setVaultStatus('rejecting');
        setLocalError(
          `Authentication Rejected! [Attempt ${nextFailures}/3]. WARNING: 3 consecutive failures will trigger Vault Self-Destruction.`
        );

        setTimeout(() => {
          if (vaultStatus !== 'destroyed') {
            setVaultStatus('idle');
          }
        }, 2500);
      } else {
        // --- 3RD FAILURE: SPECTACULAR VAULT BLAST & SELF-DESTRUCT ---
        triggerCatastrophicBlast();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlockSequenceComplete = () => {
    router.push('/vault');
  };

  // Cinematic Reverse-Reconstruction & Repair Protocol
  const handleEmergencyReset = () => {
    if (isRepairing) return;
    setIsRepairing(true);
    setRepairStep(1);
    soundFX.repairSequence();

    const t1 = setTimeout(() => setRepairStep(2), 300);
    const t2 = setTimeout(() => setRepairStep(3), 600);
    const t3 = setTimeout(() => {
      setRepairStep(4);
      setFailedAttempts(0);
      setIsLockdown(false);
      setCooldownSeconds(30);
      setVaultStatus('idle');
      setLocalError(null);
      setMasterPassword('');
      setIsRepairing(false);
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  return (
    <div
      className={`min-h-screen bg-[#06090e] bg-cyber-grid text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200 relative ${
        isConcussiveShake ? 'animate-blast-impact' : ''
      }`}
    >
      {/* Blinding Nuclear Screen Flash & Shockwave Vignette on Blast Detonation */}
      {isBlastFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-white/95 animate-[ping_0.6s_ease-out]" />
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-amber-600/40 to-rose-950/80" />
        </div>
      )}

      {/* Ambient Lighting Orbs */}
      <div
        className={`absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[140px] pointer-events-none transition-colors duration-700 ${
          vaultStatus === 'destroyed'
            ? 'bg-rose-600/45'
            : vaultStatus === 'rejecting'
            ? 'bg-rose-500/25'
            : vaultStatus === 'unlocking'
            ? 'bg-emerald-500/25'
            : 'bg-cyan-500/10'
        }`}
      />
      <div
        className={`absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full blur-[140px] pointer-events-none transition-colors duration-700 ${
          vaultStatus === 'destroyed'
            ? 'bg-orange-600/45'
            : vaultStatus === 'unlocking'
            ? 'bg-emerald-400/20'
            : 'bg-emerald-500/10'
        }`}
      />

      {/* Top Telemetry Classification Strip */}
      <div
        className={`w-full border-b px-6 py-1.5 flex items-center justify-between text-[11px] font-mono z-30 transition-colors duration-500 ${
          vaultStatus === 'destroyed'
            ? 'bg-rose-950/95 border-rose-600 text-rose-300'
            : 'bg-slate-950/90 border-slate-800/80 text-slate-400'
        }`}
      >
        <div className="flex items-center gap-3">
          {vaultStatus === 'destroyed' ? (
            <span className="flex items-center gap-1.5 text-rose-400 font-bold animate-pulse">
              <Flame className="w-3.5 h-3.5" />
              STATUS: CATASTROPHIC BREACH // LOCKDOWN ACTIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              SYS_ONLINE
            </span>
          )}
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400">CIPHER: AES-256-GCM</span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">ZERO-KNOWLEDGE STORAGE</span>
        </div>

        {/* Failed Attempts Counter & Sound Toggle */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors"
            title={isMuted ? 'Unmute Audio FX' : 'Mute Audio FX'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span className="hidden sm:inline">{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
          </button>

          <div className="flex items-center gap-1 font-mono text-[10px]">
            <span className="text-slate-500">DEFENSE:</span>
            <div className="flex gap-1 ml-1">
              {[1, 2, 3].map((step) => {
                const filled = failedAttempts >= step;
                return (
                  <span
                    key={step}
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[9px] border transition-all ${
                      filled
                        ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                        : 'bg-slate-900 text-slate-600 border-slate-800'
                    }`}
                  >
                    {step}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top Navbar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-emerald-500 to-cyan-600 p-0.5 shadow-lg shadow-cyan-500/25">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-xl text-white">ARGUS</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-widest bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                VAULT
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400">Interactive 3D Steel Vault • Client-Side Zero-Knowledge</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>PBKDF2 (100k It.)</span>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 text-emerald-400">
            <Zap className="w-3.5 h-3.5" />
            <span>Client Decrypted</span>
          </div>
        </div>
      </header>

      {/* Main Hero & Split Interactive Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Column: Interactive 3D Vault Door */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative min-h-[460px] sm:min-h-[540px]">
          {/* Ambient Glow Disk Behind Door */}
          <div
            className={`absolute w-[380px] h-[380px] sm:w-[480px] sm:h-[480px] blur-2xl pointer-events-none rounded-full transition-all duration-700 ${
              vaultStatus === 'destroyed'
                ? 'bg-rose-600/50 scale-125'
                : vaultStatus === 'rejecting'
                ? 'bg-rose-500/30'
                : vaultStatus === 'unlocking'
                ? 'bg-emerald-500/30 scale-105'
                : 'bg-gradient-to-tr from-cyan-500/15 via-emerald-500/10 to-transparent'
            }`}
          />

          {/* 3D Vault Door Assembly */}
          <div className="w-full h-full flex items-center justify-center">
            <VaultDoorContainer
              status={vaultStatus}
              typingCharCount={typingCount}
              failedAttempts={failedAttempts}
              onUnlockComplete={handleUnlockSequenceComplete}
            />
          </div>

          {/* Status Label Under Vault Door */}
          <div className="mt-3 text-center">
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono backdrop-blur-md shadow-lg transition-all ${
                vaultStatus === 'destroyed'
                  ? 'bg-rose-950/95 border-rose-500 text-rose-300 font-bold animate-pulse shadow-rose-900/50'
                  : vaultStatus === 'rejecting'
                  ? 'bg-rose-950/90 border-rose-500 text-rose-400 font-bold animate-shake'
                  : vaultStatus === 'unlocking'
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 font-bold'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400'
              }`}
            >
              {vaultStatus === 'typing' && (
                <span className="text-cyan-400 flex items-center gap-1.5 animate-pulse font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Combination Dial Rotating • Deriving Key in Memory...
                </span>
              )}
              {vaultStatus === 'rejecting' && (
                <span className="text-rose-400 flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 animate-ping" />
                  RED LIGHT BLINKING // ACCESS DENIED // ATTEMPTS: {failedAttempts}/3
                </span>
              )}
              {vaultStatus === 'unlocking' && (
                <span className="text-emerald-300 flex items-center gap-1.5 font-bold animate-pulse">
                  <CheckCircle2 className="w-4 h-4" />
                  GREEN LIGHT CONFIRMED • BOLTS RETRACTED • DOOR OPENING...
                </span>
              )}
              {vaultStatus === 'destroyed' && (
                <span className="text-rose-300 flex items-center gap-1.5 font-bold">
                  <Bomb className="w-4 h-4 animate-bounce" />
                  3 CONSECUTIVE FAILURES • VAULT BLAST DETONATED // EMERGENCY LOCKDOWN
                </span>
              )}
              {vaultStatus === 'idle' && (
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Machined Steel Door • Enter Master Password to Disengage
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: High-Security Terminal Form */}
        <div className="lg:col-span-5 flex justify-center">
          <div
            className={`w-full max-w-md vault-panel tactical-bracket rounded-2xl p-6 sm:p-8 relative overflow-hidden transition-all duration-500 ${
              isLockdown ? 'border-rose-600 shadow-[0_0_70px_rgba(244,63,94,0.45)]' : ''
            }`}
          >
            {/* Top Glowing Accent Line */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 transition-colors duration-500 ${
                isLockdown
                  ? 'bg-rose-600 glow-rose animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 glow-cyan'
              }`}
            />

            {/* Form Mode Selector */}
            <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800/80 mb-6 shadow-inner">
              <button
                type="button"
                disabled={isLockdown}
                onClick={() => {
                  setActiveTab('login');
                  clearError();
                  setLocalError(null);
                }}
                className={`flex-1 py-2 text-xs font-mono font-medium rounded-lg transition-all ${
                  activeTab === 'login'
                    ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-md shadow-cyan-500/10 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Unlock Vault
              </button>
              <button
                type="button"
                disabled={isLockdown}
                onClick={() => {
                  setActiveTab('register');
                  clearError();
                  setLocalError(null);
                }}
                className={`flex-1 py-2 text-xs font-mono font-medium rounded-lg transition-all ${
                  activeTab === 'register'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 shadow-md shadow-emerald-500/10 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create New Vault
              </button>
            </div>

            {/* Error / Alert Banner */}
            {(error || localError) && (
              <div
                className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  vaultStatus === 'destroyed'
                    ? 'bg-rose-950/80 border-rose-600 text-rose-200 font-bold animate-pulse'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-shake'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{localError || error}</span>
              </div>
            )}

            {/* LOCKDOWN VIEW (Shown when Vault is Destroyed on 3rd Failed Attempt) */}
            {isLockdown ? (
              <div className="py-2 text-center space-y-4 animate-in fade-in duration-300">
                {/* Warning Hazard Ribbon */}
                <div className="w-full h-3 rounded-full bg-hazard-stripes border border-rose-600/50 mb-1" />

                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border-2 border-rose-500/50 flex items-center justify-center text-rose-500 mx-auto animate-bounce shadow-[0_0_35px_rgba(244,63,94,0.4)]">
                  <ShieldAlert className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-rose-400 font-mono tracking-wider uppercase">
                    CATASTROPHIC VAULT BLAST // LOCKDOWN
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    3 consecutive invalid password attempts detected. The radial locking pins have detonated, hinges sheared, and cryptographic keys zeroized.
                  </p>
                </div>

                {/* Diagnostics Damage Telemetry Box */}
                <div className="p-3 bg-slate-950/95 border border-rose-900/80 rounded-xl text-[10px] font-mono text-left space-y-1.5 text-slate-400 shadow-inner">
                  <div className="flex justify-between text-rose-400 font-bold">
                    <span>STRUCTURAL INTEGRITY:</span>
                    <span>0% [CATASTROPHIC BREACH]</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>RADIAL LOCK BOLTS:</span>
                    <span className="text-rose-400 font-bold">8x BALLISTICALLY EJECTED</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>TURNING HELM:</span>
                    <span className="text-rose-400 font-bold">SHATTERED (3 FRAGMENTS)</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>CIPHER ENCLAVE RAM:</span>
                    <span className="text-emerald-400 font-bold">PURGED (0 BYTES RETAINED)</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SECURITY COOLDOWN:</span>
                    <span className="text-amber-400 font-bold">{cooldownSeconds}s</span>
                  </div>
                </div>

                {/* Repair Status or Action Button */}
                {isRepairing ? (
                  <div className="p-4 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-left font-mono text-[11px] space-y-1.5 animate-pulse">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold">
                      <Wrench className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>EXECUTING NANO-RECONSTRUCTION PROTOCOL...</span>
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      {repairStep === 1 && '▶ Phase 1: Re-aligning sheared titanium door bulkhead...'}
                      {repairStep === 2 && '▶ Phase 2: Seating radial chrome bolts into frame notches...'}
                      {repairStep === 3 && '▶ Phase 3: Pressurizing hydraulic seals & recalibrating dial...'}
                      {repairStep === 4 && '✔ Phase 4: Enclave restored to pristine security state.'}
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full transition-all duration-300"
                        style={{ width: `${(repairStep / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleEmergencyReset}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase bg-gradient-to-r from-rose-600 via-amber-600 to-rose-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-xl shadow-rose-950/60 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Execute Security Override & Repair Vault</span>
                  </button>
                )}
              </div>
            ) : (
              /* REGULAR FORM */
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {activeTab === 'register' && (
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Full Name / Operator Alias</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Master Vault Owner"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm font-sans transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Shield className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@argusvault.local"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm font-sans transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-mono text-slate-400">Master Password</label>
                    <span className="text-[10px] font-mono text-cyan-400">Spins 3D Dial On Type</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <KeyRound className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={masterPassword}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm font-mono tracking-wider transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500">Derives 256-bit key in memory</span>
                    <span
                      className={`${
                        failedAttempts === 0
                          ? 'text-slate-500'
                          : failedAttempts === 1
                          ? 'text-amber-400'
                          : 'text-rose-400 font-bold animate-pulse'
                      }`}
                    >
                      Failures: {failedAttempts}/3
                    </span>
                  </div>
                </div>

                {activeTab === 'register' && (
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Confirm Master Password</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm font-mono tracking-wider transition-all"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || vaultStatus === 'unlocking'}
                  className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 shadow-lg shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="font-mono text-xs">DERIVING KEY & AUTHENTICATING...</span>
                  ) : (
                    <>
                      <span>{activeTab === 'login' ? 'Disengage Locks & Enter Vault' : 'Initialize Encrypted Vault'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Quick Demo Credentials & Blast Simulation Controls */}
            {!isLockdown && (
              <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] font-mono text-slate-400 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    Pre-configured Admin Account:
                  </span>
                  <span className="text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px]">
                    READY
                  </span>
                </div>
                <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 flex items-center justify-between shadow-inner">
                  <div>
                    <div className="text-slate-200 font-semibold">admin@argusvault.local</div>
                    <div className="text-slate-500">ArgusAdmin2026!Secure</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@argusvault.local');
                      setMasterPassword('ArgusAdmin2026!Secure');
                      setTypingCount((c) => c + 10);
                      soundFX.tick();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
                  >
                    Autofill
                  </button>
                </div>

                {/* Instant Blast Trigger for Quick Testing */}
                <div className="pt-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Demo Blast Effect:</span>
                  <button
                    type="button"
                    onClick={triggerCatastrophicBlast}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-mono transition-all hover:scale-105"
                  >
                    <Bomb className="w-3 h-3 text-rose-400" />
                    <span>Instant Blast Demo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer / Architecture Spec Badge */}
      <footer className="w-full border-t border-slate-800/80 bg-slate-950/90 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>Argus Vault v1.0 • Client-Side Zero-Knowledge Cryptography</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400">Django API (:8000)</span>
          <span className="text-slate-700">•</span>
          <span className="text-slate-400">Next.js 16 + Three.js (:8080)</span>
        </div>
      </footer>
    </div>
  );
}
