"""
URL configuration for argus_vault_backend project.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/', include('vault_api.urls')),
]
