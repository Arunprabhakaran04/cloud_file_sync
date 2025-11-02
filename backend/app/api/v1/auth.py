from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.session import get_session
from app.db import crud
from app.auth.google_oauth import google_oauth_handler
from app.core.security import create_access_token, verify_password
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])


# Pydantic models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    session: AsyncSession = Depends(get_session)
):
    """Register a new user."""
    # Check if user already exists
    existing_user = await crud.get_user_by_email(session, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = await crud.create_user(
        session,
        email=user_data.email,
        password=user_data.password,
        full_name=user_data.full_name
    )
    
    # Generate access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    logger.info("user_registered", user_id=user.id, email=user.email)
    
    return Token(
        access_token=access_token,
        user_id=user.id,
        email=user.email
    )


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin,
    session: AsyncSession = Depends(get_session)
):
    """Login with email and password."""
    # Get user
    user = await crud.get_user_by_email(session, credentials.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Generate access token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    logger.info("user_logged_in", user_id=user.id, email=user.email)
    
    return Token(
        access_token=access_token,
        user_id=user.id,
        email=user.email
    )


@router.get("/google/start")
async def google_auth_start(user_id: int = Query(..., description="User ID to link Google account")):
    """
    Start Google OAuth2 flow.
    
    Args:
        user_id: User ID to associate the Google account with
    
    Returns:
        Redirect to Google OAuth consent page
    """
    # Generate state with user_id encoded
    state = f"user_{user_id}"
    
    auth_url = google_oauth_handler.get_authorization_url(state=state)
    
    logger.info("google_auth_started", user_id=user_id)
    
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_auth_callback(
    code: str = Query(...),
    state: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session)
):
    """
    Handle Google OAuth2 callback.
    
    Args:
        code: Authorization code from Google
        state: State parameter (contains user_id)
    
    Returns:
        Redirect to frontend with success/failure
    """
    try:
        # Handle OAuth callback
        result = await google_oauth_handler.handle_callback(code, state)
        
        # Extract user_id from state
        if state and state.startswith("user_"):
            user_id = int(state.split("_")[1])
        else:
            # If no state, try to find user by email
            user = await crud.get_user_by_email(session, result['user_info']['email'])
            if not user:
                # Create new user
                user = await crud.create_user(
                    session,
                    email=result['user_info']['email'],
                    password="google_oauth",  # Placeholder
                    full_name=result['user_info'].get('name')
                )
            user_id = user.id
        
        # Update user with Google tokens
        await crud.update_user_google_tokens(
            session,
            user_id=user_id,
            refresh_token=result['refresh_token'],
            access_token=result['access_token'],
            token_expiry=result['token_expiry']
        )
        
        logger.info("google_auth_completed", user_id=user_id)
        
        # Redirect to frontend with success
        redirect_url = f"{settings.FRONTEND_URL}/auth/google/success?user_id={user_id}"
        return RedirectResponse(url=redirect_url)
    
    except Exception as e:
        logger.error("google_auth_callback_error", error=str(e))
        # Redirect to frontend with error
        redirect_url = f"{settings.FRONTEND_URL}/auth/google/error?message={str(e)}"
        return RedirectResponse(url=redirect_url)


@router.get("/google/status/{user_id}")
async def google_auth_status(
    user_id: int,
    session: AsyncSession = Depends(get_session)
):
    """Check if user has connected Google Drive."""
    user = await crud.get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "connected": bool(user.google_refresh_token),
        "email": user.email
    }
