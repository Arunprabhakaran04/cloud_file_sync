from typing import Optional
from fastapi import HTTPException, status
from urllib.parse import urlencode

from app.services.storage.google_drive import google_drive
from app.core.security import encrypt_refresh_token
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


class GoogleOAuthHandler:
    """Handle Google OAuth2 authentication flow."""
    
    def __init__(self):
        self.drive_adapter = google_drive
    
    def get_authorization_url(self, state: Optional[str] = None) -> str:
        """
        Generate the Google OAuth2 authorization URL.
        
        Args:
            state: Optional state parameter for CSRF protection
        
        Returns:
            Authorization URL
        """
        flow = self.drive_adapter.get_oauth_flow()
        
        auth_url, state = flow.authorization_url(
            access_type='offline',  # Request refresh token
            include_granted_scopes='true',
            prompt='consent',  # Force consent to get refresh token
            state=state
        )
        
        logger.info("google_auth_url_generated", state=state)
        return auth_url
    
    async def handle_callback(self, code: str, state: Optional[str] = None) -> dict:
        """
        Handle the OAuth2 callback and exchange code for tokens.
        
        Args:
            code: Authorization code from Google
            state: State parameter for verification
        
        Returns:
            Dictionary with tokens and user info
        """
        try:
            flow = self.drive_adapter.get_oauth_flow()
            
            # Exchange code for tokens
            flow.fetch_token(code=code)
            
            credentials = flow.credentials
            
            # Get user info
            from googleapiclient.discovery import build
            service = build('oauth2', 'v2', credentials=credentials)
            user_info = service.userinfo().get().execute()
            
            # Encrypt refresh token
            encrypted_refresh_token = encrypt_refresh_token(credentials.refresh_token)
            
            result = {
                'access_token': credentials.token,
                'refresh_token': encrypted_refresh_token,
                'token_expiry': credentials.expiry.isoformat() if credentials.expiry else None,
                'user_info': {
                    'email': user_info.get('email'),
                    'name': user_info.get('name'),
                    'picture': user_info.get('picture'),
                    'verified_email': user_info.get('verified_email')
                }
            }
            
            logger.info("google_oauth_callback_successful", email=user_info.get('email'))
            return result
        
        except Exception as e:
            logger.error("google_oauth_callback_failed", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to authenticate with Google: {str(e)}"
            )


# Global instance
google_oauth_handler = GoogleOAuthHandler()
