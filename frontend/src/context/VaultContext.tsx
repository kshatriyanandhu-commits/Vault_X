'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  UserProfile,
  StoredCredentialRecord,
  authApi,
  credentialsApi,
} from '@/lib/api';
import {
  deriveVaultKey,
  encryptCredential,
  decryptCredential,
  CredentialPayload,
} from '@/lib/crypto';

export interface DecryptedCredentialItem {
  id: string;
  category: 'login' | 'card' | 'note' | 'server' | 'general';
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  customFields?: { label: string; value: string }[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

interface VaultContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isVaultUnlocked: boolean;
  vaultKey: CryptoKey | null;
  credentials: DecryptedCredentialItem[];
  isLoading: boolean;
  isDecrypting: boolean;
  error: string | null;
  autoLockMinutes: number;
  setAutoLockMinutes: (min: number) => void;
  secondsUntilLock: number;
  activityLogs: ActivityLog[];
  login: (email: string, masterPassword: string) => Promise<void>;
  register: (email: string, masterPassword: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  lockVault: () => void;
  unlockWithPassword: (masterPassword: string) => Promise<boolean>;
  refreshCredentials: () => Promise<void>;
  createCredential: (payload: CredentialPayload, isFavorite?: boolean) => Promise<void>;
  updateCredential: (id: string, payload: CredentialPayload, isFavorite?: boolean) => Promise<void>;
  deleteCredential: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  logActivity: (action: string, details: string) => void;
  clearError: () => void;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [credentials, setCredentials] = useState<DecryptedCredentialItem[]>([]);
  const [rawRecords, setRawRecords] = useState<StoredCredentialRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(15);
  const [secondsUntilLock, setSecondsUntilLock] = useState<number>(15 * 60);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const lastActivityRef = useRef<number>(Date.now());

  const logActivity = useCallback((action: string, details: string) => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substring(2, 9),
      action,
      details,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  }, []);

  // Lock Vault: Wipes master key and plaintext secrets from memory immediately
  const lockVault = useCallback(() => {
    setVaultKey(null);
    setCredentials([]);
    logActivity('Vault Locked', 'Master encryption key purged from client memory.');
  }, [logActivity]);

  // Decrypts an array of server-encrypted records using the provided Vault Key
  const decryptAllRecords = useCallback(
    async (records: StoredCredentialRecord[], key: CryptoKey): Promise<DecryptedCredentialItem[]> => {
      setIsDecrypting(true);
      const results: DecryptedCredentialItem[] = [];

      for (const rec of records) {
        try {
          const payload = await decryptCredential(rec.encrypted_payload, rec.iv, key);
          results.push({
            id: rec.id,
            category: (payload.category || rec.category || 'general') as any,
            title: payload.title || rec.title_hint || 'Untitled Credential',
            username: payload.username || '',
            password: payload.password || '',
            url: payload.url || '',
            notes: payload.notes || '',
            customFields: payload.customFields || [],
            isFavorite: rec.is_favorite,
            createdAt: rec.created_at,
            updatedAt: rec.updated_at,
          });
        } catch (err) {
          console.warn(`Failed to decrypt record ${rec.id}:`, err);
          // If a record cannot be decrypted, show placeholder without crashing
          results.push({
            id: rec.id,
            category: rec.category,
            title: rec.title_hint || 'Encrypted Item (Tampered / Key Mismatch)',
            isFavorite: rec.is_favorite,
            createdAt: rec.created_at,
            updatedAt: rec.updated_at,
          });
        }
      }

      setIsDecrypting(false);
      return results;
    },
    []
  );

  // Check initial user authentication session on page load
  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const profile = await authApi.me();
        if (mounted) {
          setUser(profile);
          logActivity('Session Restored', `Welcome back, ${profile.email}`);
        }
      } catch (err: any) {
        // Not authenticated
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();
    return () => {
      mounted = false;
    };
  }, [logActivity]);

  // Auto-lock idle timer listener
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
      setSecondsUntilLock(autoLockMinutes * 60);
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    const interval = setInterval(() => {
      if (!vaultKey) return;
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, autoLockMinutes * 60 - elapsedSeconds);
      setSecondsUntilLock(remaining);

      if (remaining <= 0) {
        lockVault();
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      clearInterval(interval);
    };
  }, [vaultKey, autoLockMinutes, lockVault]);

  // Refresh credentials from server
  const refreshCredentials = useCallback(async () => {
    if (!user) return;
    try {
      const records = await credentialsApi.list();
      setRawRecords(records);
      if (vaultKey) {
        const decrypted = await decryptAllRecords(records, vaultKey);
        setCredentials(decrypted);
      }
    } catch (err: any) {
      if (err.status === 401) {
        // Session revoked by admin!
        setUser(null);
        lockVault();
        setError('Your session was revoked by an administrator.');
      } else {
        setError(err.message || 'Failed to sync vault');
      }
    }
  }, [user, vaultKey, decryptAllRecords, lockVault]);

  // Login handler
  const login = async (email: string, masterPassword: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const profile = await authApi.login({ email, password: masterPassword });
      setUser(profile);

      // Derive zero-knowledge key on client using user's unique vault salt
      const key = await deriveVaultKey(masterPassword, profile.vault_salt || email);
      setVaultKey(key);

      lastActivityRef.current = Date.now();
      setSecondsUntilLock(autoLockMinutes * 60);
      logActivity('Authentication Success', `Master vault unlocked for ${profile.email}`);

      // Fetch and decrypt vault items concurrently with persistent Zero-Knowledge cache sync
      credentialsApi.list().then(async (serverRecords) => {
        let activeRecords = serverRecords;

        // Persistent Zero-Knowledge Local Cache Sync across serverless restarts
        const cacheKey = `argus_encrypted_vault_${profile.email.toLowerCase()}`;
        if (typeof window !== 'undefined') {
          if (activeRecords.length === 0) {
            try {
              const cachedStr = localStorage.getItem(cacheKey);
              if (cachedStr) {
                const cachedRecords = JSON.parse(cachedStr);
                if (Array.isArray(cachedRecords) && cachedRecords.length > 0) {
                  activeRecords = cachedRecords;
                  // Re-sync each item to backend so backend persistence is restored
                  for (const r of cachedRecords) {
                    credentialsApi.create({
                      encrypted_payload: r.encrypted_payload || r.ciphertext,
                      iv: r.iv,
                      category: r.category,
                      title_hint: r.title_hint,
                      is_favorite: r.is_favorite,
                    }).catch(console.warn);
                  }
                }
              }
            } catch (e) {
              console.warn('Local cache restore error:', e);
            }
          } else {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(activeRecords));
            } catch (e) {
              console.warn('Local cache save error:', e);
            }
          }
        }

        setRawRecords(activeRecords);
        const decrypted = await decryptAllRecords(activeRecords, key);
        setCredentials(decrypted);
      }).catch((err) => {
        console.warn('Vault credential background sync:', err);
      });
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Register handler
  const register = async (email: string, masterPassword: string, fullName?: string) => {
    setError(null);
    setIsLoading(true);
    try {
      // Derive initial random salt client-side or let server generate
      const profile = await authApi.register({
        email,
        password: masterPassword,
        full_name: fullName,
      });
      setUser(profile);

      const key = await deriveVaultKey(masterPassword, profile.vault_salt || email);
      setVaultKey(key);
      setCredentials([]);
      setRawRecords([]);

      lastActivityRef.current = Date.now();
      setSecondsUntilLock(autoLockMinutes * 60);
      logActivity('Vault Initialized', `Created brand new zero-knowledge vault for ${profile.email}`);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Continue even if network error
    } finally {
      lockVault();
      setUser(null);
      setActivityLogs([]);
    }
  };

  // Unlock existing authenticated session with password
  const unlockWithPassword = async (masterPassword: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const key = await deriveVaultKey(masterPassword, user.vault_salt || user.email);
      setVaultKey(key);

      const records = await credentialsApi.list();
      setRawRecords(records);
      const decrypted = await decryptAllRecords(records, key);
      setCredentials(decrypted);

      lastActivityRef.current = Date.now();
      setSecondsUntilLock(autoLockMinutes * 60);
      logActivity('Vault Unlocked', 'Master key regenerated in client memory.');
      return true;
    } catch (err) {
      return false;
    }
  };

  // Create Credential
  const createCredential = async (payload: CredentialPayload, isFavorite = false) => {
    if (!vaultKey) throw new Error('Vault is locked');

    // Encrypt client-side using AES-256-GCM
    const encrypted = await encryptCredential(payload, vaultKey);

    const createdRecord = await credentialsApi.create({
      encrypted_payload: encrypted.encryptedPayload,
      iv: encrypted.iv,
      category: payload.category,
      title_hint: payload.title,
      is_favorite: isFavorite,
    });

    const newItem: DecryptedCredentialItem = {
      id: createdRecord.id,
      category: payload.category,
      title: payload.title,
      username: payload.username,
      password: payload.password,
      url: payload.url,
      notes: payload.notes,
      customFields: payload.customFields,
      isFavorite,
      createdAt: createdRecord.created_at,
      updatedAt: createdRecord.updated_at,
    };

    setCredentials((prev) => [newItem, ...prev]);
    setRawRecords((prev) => {
      const next = [createdRecord, ...prev];
      if (typeof window !== 'undefined' && user?.email) {
        try {
          localStorage.setItem(`argus_encrypted_vault_${user.email.toLowerCase()}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
    logActivity('Credential Created', `Encrypted and stored entry "${payload.title}"`);
  };

  // Update Credential
  const updateCredential = async (id: string, payload: CredentialPayload, isFavorite?: boolean) => {
    if (!vaultKey) throw new Error('Vault is locked');

    // Encrypt client-side
    const encrypted = await encryptCredential(payload, vaultKey);

    const updatedRecord = await credentialsApi.update(id, {
      encrypted_payload: encrypted.encryptedPayload,
      iv: encrypted.iv,
      category: payload.category,
      title_hint: payload.title,
      is_favorite: isFavorite,
    });

    setCredentials((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              category: payload.category,
              title: payload.title,
              username: payload.username,
              password: payload.password,
              url: payload.url,
              notes: payload.notes,
              customFields: payload.customFields,
              isFavorite: isFavorite !== undefined ? isFavorite : item.isFavorite,
              updatedAt: updatedRecord.updated_at,
            }
          : item
      )
    );

    setRawRecords((prev) => {
      const next = prev.map((r) => (r.id === id ? updatedRecord : r));
      if (typeof window !== 'undefined' && user?.email) {
        try {
          localStorage.setItem(`argus_encrypted_vault_${user.email.toLowerCase()}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
    logActivity('Credential Updated', `Re-encrypted entry "${payload.title}"`);
  };

  // Delete Credential
  const deleteCredential = async (id: string) => {
    const item = credentials.find((c) => c.id === id);
    await credentialsApi.delete(id);
    setCredentials((prev) => prev.filter((c) => c.id !== id));
    setRawRecords((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (typeof window !== 'undefined' && user?.email) {
        try {
          localStorage.setItem(`argus_encrypted_vault_${user.email.toLowerCase()}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
    logActivity('Credential Deleted', `Purged entry "${item?.title || id}" from vault`);
  };

  // Toggle Favorite
  const toggleFavorite = async (id: string) => {
    const item = credentials.find((c) => c.id === id);
    if (!item) return;
    const nextVal = !item.isFavorite;

    await credentialsApi.update(id, { is_favorite: nextVal });
    setCredentials((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isFavorite: nextVal } : c))
    );
  };

  const clearError = () => setError(null);

  return (
    <VaultContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isVaultUnlocked: !!vaultKey,
        vaultKey,
        credentials,
        isLoading,
        isDecrypting,
        error,
        autoLockMinutes,
        setAutoLockMinutes,
        secondsUntilLock,
        activityLogs,
        login,
        register,
        logout,
        lockVault,
        unlockWithPassword,
        refreshCredentials,
        createCredential,
        updateCredential,
        deleteCredential,
        toggleFavorite,
        logActivity,
        clearError,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
