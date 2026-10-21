'use client';

import React, { useEffect, useState } from 'react';
import { Flame, Bomb, AlertTriangle, ShieldAlert } from 'lucide-react';

export interface VaultDoorFallbackProps {
  status: 'idle' | 'typing' | 'unlocking' | 'unlocked' | 'rejecting' | 'destroyed';
  typingCharCount?: number;
  failedAttempts?: number;
  onUnlockComplete?: () => void;
  className?: string;
}

export default function VaultDoorFallback({
  status,
  typingCharCount = 0,
  failedAttempts = 0,
  onUnlockComplete,
  className = '',
}: VaultDoorFallbackProps) {
  const [dialRotation, setDialRotation] = useState(0);
  const [helmRotation, setHelmRotation] = useState(0);
  const [boltsRetracted, setBoltsRetracted] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [greenBlinking, setGreenBlinking] = useState(false);
  const [redBlinking, setRedBlinking] = useState(false);

  // Spin dial as user types
  useEffect(() => {
    setDialRotation((prev) => prev + 35 + (typingCharCount % 10) * 5);
  }, [typingCharCount]);

  // Handle wrong password blinking
  useEffect(() => {
    if (status === 'rejecting') {
      setRedBlinking(true);
      const timer = setTimeout(() => setRedBlinking(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Handle unlock sequence
  useEffect(() => {
    if (status === 'unlocking' || status === 'unlocked') {
      // Step 0: Green LED blinks for 700ms
      setGreenBlinking(true);

      const timer1 = setTimeout(() => {
        setGreenBlinking(false);
        // Step 1: Helm spins
        setHelmRotation(360);
      }, 700);

      const timer2 = setTimeout(() => {
        // Step 2: Bolts retract
        setBoltsRetracted(true);
      }, 1200);

      const timer3 = setTimeout(() => {
        // Step 3: Door swings open wide
        setDoorOpen(true);
      }, 1600);

      const timer4 = setTimeout(() => {
        if (onUnlockComplete) {
          onUnlockComplete();
        }
      }, 2200);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
      };
    } else if (status !== 'destroyed') {
      setBoltsRetracted(false);
      setDoorOpen(false);
      setHelmRotation(0);
      setGreenBlinking(false);
    }
  }, [status, onUnlockComplete]);

  const numBolts = 8;
  const boltRadius = boltsRetracted ? 140 : 165;

  return (
    <div className={`relative w-full h-full min-h-[460px] flex items-center justify-center p-4 ${className}`}>
      {/* 3D Perspective container */}
      <div
        className={`relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] transition-transform duration-1000 ${
          status === 'rejecting'
            ? 'animate-shake'
            : status === 'destroyed'
            ? 'animate-blast-impact'
            : ''
        }`}
        style={{
          perspective: '1200px',
        }}
      >
        {/* Inner Chamber Background (revealed when door swings open or explodes) */}
        <div
          className={`absolute inset-0 rounded-full border-4 flex items-center justify-center shadow-inner overflow-hidden transition-all duration-700 ${
            status === 'destroyed'
              ? 'bg-gradient-to-br from-rose-950 via-red-900 to-black border-rose-600 shadow-[0_0_80px_rgba(244,63,94,0.7)]'
              : 'bg-gradient-to-br from-emerald-950/90 via-slate-900 to-cyan-950/80 border-slate-800'
          }`}
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="text-center p-6 z-10">
            {status === 'destroyed' ? (
              <div className="space-y-2 animate-pulse">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-rose-600 text-white font-mono text-xs font-extrabold shadow-lg shadow-rose-600/50">
                  <Bomb className="w-3.5 h-3.5" />
                  CATASTROPHIC BREACH
                </span>
                <p className="text-rose-400 text-[10px] font-mono tracking-wider">
                  HYDRAULIC CORES DETONATED • CRYPTO RAM PURGED
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500 text-[9px] font-mono text-rose-300">
                    TEMP: 1450°C
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500 text-[9px] font-mono text-rose-300">
                    INTEGRITY: 0%
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="inline-block px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/40">
                  VAULT UNLOCKED
                </div>
                <p className="text-emerald-300 text-[10px] font-mono">Zero-Knowledge Decryption Active</p>
              </div>
            )}
          </div>
        </div>

        {/* Outer Heavy Steel Frame */}
        <div
          className={`absolute inset-[-14px] rounded-full border-8 pointer-events-none shadow-2xl flex items-center justify-center transition-colors duration-500 ${
            status === 'destroyed'
              ? 'border-rose-600/80 bg-gradient-to-tr from-slate-950 via-rose-950/50 to-slate-950 shadow-rose-900/60'
              : 'border-slate-700/70 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900'
          }`}
        >
          <div className="absolute inset-1 rounded-full border-2 border-amber-600/40" />
        </div>

        {/* Swinging / Blasted Door Leaf */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700 origin-left"
          style={{
            transform:
              status === 'destroyed'
                ? 'translate(65px, 120px) rotateZ(28deg) rotateX(42deg) scale(0.88)'
                : doorOpen
                ? 'rotateY(-85deg)'
                : 'rotateY(0deg)',
            transformStyle: 'preserve-3d',
            opacity: status === 'destroyed' ? 0.75 : 1,
            filter: status === 'destroyed' ? 'drop-shadow(0 20px 30px rgba(244,63,94,0.6))' : 'none',
          }}
        >
          {/* Main Door Plate */}
          <div
            className={`relative w-full h-full rounded-full border-4 shadow-2xl flex items-center justify-center overflow-visible transition-colors ${
              status === 'destroyed'
                ? 'bg-gradient-to-br from-slate-900 via-rose-950/40 to-black border-rose-500'
                : 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border-slate-700'
            }`}
          >
            {/* Radial Locking Bolts (Ejected outwards when destroyed) */}
            {Array.from({ length: numBolts }).map((_, i) => {
              const angle = (i * 2 * Math.PI) / numBolts;
              const r = status === 'destroyed' ? 220 + (i % 3) * 35 : boltRadius;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              const deg = (angle * 180) / Math.PI;

              return (
                <div
                  key={i}
                  className={`absolute w-6 h-12 rounded-sm shadow-md transition-all duration-700 ${
                    status === 'destroyed'
                      ? 'bg-gradient-to-r from-amber-400 via-rose-400 to-slate-400 rotate-45 scale-90 opacity-70'
                      : 'bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400'
                  }`}
                  style={{
                    transform: `translate(${x}px, ${y}px) rotate(${deg + 90}deg)`,
                    transformOrigin: 'center center',
                    boxShadow: status === 'destroyed' ? '0 0 15px rgba(244,63,94,0.8)' : '0 0 10px rgba(0,0,0,0.5)',
                  }}
                />
              );
            })}

            {/* Perimeter Bezel Ring with Rivets */}
            <div className="absolute inset-4 rounded-full border-2 border-slate-600/50 flex items-center justify-center">
              {Array.from({ length: 16 }).map((_, i) => {
                const angle = (i * 2 * Math.PI) / 16;
                const r = 150;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                return (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-slate-400 shadow-inner"
                    style={{
                      transform: `translate(${x}px, ${y}px)`,
                    }}
                  />
                );
              })}
            </div>

            {/* Status LED Indicator (Blinks Red on Wrong / Blinks Green on Correct / Strobes on Destroyed) */}
            <div className="absolute top-8 flex flex-col items-center">
              <div
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  status === 'destroyed'
                    ? 'bg-rose-600 shadow-[0_0_28px_rgba(255,0,0,1)] animate-ping'
                    : status === 'rejecting' || redBlinking
                    ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,1)] animate-ping'
                    : greenBlinking
                    ? 'bg-emerald-300 shadow-[0_0_24px_rgba(52,211,153,1)] animate-pulse'
                    : status === 'unlocking' || status === 'unlocked'
                    ? 'bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.9)]'
                    : status === 'typing'
                    ? 'bg-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.8)]'
                    : 'bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-pulse'
                }`}
              />
            </div>

            {/* Central Combination Dial */}
            <div
              className={`relative w-44 h-44 rounded-full p-2 shadow-xl flex items-center justify-center transition-all duration-500 ${
                status === 'destroyed'
                  ? 'bg-gradient-to-tr from-rose-800 via-amber-800 to-black translate-x-8 translate-y-12 rotate-45'
                  : 'bg-gradient-to-tr from-amber-700/60 via-amber-600/40 to-amber-800/80'
              }`}
              style={{
                transform: status !== 'destroyed' ? `rotate(${dialRotation}deg)` : undefined,
              }}
            >
              <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-800 to-slate-950 border-2 border-amber-500/50 flex items-center justify-center relative">
                {/* Dial Tick Marks */}
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className={`absolute top-1 w-0.5 ${i % 3 === 0 ? 'h-3 bg-amber-400' : 'h-1.5 bg-slate-500'}`}
                    style={{
                      transformOrigin: '50% 80px',
                      transform: `rotate(${i * 15}deg)`,
                    }}
                  />
                ))}

                {/* 3-Spoke Turning Wheel (Helm) */}
                <div
                  className="relative w-28 h-28 flex items-center justify-center transition-transform duration-700 ease-out"
                  style={{
                    transform: `rotate(${helmRotation}deg)`,
                  }}
                >
                  <div className="absolute w-4 h-4 rounded-full bg-gradient-to-tr from-slate-200 to-slate-400 shadow-md z-10 border border-slate-600" />
                  {[0, 120, 240].map((deg) => (
                    <div
                      key={deg}
                      className="absolute w-2 h-24 bg-gradient-to-t from-slate-300 via-slate-100 to-amber-500 rounded-full"
                      style={{
                        transform: `rotate(${deg}deg)`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Brand Etching */}
            <div className="absolute bottom-6 font-mono text-[10px] tracking-widest text-slate-500 uppercase">
              {status === 'destroyed' ? 'BREACH PROTOCOL // LOCKDOWN' : 'ARGUS VAULT • SEC-MK-IV'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
