from django.utils import timezone
from django.contrib.auth import logout
from django.http import JsonResponse
from .models import SessionAudit


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def parse_device_info(user_agent_str):
    if not user_agent_str:
        return 'Unknown Device'
    ua = user_agent_str.lower()
    os_name = "Desktop"
    if "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"

    browser = "Browser"
    if "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"

    return f"{browser} on {os_name}"


class SessionAuditMiddleware:
    """
    Middleware that enforces active session status and tracks activity.
    If an admin has marked the session 'revoked', the middleware flushes the session
    and immediately rejects the request with HTTP 401.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, 'user') and request.user.is_authenticated:
            session_key = request.session.session_key
            if session_key:
                try:
                    audit = SessionAudit.objects.filter(session_key=session_key).first()
                    if audit:
                        if audit.status == 'revoked':
                            logout(request)
                            return JsonResponse(
                                {
                                    'detail': 'Your session has been terminated by an administrator.',
                                    'code': 'session_revoked'
                                },
                                status=401
                            )
                        elif audit.status == 'active':
                            # Update last active timestamp
                            audit.last_active = timezone.now()
                            audit.save(update_fields=['last_active'])
                    else:
                        ip = get_client_ip(request)
                        ua = request.META.get('HTTP_USER_AGENT', '')
                        SessionAudit.objects.create(
                            user=request.user,
                            session_key=session_key,
                            ip_address=ip,
                            user_agent=ua,
                            device_info=parse_device_info(ua),
                            status='active',
                        )
                except Exception:
                    # Fail open if DB temporarily busy, but continue
                    pass

        response = self.get_response(request)
        return response
