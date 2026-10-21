/**
 * Argus Vault - Client-Side Zero-Knowledge Cryptography Module
 * Uses the standard Web Crypto API (SubtleCrypto).
 * 
 * Cryptographic Specifications:
 * - Master Key Derivation: PBKDF2 with SHA-256, 100,000 iterations
 * - Vault Item Encryption: AES-256-GCM with cryptographically random 12-byte IV per item
 * - Zero-Knowledge Guarantee: Decryption keys and plaintext secrets NEVER leave client memory.
 */

export interface CredentialPayload {
  title: string;
  category: 'login' | 'card' | 'note' | 'server' | 'general';
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  customFields?: { label: string; value: string }[];
  updatedAt?: string;
}

export interface EncryptedResult {
  encryptedPayload: string; // Base64
  iv: string;               // Base64
  tag?: string;             // Base64 (optional, AES-GCM includes tag in ciphertext)
}

/**
 * Converts a string or hex string into Uint8Array bytes.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Standard Base64 encode and decode compatible with browser and Node WebCrypto.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a 256-bit AES-GCM Master Vault Key from user's master password and vault salt using PBKDF2.
 */
export async function deriveVaultKey(
  masterPassword: string,
  saltHexOrString: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(masterPassword);

  // Use salt bytes; if 64-char hex, decode, otherwise encode utf8
  let saltBytes: Uint8Array;
  if (/^[0-9a-fA-F]{64}$/.test(saltHexOrString)) {
    saltBytes = hexToBytes(saltHexOrString);
  } else {
    saltBytes = encoder.encode(saltHexOrString || 'argus_default_vault_salt_2026');
  }

  // Import raw password as PBKDF2 key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // Derive AES-GCM 256-bit key
  const vaultKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // Key cannot be extracted from memory
    ['encrypt', 'decrypt']
  );

  return vaultKey;
}

/**
 * Encrypts an arbitrary object using AES-256-GCM with a fresh random 12-byte IV.
 */
export async function encryptCredential(
  payload: CredentialPayload,
  key: CryptoKey
): Promise<EncryptedResult> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(JSON.stringify(payload));

  // Generate 12-byte fresh IV per NIST recommendations for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      tagLength: 128,
    },
    key,
    plaintextBytes as unknown as BufferSource
  );

  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  return {
    encryptedPayload: bytesToBase64(ciphertextBytes),
    iv: bytesToBase64(iv),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext using the in-memory Vault Key.
 */
export async function decryptCredential(
  encryptedPayloadBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<CredentialPayload> {
  const ciphertextBytes = base64ToBytes(encryptedPayloadBase64);
  const ivBytes = base64ToBytes(ivBase64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as unknown as BufferSource,
      tagLength: 128,
    },
    key,
    ciphertextBytes as unknown as BufferSource
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonString) as CredentialPayload;
}

/**
 * Password Generator with configurable entropy parameters.
 */
export interface PasswordGeneratorOptions {
  length: number;
  useUpper: boolean;
  useLower: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
  avoidAmbiguous: boolean;
}

export function generatePassword(options: PasswordGeneratorOptions): string {
  const {
    length = 20,
    useUpper = true,
    useLower = true,
    useNumbers = true,
    useSymbols = true,
    avoidAmbiguous = true,
  } = options;

  let upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let lower = 'abcdefghijkmnopqrstuvwxyz';
  let numbers = '23456789';
  let symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!avoidAmbiguous) {
    upper += 'I' + 'O';
    lower += 'l' + 'o';
    numbers += '0' + '1';
  }

  let charset = '';
  const requiredChars: string[] = [];

  if (useUpper && upper.length > 0) {
    charset += upper;
    requiredChars.push(getRandomChar(upper));
  }
  if (useLower && lower.length > 0) {
    charset += lower;
    requiredChars.push(getRandomChar(lower));
  }
  if (useNumbers && numbers.length > 0) {
    charset += numbers;
    requiredChars.push(getRandomChar(numbers));
  }
  if (useSymbols && symbols.length > 0) {
    charset += symbols;
    requiredChars.push(getRandomChar(symbols));
  }

  if (charset.length === 0) {
    charset = lower + numbers;
  }

  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  const result: string[] = [...requiredChars];
  for (let i = requiredChars.length; i < length; i++) {
    result.push(charset[randomValues[i] % charset.length]);
  }

  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result.join('');
}

function getRandomChar(str: string): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return str[arr[0] % str.length];
}

/**
 * Calculates password entropy and security rating.
 */
export function evaluatePasswordStrength(password: string): {
  score: number; // 0 to 4
  label: 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Military-Grade';
  entropy: number;
} {
  if (!password) {
    return { score: 0, label: 'Weak', entropy: 0 };
  }

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;

  if (poolSize === 0) poolSize = 10;
  const entropy = Math.floor(password.length * Math.log2(poolSize));

  if (entropy < 36) return { score: 0, label: 'Weak', entropy };
  if (entropy < 60) return { score: 1, label: 'Fair', entropy };
  if (entropy < 80) return { score: 2, label: 'Good', entropy };
  if (entropy < 100) return { score: 3, label: 'Strong', entropy };
  return { score: 4, label: 'Military-Grade', entropy };
}
