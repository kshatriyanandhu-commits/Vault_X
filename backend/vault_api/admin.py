from django.contrib import admin
from .models import User, EncryptedCredential, SessionAudit


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'role', 'is_active', 'is_staff', 'created_at')
    search_fields = ('email', 'full_name')
    list_filter = ('role', 'is_active', 'is_staff')


@admin.register(EncryptedCredential)
class EncryptedCredentialAdmin(admin.ModelAdmin):
    # ZERO-KNOWLEDGE: do not display full ciphertext in default list
    list_display = ('id', 'user', 'category', 'title_hint', 'is_favorite', 'created_at')
    search_fields = ('user__email', 'title_hint', 'category')
    list_filter = ('category', 'is_favorite')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(SessionAudit)
class SessionAuditAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'ip_address', 'device_info', 'status', 'login_time', 'last_active')
    search_fields = ('user__email', 'ip_address', 'device_info')
    list_filter = ('status',)
    readonly_fields = ('id', 'login_time', 'last_active')
