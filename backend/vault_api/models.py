import uuid
import secrets
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone


class CustomUserManager(BaseUserManager):
    """
    Custom user manager where email is the unique identifier for auth.
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        extra_fields.setdefault('role', 'user')
        if not extra_fields.get('vault_salt'):
            extra_fields['vault_salt'] = secrets.token_hex(32)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('role') != 'admin':
            raise ValueError('Superuser must have role="admin".')
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model with email authentication, role-based access, and zero-knowledge vault salt.
    """
    ROLE_CHOICES = (
        ('user', 'Standard User'),
        ('admin', 'Vault Administrator'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True, default='')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    vault_salt = models.CharField(max_length=64, blank=True, help_text="Random per-user salt for client-side PBKDF2 derivation")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.email} ({self.role})"

    @property
    def is_admin(self):
        return self.role == 'admin' or self.is_superuser or self.is_staff


class EncryptedCredential(models.Model):
    """
    Zero-Knowledge Encrypted Credential Vault Item.
    The server only ever stores encrypted ciphertext blobs, initialization vectors (IV/nonce),
    and auth tags. Plaintext secrets and decryption keys NEVER touch the server.
    """
    CATEGORY_CHOICES = (
        ('login', 'Login Credential'),
        ('card', 'Payment Card'),
        ('note', 'Secure Note'),
        ('server', 'Server / API Key'),
        ('general', 'General Secret'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='credentials', db_index=True)
    
    # Cryptographic fields (all generated client-side)
    encrypted_payload = models.TextField(help_text="AES-256-GCM encrypted JSON payload (Base64)")
    iv = models.CharField(max_length=64, help_text="Initialization vector/nonce (Base64 or Hex)")
    tag = models.CharField(max_length=64, blank=True, default='', help_text="Optional separate GCM auth tag")
    
    # Metadata for indexing (client may provide encrypted or masked metadata)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='login')
    title_hint = models.CharField(max_length=255, blank=True, default='', help_text="Client-provided label or hint")
    is_favorite = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Encrypted Credential'
        verbose_name_plural = 'Encrypted Credentials'
        ordering = ['-updated_at']

    def __str__(self):
        return f"EncryptedCredential({self.id}) for {self.user.email} [{self.category}]"


class SessionAudit(models.Model):
    """
    Tracks active user sessions, audit records, and security revocations.
    """
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('revoked', 'Revoked'),
        ('expired', 'Expired'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='session_audits', db_index=True)
    session_key = models.CharField(max_length=128, db_index=True, help_text="Django session key or token hash")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    device_info = models.CharField(max_length=255, blank=True, default='')
    login_time = models.DateTimeField(default=timezone.now)
    last_active = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True)

    class Meta:
        verbose_name = 'Session Audit'
        verbose_name_plural = 'Session Audits'
        ordering = ['-last_active']

    def __str__(self):
        return f"SessionAudit({self.user.email} - {self.status} - {self.ip_address})"
