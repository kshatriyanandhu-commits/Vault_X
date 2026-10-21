from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, EncryptedCredential, SessionAudit


class ArgusVaultBackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create two standard users
        self.user_a = User.objects.create_user(
            email='alice@example.com',
            password='Password123!',
            full_name='Alice Smith',
            vault_salt='salt_alice_1234567890abcdef1234567890abcdef',
            role='user',
        )

        self.user_b = User.objects.create_user(
            email='bob@example.com',
            password='Password123!',
            full_name='Bob Jones',
            vault_salt='salt_bob_1234567890abcdef1234567890abcdef',
            role='user',
        )

        # Create an admin user
        self.admin = User.objects.create_superuser(
            email='admin@argusvault.local',
            password='ArgusAdmin2026!Secure',
            full_name='Security Admin',
        )

    # -------------------------------------------------------------
    # 1. AUTHENTICATION & SECURITY BOUNDARY TESTS
    # -------------------------------------------------------------
    def test_registration_creates_only_standard_user(self):
        """Verify registration always creates standard user and ignores privilege escalation attempts."""
        payload = {
            'email': 'charlie@example.com',
            'password': 'CharliePassword2026!',
            'full_name': 'Charlie',
            'vault_salt': 'random_salt_123',
            'role': 'admin',  # Attempt to escalate privilege
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['role'], 'user')

        user = User.objects.get(email='charlie@example.com')
        self.assertEqual(user.role, 'user')
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_login_success_and_session_audit_created(self):
        """Verify login sets session cookie and creates SessionAudit record."""
        response = self.client.post('/api/auth/login/', {
            'email': 'alice@example.com',
            'password': 'Password123!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'alice@example.com')

        # Check session audit record
        audit = SessionAudit.objects.filter(user=self.user_a, status='active').first()
        self.assertIsNotNone(audit)

    def test_login_invalid_credentials_rejected(self):
        """Verify invalid credentials return 401."""
        response = self.client.post('/api/auth/login/', {
            'email': 'alice@example.com',
            'password': 'WrongPassword!',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_endpoint_requires_auth(self):
        """Verify /api/auth/me/ requires authenticated session."""
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'alice@example.com')
        self.assertEqual(response.data['vault_salt'], self.user_a.vault_salt)

    # -------------------------------------------------------------
    # 2. ZERO-KNOWLEDGE CREDENTIAL ISOLATION TESTS
    # -------------------------------------------------------------
    def test_credential_isolation_between_users(self):
        """
        Verify complete isolation between users:
        - User A cannot see User B's credentials
        - User A cannot access or modify User B's credential by ID
        """
        # User A creates credential
        cred_a = EncryptedCredential.objects.create(
            user=self.user_a,
            encrypted_payload='AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=',
            iv='YWJjZGVmZ2hpams=',
            tag='dGFnMTIzNDU2',
            category='login',
            title_hint='Alice GitHub',
        )

        # User B creates credential
        cred_b = EncryptedCredential.objects.create(
            user=self.user_b,
            encrypted_payload='MDIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=',
            iv='MTIzNDU2Nzg5MDEy',
            tag='YXV0aHRhZzk4NzY=',
            category='note',
            title_hint='Bob Secret Key',
        )

        # Alice requests her credentials
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/credentials/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in response.data]
        self.assertIn(str(cred_a.id), ids)
        self.assertNotIn(str(cred_b.id), ids)

        # Alice attempts to GET Bob's credential directly by ID -> 404 (strictly filtered)
        response = self.client.get(f'/api/credentials/{cred_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Alice attempts to DELETE Bob's credential -> 404
        response = self.client.delete(f'/api/credentials/{cred_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_can_crud_own_encrypted_credentials(self):
        """Verify user can create, read, update, and delete own credentials."""
        self.client.force_authenticate(user=self.user_a)

        # Create
        create_resp = self.client.post('/api/credentials/', {
            'encrypted_payload': 'ZW5jcnlwdGVkX2Jsb2JfeHh4',
            'iv': 'MTIzNDU2Nzg5MDEy',
            'tag': 'dGFnOTk5',
            'category': 'login',
            'title_hint': 'Banking Portal',
            'is_favorite': True,
        }, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        cred_id = create_resp.data['id']

        # Update
        patch_resp = self.client.patch(f'/api/credentials/{cred_id}/', {
            'title_hint': 'Banking Portal Updated',
        }, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['title_hint'], 'Banking Portal Updated')

        # Delete
        del_resp = self.client.delete(f'/api/credentials/{cred_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(EncryptedCredential.objects.filter(id=cred_id).exists())

    # -------------------------------------------------------------
    # 3. ADMIN PERMISSIONS & AUDIT TESTS
    # -------------------------------------------------------------
    def test_regular_user_denied_admin_endpoints(self):
        """Verify standard users receive 403 Forbidden on all admin endpoints."""
        self.client.force_authenticate(user=self.user_a)

        # Admin sessions
        resp1 = self.client.get('/api/admin/sessions/')
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)

        # Admin stats
        resp2 = self.client.get('/api/admin/stats/')
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_access_and_session_revocation(self):
        """
        Verify admin can inspect sessions, aggregate stats, and revoke active sessions.
        Also verifies zero-knowledge: stats does not expose ciphertext or secrets.
        """
        # Create session audit for Alice
        audit = SessionAudit.objects.create(
            user=self.user_a,
            session_key='alice_session_key_12345',
            ip_address='192.168.1.100',
            user_agent='Mozilla/5.0 Chrome',
            device_info='Chrome on Windows',
            status='active',
        )

        # Authenticate as Admin
        self.client.force_authenticate(user=self.admin)

        # Check admin stats
        stats_resp = self.client.get('/api/admin/stats/')
        self.assertEqual(stats_resp.status_code, status.HTTP_200_OK)
        self.assertIn('total_users', stats_resp.data)
        self.assertIn('active_sessions', stats_resp.data)
        self.assertIn('total_vault_items', stats_resp.data)
        # Verify no ciphertext or keys are returned in stats
        self.assertNotIn('encrypted_payload', stats_resp.data)
        self.assertNotIn('master_key', stats_resp.data)

        # Check admin sessions list
        sessions_resp = self.client.get('/api/admin/sessions/')
        self.assertEqual(sessions_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(len(sessions_resp.data) >= 1)

        # Revoke Alice's session
        revoke_resp = self.client.post(f'/api/admin/sessions/{audit.id}/revoke/')
        self.assertEqual(revoke_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(revoke_resp.data['status'], 'revoked')

        audit.refresh_from_db()
        self.assertEqual(audit.status, 'revoked')
