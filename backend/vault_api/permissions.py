from rest_framework import permissions


class IsVaultAdmin(permissions.BasePermission):
    """
    Allows access only to authenticated users who possess the 'admin' role,
    is_staff, or is_superuser.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (
                getattr(request.user, 'role', None) == 'admin' or
                request.user.is_staff or
                request.user.is_superuser
            )
        )


class IsOwner(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object to view or edit it.
    """
    def has_object_permission(self, request, view, obj):
        return bool(request.user and request.user.is_authenticated and obj.user == request.user)
