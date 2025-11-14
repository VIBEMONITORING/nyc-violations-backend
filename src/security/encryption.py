"""
NYC Violation Compliance System - Data Encryption

PII encryption for data at rest and in transit.
"""

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import os
import base64
from typing import Dict, Optional
import logging


logger = logging.getLogger(__name__)


class DataEncryption:
    """
    Encrypt PII (Personally Identifiable Information) at rest and in transit

    Features:
    - Fernet symmetric encryption
    - Field-level encryption
    - Key derivation from password
    - Automatic key management
    """

    PII_FIELDS = ['phone', 'email', 'legal_name', 'owner_name']

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize encryption engine

        Args:
            encryption_key: Optional encryption key (base64 encoded)
        """
        if encryption_key:
            self.key = encryption_key.encode() if isinstance(encryption_key, str) else encryption_key
        else:
            # Generate or load from environment
            self.key = self._get_or_create_key()

        self.cipher = Fernet(self.key)

    def _get_or_create_key(self) -> bytes:
        """Get encryption key from environment or generate new one"""

        env_key = os.getenv('ENCRYPTION_KEY')

        if env_key:
            return env_key.encode()

        # Generate new key
        logger.warning("No ENCRYPTION_KEY found in environment, generating new key")
        new_key = Fernet.generate_key()
        logger.info(f"Generated encryption key (store securely): {new_key.decode()}")
        return new_key

    @staticmethod
    def derive_key_from_password(password: str, salt: Optional[bytes] = None) -> tuple[bytes, bytes]:
        """
        Derive encryption key from password using PBKDF2

        Args:
            password: User password
            salt: Optional salt (generated if not provided)

        Returns:
            Tuple of (key, salt)
        """

        if salt is None:
            salt = os.urandom(16)

        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )

        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))

        return key, salt

    def encrypt_pii(self, data: Dict) -> Dict:
        """
        Encrypt sensitive PII fields in dictionary

        Args:
            data: Dictionary with PII fields

        Returns:
            Dictionary with encrypted PII fields
        """

        encrypted_data = data.copy()

        for field in self.PII_FIELDS:
            if field in encrypted_data and encrypted_data[field]:
                try:
                    # Convert to string and encrypt
                    plaintext = str(encrypted_data[field])
                    encrypted = self.cipher.encrypt(plaintext.encode())
                    encrypted_data[field] = encrypted.decode()
                except Exception as e:
                    logger.error(f"Error encrypting field {field}: {e}")

        return encrypted_data

    def decrypt_pii(self, data: Dict) -> Dict:
        """
        Decrypt sensitive PII fields in dictionary

        Args:
            data: Dictionary with encrypted PII fields

        Returns:
            Dictionary with decrypted PII fields
        """

        decrypted_data = data.copy()

        for field in self.PII_FIELDS:
            if field in decrypted_data and decrypted_data[field]:
                try:
                    # Decrypt and convert back to string
                    encrypted = decrypted_data[field].encode()
                    decrypted = self.cipher.decrypt(encrypted)
                    decrypted_data[field] = decrypted.decode()
                except Exception as e:
                    logger.error(f"Error decrypting field {field}: {e}")

        return decrypted_data

    def encrypt_string(self, plaintext: str) -> str:
        """
        Encrypt a single string

        Args:
            plaintext: String to encrypt

        Returns:
            Encrypted string (base64 encoded)
        """

        encrypted = self.cipher.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt_string(self, ciphertext: str) -> str:
        """
        Decrypt a single string

        Args:
            ciphertext: Encrypted string

        Returns:
            Decrypted plaintext
        """

        decrypted = self.cipher.decrypt(ciphertext.encode())
        return decrypted.decode()


class AccessControl:
    """
    Role-based access control (RBAC) system
    """

    from enum import Enum

    class Role(Enum):
        """User roles"""
        ADMIN = "admin"
        SALES_MANAGER = "sales_manager"
        SALES_REP = "sales_rep"
        ANALYST = "analyst"
        VIEWER = "viewer"

    class Permission(Enum):
        """System permissions"""
        VIEW_LEADS = "view_leads"
        EDIT_LEADS = "edit_leads"
        DELETE_LEADS = "delete_leads"
        VIEW_PII = "view_pii"
        EXPORT_DATA = "export_data"
        MANAGE_USERS = "manage_users"
        ACCESS_ADMIN = "access_admin"

    # Role-Permission mapping
    ROLE_PERMISSIONS = {
        Role.ADMIN: [
            Permission.VIEW_LEADS,
            Permission.EDIT_LEADS,
            Permission.DELETE_LEADS,
            Permission.VIEW_PII,
            Permission.EXPORT_DATA,
            Permission.MANAGE_USERS,
            Permission.ACCESS_ADMIN
        ],
        Role.SALES_MANAGER: [
            Permission.VIEW_LEADS,
            Permission.EDIT_LEADS,
            Permission.VIEW_PII,
            Permission.EXPORT_DATA
        ],
        Role.SALES_REP: [
            Permission.VIEW_LEADS,
            Permission.EDIT_LEADS,
            Permission.VIEW_PII
        ],
        Role.ANALYST: [
            Permission.VIEW_LEADS,
            Permission.EXPORT_DATA
        ],
        Role.VIEWER: [
            Permission.VIEW_LEADS
        ]
    }

    @classmethod
    def check_permission(cls, user_role: Role, required_permission: Permission) -> bool:
        """
        Verify user has required permission

        Args:
            user_role: User's role
            required_permission: Required permission

        Returns:
            True if user has permission
        """

        return required_permission in cls.ROLE_PERMISSIONS.get(user_role, [])

    @classmethod
    def get_user_permissions(cls, user_role: Role) -> list:
        """
        Get all permissions for a role

        Args:
            user_role: User's role

        Returns:
            List of permissions
        """

        return cls.ROLE_PERMISSIONS.get(user_role, [])


def mask_pii(value: str, mask_char: str = '*', visible_chars: int = 4) -> str:
    """
    Mask PII for display purposes

    Args:
        value: Value to mask
        mask_char: Character to use for masking
        visible_chars: Number of characters to leave visible

    Returns:
        Masked value
    """

    if not value or len(value) <= visible_chars:
        return mask_char * len(value) if value else ''

    return mask_char * (len(value) - visible_chars) + value[-visible_chars:]


# Example usage
if __name__ == "__main__":
    # Initialize encryption
    encryptor = DataEncryption()

    # Encrypt PII
    sensitive_data = {
        'name': 'John Doe',
        'phone': '(555) 123-4567',
        'email': 'john@example.com',
        'public_info': 'This is not encrypted'
    }

    encrypted = encryptor.encrypt_pii(sensitive_data)
    print("Encrypted:", encrypted)

    # Decrypt PII
    decrypted = encryptor.decrypt_pii(encrypted)
    print("Decrypted:", decrypted)

    # Check permissions
    from security.encryption import AccessControl
    can_view = AccessControl.check_permission(
        AccessControl.Role.SALES_REP,
        AccessControl.Permission.VIEW_PII
    )
    print(f"Sales rep can view PII: {can_view}")
