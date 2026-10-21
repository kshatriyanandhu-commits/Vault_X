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
    setDialRotation((prev) => prev + 30 + (typingCharCount % 10) * 5);
  }, [typingCharCount]);

  // Handle wrong password blinking
  useEffect(() => {
    if (status === 'rejecting') {
      setRedBlinking(true);
      const timer = setTimeout(() => setRedBlinking(false), 1800);
      return () => clearTimeout(timer);
    } else {
      setRedBlinking(false);
    }
  }, [status]);

  // Handle cinematic unlock sequence
  useEffect(() => {
    if (status === 'unlocking' || status === 'unlocked') {
      // Force extinguish any red light immediately!
      setRedBlinking(false);

      // Step 1: Green LED confirmation blink (1.2s)
      setGreenBlinking(true);

      const timer1 = setTimeout(() => {
        setGreenBlinking(false);
        // Step 2: Helm spins 360 degrees
        setHelmRotation(360);
      }, 1200);

      const timer2 = setTimeout(() => {
        // Step 3: Radial bolts retract inward
        setBoltsRetracted(true);
      }, 2100);

      const timer3 = setTimeout(() => {
        // Step 4: Vault door swings wide open!
        setDoorOpen(true);
      }, 2900);

      const timer4 = setTimeout(() => {
        // Step 5: Smooth transition inside after user views open door
        if (onUnlockComplete) {
          onUnlockComplete();
        }
      }, 4200);

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
      {/* Perspective Container (No cartoon bouncing!) */}
      <div
        className={`relative w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] transition-transform duration-700 ${
          status === 'rejecting' ? 'animate-shake' : ''
        }`}
        style={{
          perspective: '1200px',
        }}
      >
        {/* Inner Chamber Background (Revealed when door swings open or breached) */}
        <div
          className={`absolute inset-0 rounded-full border-4 flex items-center justify-center shadow-inner overflow-hidden transition-all duration-700 ${
            status === 'destroyed'
              ? 'bg-gradient-to-br from-stone-950 via-rose-950/80 to-black border-stone-800 shadow-[0_0_50px_rgba(244,63,94,0.3)]'
              : 'bg-gradient-to-br from-emerald-950/90 via-slate-900 to-cyan-950/80 border-slate-800'
          }`}
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="text-center p-6 z-10">
            {status === 'destroyed' ? (
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-rose-950 border border-rose-600 text-rose-300 font-mono text-xs font-bold">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  STRUCTURAL BREACH // QUARANTINE
                </span>
                <p className="text-slate-400 text-[10px] font-mono tracking-wider">
                  RADIAL BOLTS DISLODGED • ENCLAVE WIPED
                </p>
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
              ? 'border-stone-800 bg-slate-950'
              : 'border-slate-700/70 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900'
          }`}
        >
          <div className="absolute inset-1 rounded-full border-2 border-amber-600/30" />
        </div>

        {/* Swinging / Blasted Door Leaf */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700 origin-left"
          style={{
            transform:
              status === 'destroyed'
                ? 'translate(20px, 45px) rotateZ(12deg) rotateX(15deg) scale(0.96)'
                : doorOpen
                ? 'rotateY(-85deg)'
                : 'rotateY(0deg)',
            transformStyle: 'preserve-3d',
            opacity: status === 'destroyed' ? 0.9 : 1,
          }}
        >
          {/* Main Door Plate */}
          <div
            className={`relative w-full h-full rounded-full border-4 shadow-2xl flex items-center justify-center overflow-visible transition-colors ${
              status === 'destroyed'
                ? 'bg-gradient-to-br from-slate-900 via-stone-900 to-black border-stone-700'
                : 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border-slate-700'
            }`}
          >
            {/* Radial Locking Bolts */}
            {Array.from({ length: numBolts }).map((_, i) => {
              const angle = (i * 2 * Math.PI) / numBolts;
              const r = status === 'destroyed' ? 185 : boltRadius;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              const deg = (angle * 180) / Math.PI;

              return (
                <div
                  key={i}
                  className="absolute w-6 h-12 rounded-sm shadow-md transition-all duration-700 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400"
                  style={{
                    transform: `translate(${x}px, ${y}px) rotate(${deg + 90}deg)`,
                    transformOrigin: 'center center',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
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

            {/* Status LED Indicator (Strict color isolation: NO RED ON UNLOCK!) */}
            <div className="absolute top-8 flex flex-col items-center">
              <div
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  status === 'destroyed'
                    ? 'bg-rose-600 shadow-[0_0_16px_rgba(255,0,0,0.8)]'
                    : status === 'unlocking' || status === 'unlocked' || greenBlinking
                    ? 'bg-emerald-400 shadow-[0_0_24px_rgba(16,185,129,1)] animate-pulse'
                    : status === 'rejecting' || redBlinking
                    ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,1)] animate-ping'
                    : status === 'typing'
                    ? 'bg-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.8)]'
                    : 'bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-pulse'
                }`}
              />
            </div>

            {/* Central Combination Dial */}
            <div
              className="relative w-44 h-44 rounded-full bg-gradient-to-tr from-amber-700/60 via-amber-600/40 to-amber-800/80 p-2 shadow-xl flex items-center justify-center transition-all duration-500"
              style={{
                transform: `rotate(${dialRotation}deg)`,
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
