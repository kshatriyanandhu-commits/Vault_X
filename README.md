# 🛡️ Argus Vault

> **Complete Full-Stack Zero-Knowledge Credential Vault** featuring an interactive 3D machined steel vault door, client-side Web Crypto AES-256-GCM encryption, and an administrative session-audit console.

---

## 🌟 Highlights & Key Features

1. **Interactive 3D Steel Vault Door (Three.js)**:
   - High-precision procedural 3D model: dark-machined steel door plate, 8 radial locking bolts, central brass combination dial with graduation tick marks, 3-spoke turning helm, and dual status LED indicator diodes.
   - **Idle Parallax**: Subtle mouse parallax lighting and breathing cyan status pulse.
   - **Typing Mechanics**: Central dial spins dynamically with realistic mechanical motion as the operator types in the master password field.
   - **Unlock Sequence**: On valid authentication, LEDs switch to neon emerald, the turning helm spins 360°, heavy steel bolts slide inward, and the vault door swings open 77° on its hinge to reveal the glowing interior chamber.
   - **Reject Vibration**: On invalid credentials, LEDs flash alert red, and the door violently rattles with decaying sinusoidal oscillation.
   - **Clean WebGL Fallback**: High-performance SVG/CSS schematic vault door for low-spec environments with an instant toggle pill in the corner.

2. **Client-Side Zero-Knowledge Encryption (Web Crypto API)**:
   - **PBKDF2 Key Derivation**: Derives 256-bit AES-GCM vault keys client-side using SHA-256 and 100,000 iterations from the master password and a per-user salt.
   - **AES-256-GCM Encryption**: Generates a fresh cryptographically random 12-byte IV (`crypto.getRandomValues`) for every credential item prior to transmission.
   - **Strict Zero-Knowledge Boundary**: The server and database **ONLY** store encrypted ciphertext blobs and IVs. Decryption keys and plaintext secrets **NEVER** leave client memory.
   - **Auto-Lock Security**: Configurable idle timer (5m / 15m / 30m) that automatically purges master keys from browser memory on timeout.

3. **Admin Session-Audit Console**:
   - Live telemetry: Aggregate user counts, active sessions, revoked access tokens, and encrypted item counts.
   - **Strict Zero-Knowledge**: Admin console counts records without querying or exposing any ciphertext, keys, or decrypted secrets.
   - **Remote Session Revocation**: Admins can immediately terminate any active session, destroying the underlying Django session so subsequent requests are rejected with HTTP 401.

4. **Production Architecture**:
   - Backend: Python 3.11+ / Django 5 / Django REST Framework / PostgreSQL (with automatic SQLite fallback for zero-config local runs) / Argon2 password hashing.
   - Frontend: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS / Three.js.
   - Ports: Django runs on `http://127.0.0.1:8000`, Next.js runs on `http://localhost:8080`.

---

## 🏛️ Monorepo Architecture

```
VAULT_X/
├── backend/                               # Python 3.11+ Django REST Framework service
│   ├── argus_vault_backend/               # Django project configuration
│   │   ├── settings.py                    # Settings (Postgres/SQLite, CORS, Argon2, Session Middleware)
│   │   ├── urls.py                        # Project URL router (/api/, /django-admin/)
│   │   └── wsgi.py
│   ├── vault_api/                         # Core API application
│   │   ├── models.py                      # User, EncryptedCredential, SessionAudit
│   │   ├── middleware.py                  # SessionAuditMiddleware (tracks activity, rejects revoked sessions)
│   │   ├── permissions.py                 # IsVaultAdmin, IsOwner
│   │   ├── serializers.py                 # DRF serializers (zero-knowledge sanitization)
│   │   ├── views.py                       # Auth, Credentials CRUD, Admin sessions & stats
│   │   ├── urls.py                        # API route definitions
│   │   ├── tests.py                       # Comprehensive Django unit & security test suite
│   │   └── management/commands/
│   │       └── createsuperadmin.py        # Management command to provision superadmins
│   ├── requirements.txt                   # Django, DRF, psycopg, argon2-cffi, etc.
│   ├── manage.py
│   └── .env.example
│
├── frontend/                              # Next.js 16 App Router & Three.js service
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                 # Root layout with VaultProvider wrapper
│   │   │   ├── page.tsx                   # Interactive 3D Vault Door login & register view
│   │   │   ├── vault/page.tsx             # Unlocked Personal Vault (search, filter, copy, export)
│   │   │   ├── admin/page.tsx             # Admin Session-Audit Console (metrics, revoke sessions)
│   │   │   └── globals.css                # Dark titanium styling & keyframe animations
│   │   ├── components/
│   │   │   ├── vault3d/
│   │   │   │   ├── VaultDoor3D.tsx        # Three.js Machined Steel Vault Door component
│   │   │   │   ├── VaultDoorFallback.tsx  # SVG/CSS WebGL fallback schematic vault door
│   │   │   │   └── VaultDoorContainer.tsx # Container with WebGL detection & toggle pill
│   │   │   └── vault/
│   │   │       ├── CredentialModal.tsx    # Add / Edit Credential modal with client encryption
│   │   │       └── PasswordGeneratorModal.tsx # Entropy slider & generator
│   │   ├── context/
│   │   │   └── VaultContext.tsx           # Global in-memory state & auto-lock timer
│   │   └── lib/
│   │       ├── api.ts                     # API client with CSRF token handling & session fetch
│   │       └── crypto.ts                  # Web Crypto API: PBKDF2 & AES-256-GCM engine
│   ├── scripts/
│   │   └── test-crypto.mjs                # Web Crypto roundtrip, tampering & entropy test suite
│   ├── next.config.ts                     # Port 8080 configuration & API proxy
│   ├── package.json
│   └── .env.example
│
├── start_backend.bat                      # 1-click startup script for Django backend
├── start_frontend.bat                     # 1-click startup script for Next.js frontend
├── package.json                           # Root monorepo orchestration scripts
└── README.md
```

