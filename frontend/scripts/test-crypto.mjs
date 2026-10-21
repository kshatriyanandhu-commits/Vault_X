import assert from 'node:assert';
import {
  deriveVaultKey,
  encryptCredential,
  decryptCredential,
  generatePassword,
  evaluatePasswordStrength,
} from '../src/lib/crypto.ts';

// Ensure Web Crypto API is globally available
if (!globalThis.crypto) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}

console.log('🧪 [Argus Vault] Running Zero-Knowledge Cryptography Tests...');

async function runTests() {
  const masterPassword = 'MasterKeyPassword2026!$#UltraSecure';
  const vaultSalt = 'e5f2a1b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6';

  // Test 1: Key Derivation
  console.log('  1. Testing PBKDF2 Key Derivation...');
  const key1 = await deriveVaultKey(masterPassword, vaultSalt);
  assert.ok(key1, 'Vault Key was not derived');
  assert.strictEqual(key1.type, 'secret', 'Vault Key must be a secret key');
  assert.strictEqual(key1.algorithm.name, 'AES-GCM', 'Vault Key must be AES-GCM');
  console.log('     ✓ Key derived successfully (AES-GCM 256-bit)');

  // Test 2: Encryption and Decryption Roundtrip
  console.log('  2. Testing AES-256-GCM Encryption / Decryption Roundtrip...');
  const secretPayload = {
    title: 'AWS Production Root Credential',
    category: 'server',
    username: 'root@argusvault.cloud',
    password: 'SuperSecretProductionPassword!@#123',
    url: 'https://console.aws.amazon.com',
    notes: 'Zero-knowledge encrypted cloud credential. Never leaked.',
    customFields: [{ label: 'MFA ARN', value: 'arn:aws:iam::123456789012:mfa/root' }],
  };

  const encrypted = await encryptCredential(secretPayload, key1);
  assert.ok(encrypted.encryptedPayload, 'Encrypted payload is missing');
  assert.ok(encrypted.iv, 'IV is missing');
  assert.notStrictEqual(encrypted.encryptedPayload, JSON.stringify(secretPayload));
  console.log('     ✓ Payload successfully encrypted to ciphertext');

  const decrypted = await decryptCredential(encrypted.encryptedPayload, encrypted.iv, key1);
  assert.deepStrictEqual(decrypted, secretPayload, 'Decrypted payload did not match original!');
  console.log('     ✓ Decryption roundtrip verified with 100% fidelity');

  // Test 3: Fresh IV per encryption
  console.log('  3. Testing IV freshness (different ciphertext for identical plaintext)...');
  const encrypted2 = await encryptCredential(secretPayload, key1);
  assert.notStrictEqual(encrypted.iv, encrypted2.iv, 'IV must be unique per encryption');
  assert.notStrictEqual(encrypted.encryptedPayload, encrypted2.encryptedPayload, 'Ciphertext must differ with fresh IV');
  console.log('     ✓ Fresh cryptographic nonce verified');

  // Test 4: Tampering Detection (Authenticated Encryption AEAD integrity)
  console.log('  4. Testing Tamper Resistance (GCM auth tag verification)...');
  let tamperedPayload = encrypted.encryptedPayload;
  // Flip a character in base64 payload
  const lastChar = tamperedPayload.slice(-1);
  const newChar = lastChar === 'A' ? 'B' : 'A';
  tamperedPayload = tamperedPayload.slice(0, -1) + newChar;

  let tamperCaught = false;
  try {
    await decryptCredential(tamperedPayload, encrypted.iv, key1);
  } catch (err) {
    tamperCaught = true;
  }
  assert.strictEqual(tamperCaught, true, 'Tampered ciphertext must fail decryption');
  console.log('     ✓ Tampered ciphertext rejected by AES-GCM integrity check');

  // Test 5: Wrong Master Password Detection
  console.log('  5. Testing Wrong Password Rejection...');
  const wrongKey = await deriveVaultKey('WrongPassword123!', vaultSalt);
  let wrongKeyFailed = false;
  try {
    await decryptCredential(encrypted.encryptedPayload, encrypted.iv, wrongKey);
  } catch (err) {
    wrongKeyFailed = true;
  }
  assert.strictEqual(wrongKeyFailed, true, 'Wrong key must fail decryption');
  console.log('     ✓ Decryption with incorrect key properly rejected');

  // Test 6: Password Generator and Strength Evaluator
  console.log('  6. Testing Password Generator & Entropy Evaluator...');
  const genPass = generatePassword({
    length: 24,
    useUpper: true,
    useLower: true,
    useNumbers: true,
    useSymbols: true,
    avoidAmbiguous: true,
  });
  assert.strictEqual(genPass.length, 24);
  const strength = evaluatePasswordStrength(genPass);
  assert.ok(strength.entropy > 100, '24-char complex password must have high entropy');
  assert.strictEqual(strength.score, 4, 'Score should be 4 (Military-Grade)');
  console.log(`     ✓ Generated password: length=${genPass.length}, entropy=${strength.entropy} bits, rating=${strength.label}`);

  console.log('\n🔒 ALL ZERO-KNOWLEDGE CRYPTOGRAPHY TESTS PASSED SUCCESSFULLY! 🔒\n');
}

runTests().catch((err) => {
  console.error('❌ Cryptography Test Failed:', err);
  process.exit(1);
});
