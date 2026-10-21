from rest_framework import serializers
from .models import User, EncryptedCredential, SessionAudit


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'vault_salt', 'created_at']
        read_only_fields = ['id', 'role', 'created_at']


class UserRegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    vault_salt = serializers.CharField(max_length=64, required=False, allow_blank=True)

    def validate_email(self, value):
        normalized = value.lower().strip()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("A user with this email address already exists.")
        return normalized

    def create(self, validated_data):
        # Strict zero-knowledge boundary & security enforcement:
        # Standard signup NEVER creates admin accounts.
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data.get('full_name', ''),
            vault_salt=validated_data.get('vault_salt', ''),
            role='user',
            is_staff=False,
            is_superuser=False,
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class EncryptedCredentialSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = EncryptedCredential
        fields = [
            'id',
            'user_email',
            'encrypted_payload',
            'iv',
            'tag',
            'category',
            'title_hint',
            'is_favorite',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user_email', 'created_at', 'updated_at']

    def validate_encrypted_payload(self, value):
        if not value or not isinstance(value, str) or len(value.strip()) == 0:
            raise serializers.ValidationError("Encrypted payload ciphertext cannot be empty.")
        return value

    def validate_iv(self, value):
        if not value or not isinstance(value, str) or len(value.strip()) == 0:
            raise serializers.ValidationError("Initialization vector (IV) cannot be empty.")
        return value


class SessionAuditSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    masked_session_key = serializers.SerializerMethodField()

    class Meta:
        model = SessionAudit
        fields = [
            'id',
            'user_email',
            'masked_session_key',
            'ip_address',
            'user_agent',
            'device_info',
            'login_time',
            'last_active',
            'status',
        ]
        read_only_fields = fields

    def get_masked_session_key(self, obj):
        if not obj.session_key:
            return '---'
        if len(obj.session_key) <= 8:
            return '****'
        return f"{obj.session_key[:4]}...{obj.session_key[-4:]}"
