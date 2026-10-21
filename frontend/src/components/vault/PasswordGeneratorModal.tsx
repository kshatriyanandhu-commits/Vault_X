'use client';

import React, { useState, useEffect } from 'react';
import { generatePassword, evaluatePasswordStrength, PasswordGeneratorOptions } from '@/lib/crypto';
import { X, RefreshCw, Copy, Check, ShieldCheck, Zap, Clock, Shield } from 'lucide-react';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPassword?: (password: string) => void;
}

function getCrackTimeEstimate(entropy: number): string {
  if (entropy < 28) return 'Instant (< 2 seconds)';
  if (entropy < 40) return 'Few minutes';
  if (entropy < 50) return '~4 to 7 days';
  if (entropy < 65) return '~120 years';
  if (entropy < 80) return '~850,000 years';
  if (entropy < 100) return '~14.2 billion years';
  return '~6.8 trillion years (Post-Quantum Resilient)';
}

export default function PasswordGeneratorModal({
  isOpen,
  onClose,
  onSelectPassword,
}: PasswordGeneratorModalProps) {
  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 22,
    useUpper: true,
    useLower: true,
    useNumbers: true,
    useSymbols: true,
    avoidAmbiguous: true,
  });

  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const regenerate = () => {
    const p = generatePassword(options);
    setPassword(p);
  };

  useEffect(() => {
    if (isOpen) {
      regenerate();
      setCopied(false);
    }
  }, [isOpen, options]);

  if (!isOpen) return null;

  const strength = evaluatePasswordStrength(password);
  const crackTime = getCrackTimeEstimate(strength.entropy);

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (onSelectPassword && password) {
      onSelectPassword(password);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 font-mono">Quantum Entropy Generator</h2>
              <p className="text-xs text-slate-400">Cryptographically secure Web Crypto PRNG</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Generated Password Box */}
        <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-slate-800 shadow-inner flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-base tracking-wider break-all text-emerald-400 select-all">
              {password}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={regenerate}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Generate another"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                }`}
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Strength Bar & Entropy Details */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Rating: <strong className="text-emerald-400">{strength.label}</strong>
              </span>
              <span className="text-slate-400 font-bold">{strength.entropy} bits entropy</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
              {[0, 1, 2, 3, 4].map((step) => {
                const active = strength.score >= step;
                const colors = ['bg-rose-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-400', 'bg-cyan-400'];
                return (
                  <div
                    key={step}
                    className={`h-full flex-1 transition-all duration-300 ${active ? colors[step] : 'bg-slate-800'}`}
                  />
                );
              })}
            </div>

            {/* Crack Time Readout */}
            <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3 h-3 text-cyan-400" />
                Brute Force Resistance:
              </span>
              <span className="text-cyan-300 font-semibold">{crackTime}</span>
            </div>
          </div>
        </div>

        {/* Options Controls */}
        <div className="mt-5 space-y-4">
          {/* Length Slider */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-mono">
              <span>Password Length</span>
              <span className="text-cyan-400 font-bold">{options.length} characters</span>
            </div>
            <input
              type="range"
              min="8"
              max="64"
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value) })}
              className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Character Options Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-slate-300">
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={options.useUpper}
                onChange={(e) => setOptions({ ...options, useUpper: e.target.checked })}
                className="rounded accent-emerald-500 w-4 h-4"
              />
              <span>Uppercase (A-Z)</span>
            </label>
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={options.useLower}
                onChange={(e) => setOptions({ ...options, useLower: e.target.checked })}
                className="rounded accent-emerald-500 w-4 h-4"
              />
              <span>Lowercase (a-z)</span>
            </label>
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={options.useNumbers}
                onChange={(e) => setOptions({ ...options, useNumbers: e.target.checked })}
                className="rounded accent-emerald-500 w-4 h-4"
              />
              <span>Numbers (0-9)</span>
            </label>
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={options.useSymbols}
                onChange={(e) => setOptions({ ...options, useSymbols: e.target.checked })}
                className="rounded accent-emerald-500 w-4 h-4"
              />
              <span>Symbols (!@#$)</span>
            </label>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancel
          </button>
          {onSelectPassword && (
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              Use Generated Secret
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
