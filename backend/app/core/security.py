from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    # Truncate to 72 bytes (bcrypt limit)
    plain_password = plain_password[:72]
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    # Truncate to 72 bytes (bcrypt limit)
    password = password[:72]
    return pwd_context.hash(password)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning("token_decode_failed", error=str(e))
        return None


class TokenEncryption:
    """Handle encryption/decryption of sensitive tokens (like OAuth refresh tokens)."""
    
    def __init__(self):
        # Ensure the key is base64-encoded and 32 bytes
        key = settings.TOKEN_ENCRYPTION_KEY.encode()
        
        # If not already base64, encode it
        if len(key) == 32:
            key = base64.urlsafe_b64encode(key)
        
        self.cipher = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt a string and return base64-encoded ciphertext."""
        if not data:
            return ""
        return self.cipher.encrypt(data.encode()).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt a base64-encoded ciphertext and return the original string."""
        if not encrypted_data:
            return ""
        return self.cipher.decrypt(encrypted_data.encode()).decode()


# Global token encryption instance
token_encryptor = TokenEncryption()


def encrypt_refresh_token(refresh_token: str) -> str:
    """Encrypt a refresh token for storage."""
    return token_encryptor.encrypt(refresh_token)


def decrypt_refresh_token(encrypted_token: str) -> str:
    """Decrypt a stored refresh token."""
    return token_encryptor.decrypt(encrypted_token)
