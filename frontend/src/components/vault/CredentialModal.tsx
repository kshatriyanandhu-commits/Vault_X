'use client';

import React, { useState, useEffect } from 'react';
import { DecryptedCredentialItem } from '@/context/VaultContext';
import { CredentialPayload, evaluatePasswordStrength } from '@/lib/crypto';
import PasswordGeneratorModal from './PasswordGeneratorModal';
import {
  X,
  Lock,
  Eye,
  EyeOff,
  Wand2,
  Globe,
  User,
  FileText,
  Star,
  ShieldCheck,
  Server,
  CreditCard,
  KeyRound,
} from 'lucide-react';

interface CredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CredentialPayload, isFavorite: boolean) => Promise<void>;
  item?: DecryptedCredentialItem | null;
}

export default function CredentialModal({
  isOpen,
  onClose,
  onSave,
  item,
}: CredentialModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'login' | 'card' | 'note' | 'server' | 'general'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGenOpen, setIsGenOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setTitle(item.title);
        setCategory(item.category);
        setUsername(item.username || '');
        setPassword(item.password || '');
        setUrl(item.url || '');
        setNotes(item.notes || '');
        setIsFavorite(item.isFavorite);
      } else {
        setTitle('');
        setCategory('login');
        setUsername('');
        setPassword('');
        setUrl('');
        setNotes('');
        setIsFavorite(false);
      }
      setShowPassword(false);
      setFormError(null);
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const strength = evaluatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please provide a title for this item.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload: CredentialPayload = {
        title: title.trim(),
        category,
        username: username.trim(),
        password,
        url: url.trim(),
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
      };
      await onSave(payload, isFavorite);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  {item ? 'Modify Encrypted Item' : 'Secure New Credential'}
                </h2>
                <p className="text-xs text-slate-400">Client-Side Zero-Knowledge Encryption (AES-256-GCM)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Scroll Area */}
          <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 py-4 pr-1">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {formError}
              </div>
            )}

            {/* Category Selector Tabs */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Category</label>
              <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                {[
                  { id: 'login', label: 'Login', icon: KeyRound },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'note', label: 'Note', icon: FileText },
                  { id: 'server', label: 'Server', icon: Server },
                  { id: 'general', label: 'Other', icon: Lock },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const active = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id as any)}
                      className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                        active
                          ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      <span className="text-[11px]">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title & Favorite */}
            <div className="flex gap-2.5 items-end">
              <div className="flex-1">
                <label className="block text-xs font-mono text-slate-400 mb-1">Item Title / Service *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. GitHub Enterprise, AWS Production, Chase Bank"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-sm font-sans"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className={`p-2.5 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0 ${
                  isFavorite
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
                title="Mark as Favorite"
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
            </div>

            {/* Username / Email */}
            {category !== 'note' && (
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  {category === 'card' ? 'Cardholder Name / Number' : 'Username or Email'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={category === 'card' ? 'John Doe • 4532 ...' : 'alice@company.com or username'}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-sm font-sans"
                  />
                </div>
              </div>
            )}

            {/* Password / Secret Key */}
            {category !== 'note' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono text-slate-400">
                    {category === 'card' ? 'PIN / CVV' : 'Password / Token'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsGenOpen(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password or secret"
                    className="w-full pl-3.5 pr-20 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-sm font-mono"
                  />
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-slate-400 hover:text-slate-200"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>{strength.label}</span>
                    </span>
                    <span>{strength.entropy} bits entropy</span>
                  </div>
                )}
              </div>
            )}

            {/* URL */}
            {category !== 'note' && (
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Website URL</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Globe className="w-4 h-4" />
                  </span>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://app.domain.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-sm font-sans"
                  />
                </div>
              </div>
            )}

            {/* Secure Notes */}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Secure Notes / Recovery Codes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Encrypted notes, 2FA backup codes, SSH keys, or security question answers..."
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-sm font-mono resize-none"
              />
            </div>

            {/* Cryptographic Zero-Knowledge Notice */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Zero-Knowledge Guarantee:</strong> This item is encrypted in your browser using AES-256-GCM
                with a fresh 12-byte random IV. The server only stores the ciphertext and never sees your plaintext secrets.
              </span>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Encrypting...' : item ? 'Update Encrypted Item' : 'Encrypt & Store'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Password Generator */}
      <PasswordGeneratorModal
        isOpen={isGenOpen}
        onClose={() => setIsGenOpen(false)}
        onSelectPassword={(generated) => {
          setPassword(generated);
          setShowPassword(true);
        }}
      />
    </>
  );
}