---

## 🔐 Zero-Knowledge Security Model

| Security Layer | Implementation Details |
| :--- | :--- |
| **Key Derivation** | PBKDF2 (`SHA-256`, 100,000 iterations) using user master password and unique salt. |
| **Vault Encryption** | AES-256-GCM with fresh 12-byte random IV per record (`crypto.getRandomValues`). |
| **Authentication Hash** | Server verifies identity using Argon2id / PBKDF2 password hashes. Master vault keys are **never** transmitted to the server. |
| **Session Control** | Secure `httpOnly`, `SameSite=Lax` cookies with dynamic CSRF token validation. |
| **Revocation** | Immediate server-side session flush. Any request using a revoked session is rejected with HTTP 401. |
| **Admin Boundary** | Administrators can audit telemetry (user counts, sessions, device info) but **cannot** query credential ciphertexts or master keys. |

---

## ⚡ Quickstart & Execution

### 1. Provision Backend (Django)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment and activate
python -m venv venv
venv\Scripts\activate          # Windows PowerShell / CMD
# source venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed initial Superadmin
python manage.py createsuperadmin

# Start Django development server on port 8000
python manage.py runserver 127.0.0.1:8000
```

> **Default Seeded Admin Credentials:**
> - Email: `admin@argusvault.local`
> - Password: `ArgusAdmin2026!Secure`

---

### 2. Provision Frontend (Next.js)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Start Next.js on port 8080
npm run dev
```

Visit **`http://localhost:8080`** in your browser.

---

### 3. One-Click Startup (Windows)

You can launch both services simultaneously using the root scripts:
- Double-click **`start_backend.bat`** (launches backend on `http://127.0.0.1:8000`)
- Double-click **`start_frontend.bat`** (launches frontend on `http://localhost:8080`)

---

## 🧪 Automated Testing Suites

### 1. Backend Permissions & Isolation Tests (Django)

Verifies standard user role restriction, prevents registration privilege escalation, validates per-user credential isolation, and verifies admin session revocation.

```bash
cd backend
.\venv\Scripts\python.exe manage.py test
```

*Expected output:*
```
Ran 8 tests in 1.4s
OK
```

### 2. Frontend Zero-Knowledge Cryptography Tests (Web Crypto)

Verifies PBKDF2 key derivation, AES-256-GCM roundtrip encryption/decryption, fresh IV verification, tamper resistance, and password generator entropy.

```bash
cd frontend
npm run test
```

*Expected output:*
```
🧪 [Argus Vault] Running Zero-Knowledge Cryptography Tests...
  1. Testing PBKDF2 Key Derivation...
     ✓ Key derived successfully (AES-GCM 256-bit)
  2. Testing AES-256-GCM Encryption / Decryption Roundtrip...
     ✓ Payload successfully encrypted to ciphertext
     ✓ Decryption roundtrip verified with 100% fidelity
  3. Testing IV freshness (different ciphertext for identical plaintext)...
     ✓ Fresh cryptographic nonce verified
  4. Testing Tamper Resistance (GCM auth tag verification)...
     ✓ Tampered ciphertext rejected by AES-GCM integrity check
  5. Testing Wrong Password Rejection...
     ✓ Decryption with incorrect key properly rejected
  6. Testing Password Generator & Entropy Evaluator...
     ✓ Generated password: length=24, entropy=157 bits, rating=Military-Grade
🔒 ALL ZERO-KNOWLEDGE CRYPTOGRAPHY TESTS PASSED SUCCESSFULLY! 🔒
```

### 3. Run All Tests Simultaneously

From the project root:
```bash
npm run test
```

---

## 📡 API Endpoints Reference

### Authentication
- `GET /api/auth/csrf/`: Fetch CSRF token and set `csrftoken` cookie.
- `POST /api/auth/register/`: Register a new standard user account (strictly creates `role="user"`).
- `POST /api/auth/login/`: Authenticate user and issue secure session cookie.
- `POST /api/auth/logout/`: Invalidate user session and mark session as expired.
- `GET /api/auth/me/`: Retrieve authenticated user profile and zero-knowledge salt.

### Zero-Knowledge Credentials
- `GET /api/credentials/`: List encrypted credential blobs owned by `request.user`. Supports `?category=`, `?search=`, `?favorite=true`.
- `POST /api/credentials/`: Store new client-side encrypted blob (`encrypted_payload`, `iv`, `tag`, `category`, `title_hint`).
- `GET /api/credentials/<uuid>/`: Retrieve single encrypted record owned by `request.user`.
- `PATCH /api/credentials/<uuid>/`: Update encrypted payload / metadata for owner's item.
- `DELETE /api/credentials/<uuid>/`: Delete owner's credential item.

### Admin Session Console
- `GET /api/admin/sessions/`: List session audit records across all users (supports `?status=` and `?search=`).
- `POST /api/admin/sessions/<uuid>/revoke/`: Remotely terminate active session and destroy session cookie in DB.
- `GET /api/admin/stats/`: Retrieve aggregate platform metrics (users, active sessions, revoked sessions, total encrypted blobs).

---

## 📜 License
MIT License. Built for advanced security engineering.
