import secrets
import string


def generate_secure_password(length: int = 12) -> str:
    """
    Generate a secure random password
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))
