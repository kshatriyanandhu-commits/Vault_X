from django.urls import path, re_path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CSRFTokenView,
    RegisterView,
    LoginView,
    LogoutView,
    MeView,
    EncryptedCredentialViewSet,
    AdminSessionListView,
    AdminSessionRevokeView,
    AdminStatsView,
)

router = DefaultRouter()
router.trailing_slash = '/?'
router.register(r'credentials', EncryptedCredentialViewSet, basename='credential')

urlpatterns = [
    # Auth endpoints (matching both trailing slash and non-trailing slash seamlessly)
    re_path(r'^auth/csrf/?$', CSRFTokenView.as_view(), name='csrf_token'),
    re_path(r'^auth/register/?$', RegisterView.as_view(), name='register'),
    re_path(r'^auth/login/?$', LoginView.as_view(), name='login'),
    re_path(r'^auth/logout/?$', LogoutView.as_view(), name='logout'),
    re_path(r'^auth/me/?$', MeView.as_view(), name='me'),

    # Admin audit & stats endpoints
    re_path(r'^admin/sessions/?$', AdminSessionListView.as_view(), name='admin_sessions'),
    re_path(r'^admin/sessions/(?P<pk>[^/]+)/revoke/?$', AdminSessionRevokeView.as_view(), name='admin_session_revoke'),
    re_path(r'^admin/stats/?$', AdminStatsView.as_view(), name='admin_stats'),

    # Credentials CRUD
    path('', include(router.urls)),
]
