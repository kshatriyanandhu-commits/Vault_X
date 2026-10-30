'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [isRepairing, setIsRepairing] = useState(false);

  // Debounce timer for automatic unlock on password entry
  const autoUnlockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep latest state in ref for timers
  const latestStateRef = useRef({
    email,
    masterPassword,
    activeTab,
    isLockdown,
    vaultStatus,
    failedAttempts,
    isSubmitting,
  });
  useEffect(() => {
    latestStateRef.current = {
      email,
      masterPassword,
      activeTab,
      isLockdown,
      vaultStatus,
      failedAttempts,
      isSubmitting,
    };
  }, [email, masterPassword, activeTab, isLockdown, vaultStatus, failedAttempts, isSubmitting]);

  // Only redirect on initial page mount if already authenticated.
  // During an active unlock sequence, we wait for the 3D door to swing wide open first!
  const isInitialMountChecked = useRef(false);
  useEffect(() => {
    if (!isInitialMountChecked.current) {
      isInitialMountChecked.current = true;
      if (isVaultUnlocked && vaultStatus === 'idle') {
        router.push('/vault');
      }
    }
  }, [isVaultUnlocked, vaultStatus, router]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundFX.isMuted = next;
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

  // Trigger realistic industrial breach
  const triggerIndustrialBreach = () => {
    soundFX.selfDestruct();
    setVaultStatus('destroyed');
    setIsLockdown(true);
    setCooldownSeconds(30);
    setLocalError('CRITICAL BREACH: 3/3 FAILED ATTEMPTS. HARDWARE INTERLOCK DETONATED.');
  };

  // Centralized Unlock / Authentication Handler
  const executeUnlock = async (
    targetEmail: string,
    targetPassword: string,
    isAutoTrigger: boolean = false
  ) => {
    const state = latestStateRef.current;
    if (state.isLockdown || state.vaultStatus === 'unlocking' || state.isSubmitting) return;

    clearError();
    setLocalError(null);

    const cleanEmail = (targetEmail || 'admin@argusvault.local').trim().toLowerCase();

    if (state.activeTab === 'register') {
      if (isAutoTrigger) return; // Don't auto-register on typing
      if (targetPassword !== confirmPassword) {
        soundFX.accessDenied();
        setLocalError('Master passwords do not match.');
        setVaultStatus('rejecting');
        setTimeout(() => setVaultStatus('idle'), 1500);
        return;
      }
    }

    if (targetPassword.length < 8) {
      if (!isAutoTrigger) {
        soundFX.accessDenied();
        setLocalError('Master password must be at least 8 characters.');
        setVaultStatus('rejecting');
        setTimeout(() => setVaultStatus('idle'), 1500);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      if (state.activeTab === 'login') {
        await login(cleanEmail, targetPassword);
      } else {
        await register(cleanEmail, targetPassword, fullName);
      }

      // --- SUCCESS: CORRECT PASSWORD ENTERED ---
      setFailedAttempts(0);
      setLocalError(null);
      clearError();

      soundFX.accessGranted();
      setTimeout(() => soundFX.mechanicalUnlock(), 250);

      // Trigger the 3D vault door open sequence!
      setVaultStatus('unlocking');
    } catch (err: any) {
      // If it was an automatic background verification while typing,
      // don't penalize with failedAttempt strikes (the user might still be typing the rest of password).
      if (isAutoTrigger) {
        setVaultStatus('idle');
      } else {
        // Explicit submission with wrong password
        const nextFailures = state.failedAttempts + 1;
        setFailedAttempts(nextFailures);

        if (nextFailures < 3) {
          soundFX.accessDenied();
          setVaultStatus('rejecting');
          setLocalError(
            `Authentication Rejected! [Attempt ${nextFailures}/3]. WARNING: 3 consecutive failures will trigger Vault Destruction.`
          );

          setTimeout(() => {
            if (vaultStatus !== 'destroyed') {
              setVaultStatus('idle');
            }
          }, 2200);
        } else {
          triggerIndustrialBreach();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle email changes: triggers auto-verification if password is already typed
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (autoUnlockTimerRef.current) {
      clearTimeout(autoUnlockTimerRef.current);
    }
    if (
      masterPassword.length >= 8 &&
      activeTab === 'login' &&
      vaultStatus !== 'destroyed' &&
      vaultStatus !== 'unlocking'
    ) {
      autoUnlockTimerRef.current = setTimeout(() => {
        executeUnlock(val, masterPassword, true);
      }, 250);
    }
  };

  // Handle password typing: spins 3D dial and automatically unlocks after entering password
  const handlePasswordChange = (val: string) => {
    setMasterPassword(val);
    setTypingCount((c) => c + 1);
    soundFX.tick();

    if (autoUnlockTimerRef.current) {
      clearTimeout(autoUnlockTimerRef.current);
    }

    if (vaultStatus !== 'destroyed' && vaultStatus !== 'unlocking') {
      setVaultStatus('typing');

      // AUTOMATIC OPEN AFTER ENTERING PASSWORD:
      // When user enters 8+ characters in login mode, wait 250ms after typing/pasting
      // and automatically verify and open the vault immediately!
      if (val.length >= 8 && activeTab === 'login') {
        autoUnlockTimerRef.current = setTimeout(() => {
          executeUnlock(email || 'admin@argusvault.local', val, true);
        }, 250);
      } else {
        const timeout = setTimeout(() => {
          setVaultStatus((prev) => (prev === 'typing' ? 'idle' : prev));
        }, 800);
        return () => clearTimeout(timeout);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (autoUnlockTimerRef.current) {
      clearTimeout(autoUnlockTimerRef.current);
    }
    await executeUnlock(email || 'admin@argusvault.local', masterPassword, false);
  };

  // Called ONLY after the 3D door has finished its complete opening sequence:
  const handleUnlockSequenceComplete = () => {
    router.push('/vault');
  };

  // Security Override & Repair Protocol
  const handleEmergencyReset = () => {
    if (isRepairing) return;
    setIsRepairing(true);
    soundFX.repairSequence();

    setTimeout(() => {
      setFailedAttempts(0);
      setIsLockdown(false);
      setCooldownSeconds(30);
      setVaultStatus('idle');
      setLocalError(null);
      setMasterPassword('');
      setIsRepairing(false);
    }, 900);
  };

  // Dedicated Autofill Handler: Populates and automatically initiates 3D vault opening
  const handleAutofillAdmin = async (autoOpen: boolean = true) => {
    setActiveTab('login');
    setEmail('admin@argusvault.local');
    setMasterPassword('ArgusAdmin2026!Secure');
    setConfirmPassword('ArgusAdmin2026!Secure');
    setTypingCount((c) => c + 15);
    clearError();
    setLocalError(null);
    setFailedAttempts(0);
    setIsLockdown(false);
    setVaultStatus('idle');
    soundFX.tick();

    if (autoOpen) {
      // Automatically opens the vault immediately!
      setTimeout(() => {
        executeUnlock('admin@argusvault.local', 'ArgusAdmin2026!Secure', false);
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-[#06090e] bg-cyber-grid text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200 relative">
      {/* Ambient Lighting Orbs */}
      <div
        className={`absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[140px] pointer-events-none transition-colors duration-700 ${
          vaultStatus === 'destroyed'
            ? 'bg-rose-900/30'
            : vaultStatus === 'rejecting'
            ? 'bg-rose-500/20'
            : vaultStatus === 'unlocking'
            ? 'bg-emerald-500/25'
            : 'bg-cyan-500/10'
        }`}
      />
      <div
        className={`absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full blur-[140px] pointer-events-none transition-colors duration-700 ${
          vaultStatus === 'destroyed'
            ? 'bg-amber-900/20'
            : vaultStatus === 'unlocking'
            ? 'bg-emerald-400/20'
            : 'bg-emerald-500/10'
        }`}
      />

      {/* Top Telemetry Classification Strip */}
      <div
        className={`w-full border-b px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] font-mono z-30 transition-colors duration-500 ${
          vaultStatus === 'destroyed'
            ? 'bg-rose-950/95 border-rose-800 text-rose-300'
            : vaultStatus === 'unlocking'
            ? 'bg-emerald-950/90 border-emerald-700 text-emerald-300'
            : 'bg-slate-950/90 border-slate-800/80 text-slate-400'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {vaultStatus === 'destroyed' ? (
            <span className="flex items-center gap-1.5 text-rose-400 font-bold">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              STATUS: CATASTROPHIC BREACH // LOCKDOWN
            </span>
          ) : vaultStatus === 'unlocking' ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              AUTHENTICATED // ACCESS GRANTED
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              SYS_ONLINE
            </span>
          )}
          <span className="text-slate-600 hidden xs:inline">|</span>
          <span className="text-cyan-400 hidden xs:inline">AES-256-GCM</span>
          <span className="text-slate-600 hidden md:inline">|</span>
          <span className="text-slate-400 hidden md:inline">ZERO-KNOWLEDGE STORAGE</span>
        </div>

        {/* Failed Attempts Counter & Sound Toggle */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors"
            title={isMuted ? 'Unmute Audio FX' : 'Mute Audio FX'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span className="hidden sm:inline">{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
          </button>

          {vaultStatus !== 'unlocking' && (
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
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-slate-900 text-slate-600 border-slate-800'
                      }`}
                    >
                      {step}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Navbar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-emerald-500 to-cyan-600 p-0.5 shadow-lg shadow-cyan-500/25 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg sm:text-xl text-white">ARGUS</span>
              <span className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono tracking-widest bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                VAULT
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] font-mono text-slate-400">Interactive 3D Steel Vault • Client Zero-Knowledge</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono text-slate-400">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center z-10">
        {/* Left Column: Interactive 3D Vault Door (Clickable to open) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative min-h-[260px] sm:min-h-[380px] lg:min-h-[520px] w-full">
          {/* Ambient Glow Disk Behind Door */}
          <div
            className={`absolute w-[240px] h-[240px] sm:w-[380px] sm:h-[380px] lg:w-[460px] lg:h-[460px] blur-2xl pointer-events-none rounded-full transition-all duration-700 ${
              vaultStatus === 'destroyed'
                ? 'bg-rose-950/40 scale-110'
                : vaultStatus === 'rejecting'
                ? 'bg-rose-500/25'
                : vaultStatus === 'unlocking'
                ? 'bg-emerald-500/30 scale-110'
                : 'bg-gradient-to-tr from-cyan-500/15 via-emerald-500/10 to-transparent'
            }`}
          />

          {/* 3D Vault Door Assembly with Click-to-Open Interaction */}
          <div
            className="w-full h-full flex items-center justify-center cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
            onClick={() => {
              if (vaultStatus === 'unlocking' || isLockdown) return;
              executeUnlock(email || 'admin@argusvault.local', masterPassword || 'ArgusAdmin2026!Secure', false);
            }}
            title="Click vault door to disengage locks"
          >
            <VaultDoorContainer
              status={vaultStatus}
              typingCharCount={typingCount}
              failedAttempts={failedAttempts}
              onUnlockComplete={handleUnlockSequenceComplete}
            />
          </div>

          {/* Status Label Under Vault Door */}
          <div className="mt-2 sm:mt-3 text-center px-2">
            <div
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border text-[11px] sm:text-xs font-mono backdrop-blur-md shadow-lg transition-all ${
                vaultStatus === 'destroyed'
                  ? 'bg-rose-950/90 border-rose-600 text-rose-300 font-bold'
                  : vaultStatus === 'rejecting'
                  ? 'bg-rose-950/90 border-rose-500 text-rose-400 font-bold animate-shake'
                  : vaultStatus === 'unlocking'
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 font-bold shadow-emerald-900/40'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400'
              }`}
            >
              {vaultStatus === 'typing' && (
                <span className="text-cyan-400 flex items-center gap-1.5 animate-pulse font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Dial Turning • Unlocks Automatically on Completion...
                </span>
              )}
              {vaultStatus === 'rejecting' && (
                <span className="text-rose-400 flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  ACCESS DENIED // FAILED ATTEMPTS: {failedAttempts}/3
                </span>
              )}
              {vaultStatus === 'unlocking' && (
                <span className="text-emerald-300 flex items-center gap-1.5 font-bold animate-pulse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  CONFIRMED • OPENING VAULT DOOR...
                </span>
              )}
              {vaultStatus === 'destroyed' && (
                <span className="text-rose-300 flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  HARDWARE BREACHED // LOCKDOWN ENGAGED
                </span>
              )}
              {vaultStatus === 'idle' && (
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  Enter Master Password to Open Vault Automatically
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: High-Security Terminal Form */}
        <div className="lg:col-span-5 flex justify-center w-full">
          <div
            className={`w-full max-w-md vault-panel tactical-bracket rounded-2xl p-4 sm:p-7 md:p-8 relative overflow-hidden transition-all duration-500 ${
              isLockdown
                ? 'border-rose-600 shadow-[0_0_50px_rgba(244,63,94,0.3)]'
                : vaultStatus === 'unlocking'
                ? 'border-emerald-500/80 shadow-[0_0_50px_rgba(16,185,129,0.3)]'
                : ''
            }`}
          >
            {/* Top Glowing Accent Line */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 transition-colors duration-500 ${
                isLockdown
                  ? 'bg-rose-600'
                  : vaultStatus === 'unlocking'
                  ? 'bg-emerald-400 glow-emerald'
                  : 'bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 glow-cyan'
              }`}
            />

            {/* Form Mode Selector */}
            <div className="flex rounded-xl bg-slate-950/80 p-1 border border-slate-800/80 mb-6 shadow-inner">
              <button
                type="button"
                disabled={isLockdown || vaultStatus === 'unlocking'}
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
                disabled={isLockdown || vaultStatus === 'unlocking'}
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
            {(error || localError) && vaultStatus !== 'unlocking' && (
              <div
                className={`mb-4 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  vaultStatus === 'destroyed'
                    ? 'bg-rose-950/80 border-rose-600 text-rose-200 font-bold'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-shake'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{localError || error}</span>
              </div>
            )}

            {/* UNLOCKING SUCCESS VIEW (Visible while the 3D door is opening) */}
            {vaultStatus === 'unlocking' ? (
              <div className="py-6 text-center space-y-4 animate-in fade-in duration-300 font-mono">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border-2 border-emerald-400/50 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-emerald-400 tracking-wider uppercase">
                    CREDENTIAL CONFIRMED
                  </h3>
                  <p className="text-xs text-slate-400">
                    Disengaging radial locking bolts and swinging heavy steel door open...
                  </p>
                </div>
                <div className="p-3 bg-slate-950 border border-emerald-900/60 rounded-xl text-[11px] text-slate-400 space-y-1 text-left">
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>SECURITY ENCLAVE:</span>
                    <span>DECRYPTED</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>3D VAULT MECHANISM:</span>
                    <span className="text-emerald-300">OPENING DOOR</span>
                  </div>
                </div>
              </div>
            ) : isLockdown ? (
              /* LOCKDOWN VIEW (Shown when Vault is Destroyed on 3rd Failed Attempt) */
              <div className="py-2 text-center space-y-4 animate-in fade-in duration-300">
                <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border-2 border-rose-600 flex items-center justify-center text-rose-400 mx-auto shadow-[0_0_25px_rgba(244,63,94,0.3)]">
                  <ShieldAlert className="w-7 h-7" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-rose-400 font-mono tracking-wider uppercase">
                    CRITICAL BREACH // HARDWARE LOCKDOWN
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    3 consecutive invalid authentication attempts detected. Mechanical security interlocks have severed and zero-knowledge cryptographic keys have been purged from memory.
                  </p>
                </div>

                {/* Diagnostics Damage Telemetry Box */}
                <div className="p-3 bg-slate-950 border border-stone-800 rounded-xl text-[10px] font-mono text-left space-y-1.5 text-slate-400">
                  <div className="flex justify-between text-rose-400 font-bold">
                    <span>STRUCTURAL INTEGRITY:</span>
                    <span>0% [BREACHED]</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>RADIAL LOCK BOLTS:</span>
                    <span className="text-rose-400 font-bold">SHEARED & DISLODGED</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>CIPHER ENCLAVE RAM:</span>
                    <span className="text-emerald-400 font-bold">PURGED (0 BYTES)</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>SECURITY COOLDOWN:</span>
                    <span className="text-amber-400 font-bold">{cooldownSeconds}s</span>
                  </div>
                </div>

                {/* Repair Status or Action Button */}
                {isRepairing ? (
                  <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-left font-mono text-[11px] flex items-center gap-2.5 text-cyan-300">
                    <Wrench className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                    <span>Recalibrating locking bolts & restoring enclave...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleEmergencyReset}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase bg-gradient-to-r from-rose-700 via-stone-800 to-rose-700 hover:from-rose-600 hover:to-stone-700 text-white shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-98"
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
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onInput={(e) => handleEmailChange((e.target as HTMLInputElement).value)}
                      placeholder="admin@argusvault.local"
                      className="w-full pl-9 pr-3.5 py-2.5 sm:py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-base sm:text-sm font-sans transition-all min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-mono text-slate-400">Master Password</label>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      Auto-Opens On Entry
                    </span>
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
                      onInput={(e) => handlePasswordChange((e.target as HTMLInputElement).value)}
                      placeholder="••••••••••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-base sm:text-sm font-mono tracking-wider transition-all min-h-[44px]"
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
                    <span className="text-slate-500">Auto-authenticates on entry</span>
                    <span
                      className={`${
                        failedAttempts === 0
                          ? 'text-slate-500'
                          : failedAttempts === 1
                          ? 'text-amber-400'
                          : 'text-rose-400 font-bold'
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
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 shadow-lg shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="font-mono text-xs">VERIFYING MASTER KEY...</span>
                  ) : (
                    <>
                      <span>{activeTab === 'login' ? 'Disengage Locks & Enter Vault' : 'Initialize Encrypted Vault'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Quick Demo Credentials & One-Click Auto-Unlock */}
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
                <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner">
                  <div>
                    <div className="text-slate-200 font-semibold text-xs">admin@argusvault.local</div>
                    <div className="text-slate-500 text-[11px] font-mono">ArgusAdmin2026!Secure</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAutofillAdmin(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 hover:from-emerald-500/40 hover:to-cyan-500/40 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-sm shadow-emerald-500/15"
                      title="Autofill and automatically open the 3D vault door"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Autofill & Open</span>
                    </button>
                  </div>
                </div>

                {/* Instant Breach Trigger for Quick Testing */}
                <div className="pt-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Test 3-Failure Breach:</span>
                  <button
                    type="button"
                    onClick={triggerIndustrialBreach}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 font-mono transition-all"
                  >
                    <Bomb className="w-3 h-3 text-rose-400" />
                    <span>Simulate 3rd Failure</span>
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
