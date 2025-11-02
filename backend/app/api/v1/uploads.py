import uuid
import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi import Header
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.session import get_session
from app.db import crud
from app.db.models import SyncStatus, StorageType
from app.services.storage.local_storage import local_storage
from app.services.storage.sync_manager import sync_manager
from app.core.security import decode_access_token
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1", tags=["uploads"])


# Pydantic models
class UploadResponse(BaseModel):
    job_id: str
    file_id: int
    filename: str
    local_path: str
    status: str
    message: str


async def get_current_user_id(authorization: str = Header(...)) -> int:
    """Extract user ID from authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header"
        )
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    return int(user_id)


def validate_file(file: UploadFile) -> None:
    """Validate uploaded file."""
    # Check file extension
    if settings.ALLOWED_EXTENSIONS:
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in settings.allowed_extensions_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_ext} not allowed. Allowed types: {settings.ALLOWED_EXTENSIONS}"
            )
    
    # Note: File size check is handled during upload
    logger.info("file_validated", filename=file.filename)


async def process_upload_sync(
    session_maker,
    file_id: int,
    user_id: int,
    job_id: str,
    sync_google: bool,
    sync_azure: bool
):
    """Background task to sync file to cloud storage."""
    async with session_maker() as session:
        try:
            # Update job status
            await crud.update_sync_job(
                session,
                job_id=job_id,
                status=SyncStatus.IN_PROGRESS,
                started_at=datetime.utcnow()
            )
            
            logger.info("background_sync_started", job_id=job_id, file_id=file_id)
            
            # Sync to cloud
            results = await sync_manager.sync_file_to_cloud(
                session,
                file_id=file_id,
                user_id=user_id,
                sync_google=sync_google,
                sync_azure=sync_azure
            )
            
            # Check for conflicts
            await sync_manager.detect_conflicts(session, file_id)
            
            # Update job status
            final_status = SyncStatus.COMPLETED
            error_msg = None
            
            if sync_google and results['google_drive']['status'] == 'failed':
                final_status = SyncStatus.FAILED
                error_msg = results['google_drive'].get('error')
            
            if sync_azure and results['azure_blob']['status'] == 'failed':
                final_status = SyncStatus.FAILED
                error_msg = results['azure_blob'].get('error')
            
            await crud.update_sync_job(
                session,
                job_id=job_id,
                status=final_status,
                completed_at=datetime.utcnow(),
                progress_percentage=100,
                error_message=error_msg
            )
            
            logger.info("background_sync_completed", job_id=job_id, status=final_status)
        
        except Exception as e:
            logger.error("background_sync_failed", job_id=job_id, error=str(e))
            await crud.update_sync_job(
                session,
                job_id=job_id,
                status=SyncStatus.FAILED,
                completed_at=datetime.utcnow(),
                error_message=str(e)
            )


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    sync_google: bool = Form(True),
    sync_azure: bool = Form(True),
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """
    Upload a file and sync to cloud storage.
    
    Args:
        file: The file to upload
        sync_google: Whether to sync to Google Drive (default: True)
        sync_azure: Whether to sync to Azure Blob (default: True)
        user_id: User ID from auth token
        session: Database session
    
    Returns:
        Upload response with job ID and file details
    """
    try:
        # Validate file
        validate_file(file)
        
        # Generate unique filename
        file_uuid = str(uuid.uuid4())
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{file_uuid}{file_ext}"
        
        # Save file locally
        local_path = await local_storage.save_uploaded_file(
            user_id=user_id,
            file_path=unique_filename,
            upload_file=file
        )
        
        # Calculate file hash and size
        content_hash = await local_storage.calculate_hash(local_path)
        file_size = await local_storage.get_file_size(local_path)
        
        # Check file size limit
        if file_size > settings.max_upload_size_bytes:
            await local_storage.delete_file(local_path)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE_MB}MB"
            )
        
        # Check for duplicate files by content hash
        existing_file = await crud.get_file_by_hash(session, user_id, content_hash)
        if existing_file:
            await local_storage.delete_file(local_path)
            logger.info(
                "duplicate_file_detected",
                filename=file.filename,
                existing_filename=existing_file.original_filename,
                user_id=user_id
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate file detected. This file already exists as '{existing_file.original_filename}'"
            )
        
        # Create file metadata
        file_metadata = await crud.create_file_metadata(
            session,
            user_id=user_id,
            filename=unique_filename,
            original_filename=file.filename,
            file_size=file_size,
            content_type=file.content_type or "application/octet-stream",
            content_hash=content_hash,
            local_path=local_path,
            local_status=SyncStatus.COMPLETED,
            local_uploaded_at=datetime.utcnow(),
            overall_status=SyncStatus.PENDING
        )
        
        # Create sync job
        job_id = str(uuid.uuid4())
        sync_job = await crud.create_sync_job(
            session,
            job_id=job_id,
            user_id=user_id,
            file_id=file_metadata.id,
            operation="upload",
            storage_type=StorageType.LOCAL,
            status=SyncStatus.PENDING
        )
        
        # Add background task for cloud sync
        from app.db.session import async_session_maker
        background_tasks.add_task(
            process_upload_sync,
            async_session_maker,
            file_metadata.id,
            user_id,
            job_id,
            sync_google,
            sync_azure
        )
        
        logger.info(
            "file_uploaded",
            job_id=job_id,
            file_id=file_metadata.id,
            filename=file.filename,
            user_id=user_id
        )
        
        return UploadResponse(
            job_id=job_id,
            file_id=file_metadata.id,
            filename=file.filename,
            local_path=local_path,
            status="accepted",
            message="File uploaded successfully. Cloud synchronization in progress."
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("upload_failed", error=str(e), filename=file.filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@router.get("/status/{job_id}")
async def get_sync_status(
    job_id: str,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Get the status of a sync job."""
    sync_job = await crud.get_sync_job_by_job_id(session, job_id)
    
    if not sync_job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Verify ownership
    if sync_job.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return {
        "job_id": sync_job.job_id,
        "status": sync_job.status,
        "operation": sync_job.operation,
        "progress_percentage": sync_job.progress_percentage,
        "error_message": sync_job.error_message,
        "created_at": sync_job.created_at.isoformat(),
        "started_at": sync_job.started_at.isoformat() if sync_job.started_at else None,
        "completed_at": sync_job.completed_at.isoformat() if sync_job.completed_at else None
    }
