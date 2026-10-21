import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Provision an initial Argus Vault administrator account via CLI arguments or environment variables.'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Admin email address')
        parser.add_argument('--password', type=str, help='Admin password')
        parser.add_argument('--name', type=str, help='Admin full name', default='')

    def handle(self, *args, **options):
        email = options.get('email') or os.environ.get('ADMIN_EMAIL') or 'admin@argusvault.local'
        password = options.get('password') or os.environ.get('ADMIN_PASSWORD') or 'ArgusAdmin2026!Secure'
        full_name = options.get('name') or os.environ.get('ADMIN_NAME') or 'Argus Vault Administrator'

        email = email.lower().strip()
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'full_name': full_name,
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            }
        )

        user.set_password(password)
        user.role = 'admin'
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        if full_name:
            user.full_name = full_name
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Successfully created superadmin: {email}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Successfully updated superadmin: {email} with admin role & credentials"))
