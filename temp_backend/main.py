from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
import os
import shutil
import uuid
import datetime
import json
import random
import hashlib
from pydantic import BaseModel

app = FastAPI(title="File Manager Cloud Temporary Backend")

# Configure CORS to allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# In-memory database for storing file metadata and conflicts
files_db = []
conflicts_db = []

# Generate a random checksum
def generate_checksum():
    return hashlib.md5(str(random.random()).encode()).hexdigest()

# Root endpoint
@app.get("/")
async def root():
    return {"status": "ok", "message": "File Manager Cloud API is running"}

# Upload file endpoint
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Save file to uploads directory
        file_path = os.path.join(UPLOADS_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Generate mock sync status - simulate some successes and failures
        success_google = random.choice([True, True, True, False])
        success_azure = random.choice([True, True, True, False])
        
        # Add file to our in-memory database
        file_info = {
            "filename": file.filename,
            "size": file_size,
            "modified_time": datetime.datetime.now().isoformat(),
            "checksum": generate_checksum(),
            "provider": "local"
        }
        files_db.append(file_info)
        
        # If sync was successful, add entries for other providers
        if success_google:
            files_db.append({
                "filename": file.filename,
                "size": file_size,
                "modified_time": datetime.datetime.now().isoformat(),
                "checksum": generate_checksum(),
                "provider": "google_drive"
            })
        
        if success_azure:
            files_db.append({
                "filename": file.filename,
                "size": file_size,
                "modified_time": datetime.datetime.now().isoformat(),
                "checksum": generate_checksum(),
                "provider": "azure_blob"
            })
        
        # Generate a conflict sometimes
        if random.random() < 0.3:  # 30% chance of conflict
            conflicts_db.append({
                "filename": file.filename,
                "conflict_type": random.choice(["timestamp_mismatch", "size_mismatch", "checksum_mismatch"]),
                "detected_at": datetime.datetime.now().isoformat(),
                "resolution_status": "pending",
                "local_info": {
                    "size": file_size,
                    "modified_time": datetime.datetime.now().isoformat()
                },
                "google_drive_info": {
                    "size": int(file_size * 0.9) if random.random() < 0.5 else file_size,
                    "modified_time": (datetime.datetime.now() - datetime.timedelta(hours=2)).isoformat()
                },
                "azure_blob_info": {
                    "size": int(file_size * 1.1) if random.random() < 0.5 else file_size,
                    "modified_time": (datetime.datetime.now() - datetime.timedelta(hours=1)).isoformat()
                }
            })
        
        return {
            "message": f"File {file.filename} uploaded successfully!",
            "sync_status": {
                "google_drive_success": success_google,
                "azure_blob_success": success_azure
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

# List files endpoint
@app.get("/files")
async def list_files():
    if not files_db:
        # Generate some mock files if the database is empty
        mock_files = [
            "document.pdf",
            "image.jpg",
            "spreadsheet.xlsx",
            "presentation.pptx",
            "code.py"
        ]
        
        for filename in mock_files:
            size = random.randint(1024, 10 * 1024 * 1024)  # Random size between 1KB and 10MB
            
            # Add entries for different providers
            for provider in ["local", "google_drive", "azure_blob"]:
                # Skip some providers randomly to simulate partial sync
                if random.random() < 0.2 and provider != "local":
                    continue
                    
                files_db.append({
                    "filename": filename,
                    "size": size if provider == "local" else int(size * random.uniform(0.9, 1.1)),
                    "modified_time": (datetime.datetime.now() - datetime.timedelta(days=random.randint(0, 30))).isoformat(),
                    "checksum": generate_checksum(),
                    "provider": provider
                })
    
    return files_db

# Get conflicts endpoint
@app.get("/conflicts")
async def get_conflicts():
    if not conflicts_db:
        # Generate mock conflicts if none exist
        filenames = set(f["filename"] for f in files_db)
        
        if filenames:
            # Use existing files for conflicts
            for filename in list(filenames)[:3]:  # Use up to 3 files
                if random.random() < 0.7:  # 70% chance to add conflict
                    file_info = next((f for f in files_db if f["filename"] == filename), None)
                    if file_info:
                        size = file_info.get("size", 1024 * 1024)
                        conflicts_db.append({
                            "filename": filename,
                            "conflict_type": random.choice(["timestamp_mismatch", "size_mismatch", "checksum_mismatch"]),
                            "detected_at": datetime.datetime.now().isoformat(),
                            "resolution_status": "pending",
                            "local_info": {
                                "size": size,
                                "modified_time": datetime.datetime.now().isoformat()
                            },
                            "google_drive_info": {
                                "size": int(size * 0.9) if random.random() < 0.5 else size,
                                "modified_time": (datetime.datetime.now() - datetime.timedelta(hours=2)).isoformat()
                            },
                            "azure_blob_info": {
                                "size": int(size * 1.1) if random.random() < 0.5 else size,
                                "modified_time": (datetime.datetime.now() - datetime.timedelta(hours=1)).isoformat()
                            }
                        })
    
    return conflicts_db

# Resolve conflict endpoint
@app.post("/conflicts/{filename}/resolve")
async def resolve_conflict(filename: str, resolution: str = Query(...)):
    # Find the conflict
    conflict_index = next((i for i, c in enumerate(conflicts_db) if c["filename"] == filename), None)
    
    if conflict_index is None:
        raise HTTPException(status_code=404, detail=f"Conflict for file {filename} not found")
    
    # Update the conflict resolution status
    conflicts_db[conflict_index]["resolution_status"] = "resolved"
    
    # Return success response
    return {
        "message": f"Conflict for {filename} resolved using {resolution} strategy",
        "filename": filename,
        "resolution": resolution
    }

# Get sync status for a specific file
@app.get("/sync-status/{filename}")
async def get_sync_status(filename: str):
    # Find all versions of the file
    file_versions = [f for f in files_db if f["filename"] == filename]
    
    if not file_versions:
        raise HTTPException(status_code=404, detail=f"File {filename} not found")
    
    # Check if file has conflicts
    has_conflicts = any(c["filename"] == filename and c["resolution_status"] == "pending" for c in conflicts_db)
    
    # Return detailed sync status
    return {
        "filename": filename,
        "versions": len(file_versions),
        "providers": list(set(f["provider"] for f in file_versions)),
        "has_conflicts": has_conflicts,
        "last_synced": max(f["modified_time"] for f in file_versions if "modified_time" in f),
        "size": next((f["size"] for f in file_versions if f["provider"] == "local"), 0)
    }

# Google authentication (mock)
@app.post("/auth/google")
async def initiate_google_auth():
    return {
        "auth_url": "https://accounts.google.com/o/oauth2/auth?client_id=mock_id&redirect_uri=http://localhost:3000/auth/callback&scope=https://www.googleapis.com/auth/drive&response_type=code",
        "message": "This is a mock authentication URL"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
