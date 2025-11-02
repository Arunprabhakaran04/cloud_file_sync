from datetime import datetime
from typing import Optional, List
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship


class SyncStatus(str, Enum):
    """Sync status for file operations."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CONFLICT = "conflict"


class StorageType(str, Enum):
    """Types of storage backends."""
    LOCAL = "local"
    GOOGLE_DRIVE = "google_drive"
    AZURE_BLOB = "azure_blob"


class ConflictPolicy(str, Enum):
    """Conflict resolution policies."""
    LAST_WRITE_WINS = "last-write"
    KEEP_BOTH = "keep-both"
    MANUAL = "manual"


# User Model
class User(SQLModel, table=True):
    """User model for authentication and file ownership."""
    __tablename__ = "users"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    full_name: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # OAuth tokens (encrypted)
    google_refresh_token: Optional[str] = None
    google_access_token: Optional[str] = None
    google_token_expiry: Optional[datetime] = None
    
    # Relationships
    files: List["FileMetadata"] = Relationship(back_populates="user")
    sync_jobs: List["SyncJob"] = Relationship(back_populates="user")


# FileMetadata Model
class FileMetadata(SQLModel, table=True):
    """File metadata tracking across all storage backends."""
    __tablename__ = "file_metadata"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    
    # File information
    filename: str
    original_filename: str
    file_size: int  # in bytes
    content_type: str
    content_hash: str  # SHA256
    
    # Local storage
    local_path: Optional[str] = None
    local_status: SyncStatus = Field(default=SyncStatus.PENDING)
    local_uploaded_at: Optional[datetime] = None
    
    # Google Drive
    google_file_id: Optional[str] = None
    google_status: SyncStatus = Field(default=SyncStatus.PENDING)
    google_uploaded_at: Optional[datetime] = None
    google_modified_at: Optional[datetime] = None
    
    # Azure Blob
    azure_blob_url: Optional[str] = None
    azure_blob_name: Optional[str] = None
    azure_status: SyncStatus = Field(default=SyncStatus.PENDING)
    azure_uploaded_at: Optional[datetime] = None
    azure_modified_at: Optional[datetime] = None
    
    # Versioning
    version: int = Field(default=1)
    
    # Status tracking
    overall_status: SyncStatus = Field(default=SyncStatus.PENDING)
    conflict_detected: bool = Field(default=False)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: User = Relationship(back_populates="files")
    conflicts: List["Conflict"] = Relationship(back_populates="file")


# SyncJob Model
class SyncJob(SQLModel, table=True):
    """Track background sync jobs."""
    __tablename__ = "sync_jobs"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    job_id: str = Field(unique=True, index=True)  # UUID
    user_id: int = Field(foreign_key="users.id", index=True)
    file_id: Optional[int] = Field(default=None, foreign_key="file_metadata.id")
    
    # Job details
    operation: str  # "upload", "download", "delete", "sync"
    storage_type: StorageType
    status: SyncStatus = Field(default=SyncStatus.PENDING)
    
    # Progress tracking
    progress_percentage: int = Field(default=0)
    error_message: Optional[str] = None
    retry_count: int = Field(default=0)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Relationships
    user: User = Relationship(back_populates="sync_jobs")


# Conflict Model
class Conflict(SQLModel, table=True):
    """Track conflicts between storage backends."""
    __tablename__ = "conflicts"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    file_id: int = Field(foreign_key="file_metadata.id", index=True)
    
    # Conflict details
    conflict_type: str  # "hash_mismatch", "timestamp_mismatch", "version_conflict"
    storage_a: StorageType
    storage_b: StorageType
    
    # Version information
    storage_a_hash: Optional[str] = None
    storage_b_hash: Optional[str] = None
    storage_a_modified: Optional[datetime] = None
    storage_b_modified: Optional[datetime] = None
    
    # Resolution
    resolved: bool = Field(default=False)
    resolution_policy: Optional[ConflictPolicy] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    
    # Timestamps
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    file: FileMetadata = Relationship(back_populates="conflicts")
