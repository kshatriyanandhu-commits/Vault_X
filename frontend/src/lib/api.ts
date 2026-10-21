/**
 * Argus Vault - API Client
 * Connects frontend to the Django REST Framework backend with CSRF & session handling.
 */

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  vault_salt: string;
  created_at: string;
}

export interface StoredCredentialRecord {
  id: string;
  user_email: string;
  encrypted_payload: string;
  iv: string;
  tag: string;
  category: 'login' | 'card' | 'note' | 'server' | 'general';
  title_hint: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionAuditRecord {
  id: string;
  user_email: string;
  masked_session_key: string;
  ip_address: string | null;
  user_agent: string;
  device_info: string;
  login_time: string;
  last_active: string;
  status: 'active' | 'revoked' | 'expired';
}

export interface AdminStats {
  total_users: number;
  standard_users: number;
  admin_users: number;
  total_sessions: number;
  active_sessions: number;
  revoked_sessions: number;
  total_vault_items: number;
  recent_activity: SessionAuditRecord[];
}

const API_BASE = '/api';

/**
 * Extracts CSRF token from document.cookie
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Fetches CSRF token from API if not yet present
 */
export async function ensureCsrfToken(): Promise<string> {
  let token = getCookie('csrftoken');
  if (token) return token;

  try {
    const res = await fetch(`${API_BASE}/auth/csrf/`, {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      token = data.csrfToken || getCookie('csrftoken') || '';
    }
  } catch (err) {
    console.warn('Failed to pre-fetch CSRF token:', err);
  }
  return token || '';
}

/**
 * Core fetch wrapper with CSRF injection and credential inclusion
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject CSRF token for mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) {
      headers.set('X-CSRFToken', csrfToken);
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return {} as T;
  }

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      responseData.detail ||
      responseData.message ||
      (typeof responseData === 'object' ? JSON.stringify(responseData) : 'Request failed');
    const error = new Error(errorMessage) as any;
    error.status = response.status;
    error.data = responseData;
    throw error;
  }

  return responseData as T;
}

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
export const authApi = {
  getCsrfToken: () => ensureCsrfToken(),

  register: (payload: { email: string; password: string; full_name?: string; vault_salt?: string }) =>
    apiFetch<UserProfile>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<UserProfile>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    apiFetch<{ detail: string }>('/auth/logout/', {
      method: 'POST',
    }),

  me: () =>
    apiFetch<UserProfile>('/auth/me/'),
};

// -------------------------------------------------------------
// Zero-Knowledge Credential Endpoints
// -------------------------------------------------------------
export const credentialsApi = {
  list: (params?: { category?: string; search?: string; favorite?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.category && params.category !== 'all') {
      searchParams.set('category', params.category);
    }
    if (params?.search) {
      searchParams.set('search', params.search);
    }
    if (params?.favorite) {
      searchParams.set('favorite', 'true');
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiFetch<StoredCredentialRecord[]>(`/credentials/${query}`);
  },

  get: (id: string) =>
    apiFetch<StoredCredentialRecord>(`/credentials/${id}/`),

  create: (data: {
    encrypted_payload: string;
    iv: string;
    tag?: string;
    category?: string;
    title_hint?: string;
    is_favorite?: boolean;
  }) =>
    apiFetch<StoredCredentialRecord>('/credentials/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: {
      encrypted_payload?: string;
      iv?: string;
      tag?: string;
      category?: string;
      title_hint?: string;
      is_favorite?: boolean;
    }
  ) =>
    apiFetch<StoredCredentialRecord>(`/credentials/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<void>(`/credentials/${id}/`, {
      method: 'DELETE',
    }),
};

// -------------------------------------------------------------
// Admin Session-Audit Endpoints
// -------------------------------------------------------------
export const adminApi = {
  getStats: () =>
    apiFetch<AdminStats>('/admin/stats/'),

  getSessions: (params?: { status?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status && params.status !== 'all') {
      searchParams.set('status', params.status);
    }
    if (params?.search) {
      searchParams.set('search', params.search);
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiFetch<SessionAuditRecord[]>(`/admin/sessions/${query}`);
  },

  revokeSession: (id: string) =>
    apiFetch<{ detail: string; session_id: string; status: string }>(
      `/admin/sessions/${id}/revoke/`,
      { method: 'POST' }
    ),
};
