from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.db.session import get_session
from app.db import crud
from app.db.models import ConflictPolicy
from app.api.v1.uploads import get_current_user_id
from app.core.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/conflicts", tags=["conflicts"])


# Pydantic models
class ConflictInfo(BaseModel):
    id: int
    file_id: int
    conflict_type: str
    storage_a: str
    storage_b: str
    storage_a_modified: Optional[datetime] = None
    storage_b_modified: Optional[datetime] = None
    resolved: bool
    resolution_policy: Optional[str] = None
    detected_at: datetime


class ConflictListResponse(BaseModel):
    conflicts: List[ConflictInfo]
    total: int


class ResolveConflictRequest(BaseModel):
    policy: ConflictPolicy
    keep_version_id: Optional[int] = None
    notes: Optional[str] = None


@router.get("", response_model=ConflictListResponse)
async def list_conflicts(
    resolved: Optional[bool] = Query(None, description="Filter by resolved status"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """List conflicts for the authenticated user."""
    conflicts = await crud.get_conflicts(
        session,
        user_id=user_id,
        resolved=resolved,
        limit=limit,
        offset=offset
    )
    
    conflict_list = [
        ConflictInfo(
            id=c.id,
            file_id=c.file_id,
            conflict_type=c.conflict_type,
            storage_a=c.storage_a,
            storage_b=c.storage_b,
            storage_a_modified=c.storage_a_modified,
            storage_b_modified=c.storage_b_modified,
            resolved=c.resolved,
            resolution_policy=c.resolution_policy,
            detected_at=c.detected_at
        )
        for c in conflicts
    ]
    
    return ConflictListResponse(
        conflicts=conflict_list,
        total=len(conflict_list)
    )


@router.get("/{conflict_id}")
async def get_conflict(
    conflict_id: int,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Get detailed information about a conflict."""
    conflict = await crud.get_conflict_by_id(session, conflict_id)
    
    if not conflict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conflict not found"
        )
    
    # Get file metadata to verify ownership
    file_metadata = await crud.get_file_by_id(session, conflict.file_id)
    if not file_metadata or file_metadata.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return ConflictInfo(
        id=conflict.id,
        file_id=conflict.file_id,
        conflict_type=conflict.conflict_type,
        storage_a=conflict.storage_a,
        storage_b=conflict.storage_b,
        storage_a_modified=conflict.storage_a_modified,
        storage_b_modified=conflict.storage_b_modified,
        resolved=conflict.resolved,
        resolution_policy=conflict.resolution_policy,
        detected_at=conflict.detected_at
    )


@router.post("/{conflict_id}/resolve")
async def resolve_conflict(
    conflict_id: int,
    resolution: ResolveConflictRequest,
    user_id: int = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session)
):
    """Resolve a conflict."""
    conflict = await crud.get_conflict_by_id(session, conflict_id)
    
    if not conflict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conflict not found"
        )
    
    # Get file metadata to verify ownership
    file_metadata = await crud.get_file_by_id(session, conflict.file_id)
    if not file_metadata or file_metadata.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Check if already resolved
    if conflict.resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conflict already resolved"
        )
    
    # Apply resolution policy
    if resolution.policy == ConflictPolicy.LAST_WRITE_WINS:
        # Keep the version with the latest timestamp
        if conflict.storage_a_modified and conflict.storage_b_modified:
            winner = "storage_a" if conflict.storage_a_modified > conflict.storage_b_modified else "storage_b"
            resolution_notes = f"Kept {winner} version (latest timestamp)"
        else:
            resolution_notes = "Applied last-write-wins policy"
    
    elif resolution.policy == ConflictPolicy.KEEP_BOTH:
        # In keep-both, we would create a copy with a suffix
        # For now, just mark as resolved with notes
        resolution_notes = "Kept both versions (implementation pending)"
    
    elif resolution.policy == ConflictPolicy.MANUAL:
        # User manually chose a version
        resolution_notes = resolution.notes or "Manual resolution applied"
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid resolution policy"
        )
    
    # Resolve the conflict
    resolved_conflict = await crud.resolve_conflict(
        session,
        conflict_id=conflict_id,
        resolution_policy=resolution.policy,
        resolution_notes=resolution_notes,
        resolved_at=datetime.utcnow()
    )
    
    # Update file metadata to clear conflict flag if this was the last conflict
    remaining_conflicts = await crud.get_conflicts(
        session,
        user_id=user_id,
        resolved=False
    )
    
    file_has_conflicts = any(c.file_id == conflict.file_id for c in remaining_conflicts)
    
    if not file_has_conflicts:
        await crud.update_file_metadata(
            session,
            conflict.file_id,
            conflict_detected=False
        )
    
    logger.info("conflict_resolved", conflict_id=conflict_id, policy=resolution.policy)
    
    return {
        "message": "Conflict resolved successfully",
        "conflict_id": conflict_id,
        "resolution_policy": resolution.policy,
        "notes": resolution_notes
    }
