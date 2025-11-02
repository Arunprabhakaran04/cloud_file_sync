from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.session import get_session
from app.db import crud
from app.db.models import SyncStatus
from app.services.storage.local_storage import local_storage
from app.services.storage.google_drive import google_drive
from app.services.storage.azure_blob import azure_blob
from app.api.v1.uploads import get_current_user_id
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/files", tags=["files"])


# Pydantic models
class FileInfo(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    content_type: str
    overall_status: str
    version: int
    conflict_detected: bool
    created_at: datetime
    
    # Storage-specific info
    google_file_id: Optional[str] = None
    google_status: Optional[str] = None
    azure_blob_url: Optional[str] = None
    azure_status: Optional[str] = None


class FileListResponse(BaseModel):
    files: List[FileInfo]
    total: int
    limit: int
    offset: int


@router.get("", response_model=FileListResponse)
async def list_files(
    status: Optional[SyncStatus] = Query(None, description="Filter by sync status"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """List files for the authenticated user."""
    files = await crud.get_user_files(
        session,
        user_id=user_id,
        status=status,
        limit=limit,
        offset=offset
    )
    
    # Generate file list with signed URLs for Azure
    file_list = []
    for f in files:
        azure_download_url = f.azure_blob_url
        
        # Generate signed URL for Azure if blob exists
        if f.azure_blob_name and f.azure_status == 'completed':
            try:
                signed_url = await azure_blob.generate_signed_url(
                    f.azure_blob_name,
                    expiry_hours=1
                )
                if signed_url:
                    azure_download_url = signed_url
            except Exception as e:
                logger.error("azure_signed_url_generation_failed", file_id=f.id, error=str(e))
        
        file_list.append(
            FileInfo(
                id=f.id,
                filename=f.filename,
                original_filename=f.original_filename,
                file_size=f.file_size,
                content_type=f.content_type,
                overall_status=f.overall_status,
                version=f.version,
                conflict_detected=f.conflict_detected,
                created_at=f.created_at,
                google_file_id=f.google_file_id,
                google_status=f.google_status,
                azure_blob_url=azure_download_url,
                azure_status=f.azure_status
            )
        )
    
    return FileListResponse(
        files=file_list,
        total=len(file_list),
        limit=limit,
        offset=offset
    )


@router.get("/{file_id}")
async def get_file(
    file_id: int,
    download: bool = Query(False, description="Download file directly"),
    from_storage: str = Query("local", description="Storage to download from: local, google, azure"),
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Get file information or download file."""
    file_metadata = await crud.get_file_by_id(session, file_id)
    
    if not file_metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Verify ownership
    if file_metadata.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # If download requested
    if download:
        if from_storage == "local":
            if not file_metadata.local_path or not await local_storage.file_exists(file_metadata.local_path):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Local file not found"
                )
            
            return FileResponse(
                path=file_metadata.local_path,
                filename=file_metadata.original_filename,
                media_type=file_metadata.content_type
            )
        
        elif from_storage == "google":
            if not file_metadata.google_file_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not available in Google Drive"
                )
            
            # Return Google Drive web view link
            user = await crud.get_user_by_id(session, user_id)
            if not user.google_refresh_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Google Drive not connected"
                )
            
            # Get file metadata from Google Drive
            google_metadata = await google_drive.get_file_metadata(
                file_metadata.google_file_id,
                user.google_access_token,
                user.google_refresh_token,
                user.google_token_expiry
            )
            
            return {
                "download_url": google_metadata.get('web_view_link') if google_metadata else None,
                "message": "Use the web_view_link to download from Google Drive"
            }
        
        elif from_storage == "azure":
            if not file_metadata.azure_blob_name:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not available in Azure Blob Storage"
                )
            
            # Generate signed URL
            signed_url = await azure_blob.generate_signed_url(
                file_metadata.azure_blob_name,
                expiry_hours=1
            )
            
            if not signed_url:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to generate download URL"
                )
            
            return {
                "download_url": signed_url,
                "expires_in": "1 hour",
                "message": "Use the download_url to download from Azure Blob Storage"
            }
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage type. Use: local, google, or azure"
            )
    
    # Generate signed URL for Azure if blob exists
    azure_download_url = file_metadata.azure_blob_url
    if file_metadata.azure_blob_name and file_metadata.azure_status == 'completed':
        try:
            signed_url = await azure_blob.generate_signed_url(
                file_metadata.azure_blob_name,
                expiry_hours=1
            )
            if signed_url:
                azure_download_url = signed_url
        except Exception as e:
            logger.error("azure_signed_url_generation_failed", error=str(e))
    
    # Return file metadata
    return FileInfo(
        id=file_metadata.id,
        filename=file_metadata.filename,
        original_filename=file_metadata.original_filename,
        file_size=file_metadata.file_size,
        content_type=file_metadata.content_type,
        overall_status=file_metadata.overall_status,
        version=file_metadata.version,
        conflict_detected=file_metadata.conflict_detected,
        created_at=file_metadata.created_at,
        google_file_id=file_metadata.google_file_id,
        google_status=file_metadata.google_status,
        azure_blob_url=azure_download_url,
        azure_status=file_metadata.azure_status
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    delete_from_cloud: bool = Query(True, description="Also delete from cloud storage"),
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Delete a file."""
    file_metadata = await crud.get_file_by_id(session, file_id)
    
    if not file_metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Verify ownership
    if file_metadata.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    results = {
        "file_id": file_id,
        "local": False,
        "google_drive": False,
        "azure_blob": False
    }
    
    # Delete from local storage
    if file_metadata.local_path:
        results["local"] = await local_storage.delete_file(file_metadata.local_path)
    
    # Delete from cloud if requested
    if delete_from_cloud:
        # Delete from Google Drive
        if file_metadata.google_file_id:
            user = await crud.get_user_by_id(session, user_id)
            if user.google_refresh_token:
                try:
                    results["google_drive"] = await google_drive.delete_file(
                        file_metadata.google_file_id,
                        user.google_access_token,
                        user.google_refresh_token,
                        user.google_token_expiry
                    )
                except Exception as e:
                    logger.error("google_drive_delete_failed", error=str(e))
        
        # Delete from Azure Blob
        if file_metadata.azure_blob_name:
            try:
                results["azure_blob"] = await azure_blob.delete_file(
                    file_metadata.azure_blob_name
                )
            except Exception as e:
                logger.error("azure_blob_delete_failed", error=str(e))
    
    # Delete metadata from database
    await crud.delete_file_metadata(session, file_id)
    
    logger.info("file_deleted", file_id=file_id, user_id=user_id, results=results)
    
    return {
        "message": "File deleted successfully",
        "details": results
    }
