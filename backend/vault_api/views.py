from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.contrib.sessions.models import Session
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import User, EncryptedCredential, SessionAudit
from .serializers import (
    UserSerializer,
    UserRegisterSerializer,
    UserLoginSerializer,
    EncryptedCredentialSerializer,
    SessionAuditSerializer,
)
from .permissions import IsVaultAdmin, IsOwner
from .middleware import get_client_ip, parse_device_info


class CSRFTokenView(APIView):
    """
    Returns CSRF token and sets csrftoken cookie.
    Accessible without authentication.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = get_token(request)
        return Response({'csrfToken': token})


class RegisterView(APIView):
    """
    Registers a new standard user (strictly role='user').
    Automatically establishes session and returns user profile.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Log user in
            login(request, user)
            
            # Record initial session audit
            session_key = request.session.session_key
            if not session_key:
                request.session.save()
                session_key = request.session.session_key
                
            ip = get_client_ip(request)
            ua = request.META.get('HTTP_USER_AGENT', '')
            SessionAudit.objects.create(
                user=user,
                session_key=session_key,
                ip_address=ip,
                user_agent=ua,
                device_info=parse_device_info(ua),
                status='active',
            )

            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """
    Authenticates user, creates session audit entry, and sets session cookie.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        password = serializer.validated_data['password']

        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response(
                {'detail': 'Invalid email or master password combination.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {'detail': 'This account has been deactivated.'},
                status=status.HTTP_403_FORBIDDEN
            )

        login(request, user)
        session_key = request.session.session_key
        if not session_key:
            request.session.save()
            session_key = request.session.session_key

        ip = get_client_ip(request)
        ua = request.META.get('HTTP_USER_AGENT', '')
        SessionAudit.objects.create(
            user=user,
            session_key=session_key,
            ip_address=ip,
            user_agent=ua,
            device_info=parse_device_info(ua),
            status='active',
        )

        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Logs out the current user and marks their session audit status as 'revoked'/'expired'.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        session_key = request.session.session_key
        if session_key:
            SessionAudit.objects.filter(session_key=session_key).update(status='expired')
        logout(request)
        return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)


class MeView(APIView):
    """
    Returns the authenticated user's profile and zero-knowledge salt.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class EncryptedCredentialViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for zero-knowledge encrypted credentials.
    Strictly isolated per-user: users can ONLY query and manipulate their own records.
    """
    serializer_class = EncryptedCredentialSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        # Strict isolation: filter exclusively by the authenticated user
        qs = EncryptedCredential.objects.filter(user=self.request.user)
        
        category = self.request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category=category)
            
        is_favorite = self.request.query_params.get('favorite')
        if is_favorite in ['true', '1', 'True']:
            qs = qs.filter(is_favorite=True)
            
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(title_hint__icontains=search)

        return qs

    def perform_create(self, serializer):
        # Automatically assign the logged-in user
        serializer.save(user=self.request.user)


class AdminSessionListView(APIView):
    """
    Admin View: Lists all audit sessions across users.
    Supports filtering by status and searching by email or IP.
    """
    permission_classes = [IsVaultAdmin]

    def get(self, request):
        qs = SessionAudit.objects.select_related('user').all()

        status_param = request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param)

        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(user__email__icontains=search) |
                Q(ip_address__icontains=search) |
                Q(device_info__icontains=search)
            )

        serializer = SessionAuditSerializer(qs, many=True)
        return Response(serializer.data)


class AdminSessionRevokeView(APIView):
    """
    Admin View: Remotely revokes an active session immediately.
    Flushes the underlying Django session storage so the user is immediately kicked out.
    """
    permission_classes = [IsVaultAdmin]

    def post(self, request, pk):
        try:
            audit = SessionAudit.objects.get(pk=pk)
        except SessionAudit.DoesNotExist:
            return Response({'detail': 'Session audit record not found.'}, status=status.HTTP_404_NOT_FOUND)

        audit.status = 'revoked'
        audit.save(update_fields=['status'])

        # Destroy the Django session store entry if it exists
        if audit.session_key:
            try:
                if hasattr(request, 'session') and request.session.session_key == audit.session_key:
                    request.session.flush()
                else:
                    Session.objects.filter(session_key=audit.session_key).delete()
            except Exception:
                pass

        return Response({
            'detail': f'Session for {audit.user.email} successfully revoked.',
            'session_id': str(audit.id),
            'status': 'revoked',
        })


class AdminStatsView(APIView):
    """
    Admin View: Aggregates system metrics.
    STRICT ZERO-KNOWLEDGE ENFORCEMENT:
    This endpoint counts objects only and NEVER queries or exposes encrypted payloads, keys, or plaintext secrets.
    """
    permission_classes = [IsVaultAdmin]

    def get(self, request):
        total_users = User.objects.count()
        standard_users = User.objects.filter(role='user').count()
        admin_users = User.objects.filter(role='admin').count()
        
        total_sessions = SessionAudit.objects.count()
        active_sessions = SessionAudit.objects.filter(status='active').count()
        revoked_sessions = SessionAudit.objects.filter(status='revoked').count()
        
        # Zero-knowledge: count total blobs stored without touching ciphertext
        total_vault_items = EncryptedCredential.objects.count()

        recent_audits = SessionAudit.objects.select_related('user').all()[:8]
        recent_activity = SessionAuditSerializer(recent_audits, many=True).data

        return Response({
            'total_users': total_users,
            'standard_users': standard_users,
            'admin_users': admin_users,
            'total_sessions': total_sessions,
            'active_sessions': active_sessions,
            'revoked_sessions': revoked_sessions,
            'total_vault_items': total_vault_items,
            'recent_activity': recent_activity,
        })
