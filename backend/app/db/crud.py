from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlmodel import select as sqlmodel_select

from app.db.models import User, FileMetadata, SyncJob, Conflict, SyncStatus
from app.core.security import get_password_hash
from app.core.logger import get_logger

logger = get_logger(__name__)


# User CRUD operations
async def create_user(session: AsyncSession, email: str, password: str, full_name: Optional[str] = None) -> User:
    """Create a new user."""
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    logger.info("user_created", user_id=user.id, email=email)
    return user


async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
    """Get user by email."""
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: int) -> Optional[User]:
    """Get user by ID."""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user_google_tokens(
    session: AsyncSession,
    user_id: int,
    refresh_token: Optional[str] = None,
    access_token: Optional[str] = None,
    token_expiry: Optional[str] = None
) -> Optional[User]:
    """Update user's Google OAuth tokens."""
    from datetime import datetime
    
    user = await get_user_by_id(session, user_id)
    if user:
        if refresh_token:
            user.google_refresh_token = refresh_token
        if access_token:
            user.google_access_token = access_token
        if token_expiry:
            # Convert ISO format string to datetime object
            if isinstance(token_expiry, str):
                user.google_token_expiry = datetime.fromisoformat(token_expiry.replace('Z', '+00:00'))
            else:
                user.google_token_expiry = token_expiry
        
        session.add(user)
        await session.commit()
        await session.refresh(user)
        logger.info("user_tokens_updated", user_id=user_id)
    return user


# FileMetadata CRUD operations
async def create_file_metadata(session: AsyncSession, **kwargs) -> FileMetadata:
    """Create new file metadata."""
    file_metadata = FileMetadata(**kwargs)
    session.add(file_metadata)
    await session.commit()
    await session.refresh(file_metadata)
    logger.info("file_metadata_created", file_id=file_metadata.id, filename=file_metadata.filename)
    return file_metadata


async def get_file_by_id(session: AsyncSession, file_id: int) -> Optional[FileMetadata]:
    """Get file metadata by ID."""
    result = await session.execute(select(FileMetadata).where(FileMetadata.id == file_id))
    return result.scalar_one_or_none()


async def get_file_by_hash(session: AsyncSession, user_id: int, content_hash: str) -> Optional[FileMetadata]:
    """Get file by content hash for a specific user."""
    result = await session.execute(
        select(FileMetadata).where(
            FileMetadata.user_id == user_id,
            FileMetadata.content_hash == content_hash
        )
    )
    return result.scalar_one_or_none()


async def get_user_files(
    session: AsyncSession,
    user_id: int,
    status: Optional[SyncStatus] = None,
    limit: int = 100,
    offset: int = 0
) -> List[FileMetadata]:
    """Get files for a user."""
    query = select(FileMetadata).where(FileMetadata.user_id == user_id)
    
    if status:
        query = query.where(FileMetadata.overall_status == status)
    
    query = query.offset(offset).limit(limit).order_by(FileMetadata.created_at.desc())
    
    result = await session.execute(query)
    return result.scalars().all()


async def update_file_metadata(session: AsyncSession, file_id: int, **kwargs) -> Optional[FileMetadata]:
    """Update file metadata."""
    file_metadata = await get_file_by_id(session, file_id)
    if file_metadata:
        for key, value in kwargs.items():
            setattr(file_metadata, key, value)
        
        session.add(file_metadata)
        await session.commit()
        await session.refresh(file_metadata)
        logger.info("file_metadata_updated", file_id=file_id)
    return file_metadata


async def delete_file_metadata(session: AsyncSession, file_id: int) -> bool:
    """Delete file metadata."""
    result = await session.execute(delete(FileMetadata).where(FileMetadata.id == file_id))
    await session.commit()
    deleted = result.rowcount > 0
    if deleted:
        logger.info("file_metadata_deleted", file_id=file_id)
    return deleted


# SyncJob CRUD operations
async def create_sync_job(session: AsyncSession, **kwargs) -> SyncJob:
    """Create a new sync job."""
    sync_job = SyncJob(**kwargs)
    session.add(sync_job)
    await session.commit()
    await session.refresh(sync_job)
    logger.info("sync_job_created", job_id=sync_job.job_id)
    return sync_job


async def get_sync_job_by_job_id(session: AsyncSession, job_id: str) -> Optional[SyncJob]:
    """Get sync job by job_id."""
    result = await session.execute(select(SyncJob).where(SyncJob.job_id == job_id))
    return result.scalar_one_or_none()


async def update_sync_job(session: AsyncSession, job_id: str, **kwargs) -> Optional[SyncJob]:
    """Update sync job."""
    sync_job = await get_sync_job_by_job_id(session, job_id)
    if sync_job:
        for key, value in kwargs.items():
            setattr(sync_job, key, value)
        
        session.add(sync_job)
        await session.commit()
        await session.refresh(sync_job)
        logger.info("sync_job_updated", job_id=job_id)
    return sync_job


# Conflict CRUD operations
async def create_conflict(session: AsyncSession, **kwargs) -> Conflict:
    """Create a new conflict record."""
    conflict = Conflict(**kwargs)
    session.add(conflict)
    await session.commit()
    await session.refresh(conflict)
    logger.info("conflict_created", conflict_id=conflict.id, file_id=conflict.file_id)
    return conflict


async def get_conflicts(
    session: AsyncSession,
    user_id: Optional[int] = None,
    resolved: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0
) -> List[Conflict]:
    """Get conflicts, optionally filtered."""
    query = select(Conflict).join(FileMetadata)
    
    if user_id:
        query = query.where(FileMetadata.user_id == user_id)
    
    if resolved is not None:
        query = query.where(Conflict.resolved == resolved)
    
    query = query.offset(offset).limit(limit).order_by(Conflict.detected_at.desc())
    
    result = await session.execute(query)
    return result.scalars().all()


async def get_conflict_by_id(session: AsyncSession, conflict_id: int) -> Optional[Conflict]:
    """Get conflict by ID."""
    result = await session.execute(select(Conflict).where(Conflict.id == conflict_id))
    return result.scalar_one_or_none()


async def resolve_conflict(session: AsyncSession, conflict_id: int, **kwargs) -> Optional[Conflict]:
    """Resolve a conflict."""
    conflict = await get_conflict_by_id(session, conflict_id)
    if conflict:
        conflict.resolved = True
        for key, value in kwargs.items():
            setattr(conflict, key, value)
        
        session.add(conflict)
        await session.commit()
        await session.refresh(conflict)
        logger.info("conflict_resolved", conflict_id=conflict_id)
    return conflict
