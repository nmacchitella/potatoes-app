"""
Tag Router

CRUD operations for recipe tags.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from auth import get_current_user
from models import User, Tag
from schemas import TagCreate, Tag as TagSchema

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=List[TagSchema])
async def list_tags(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search tag names"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all available tags (system tags + user's custom tags)."""
    query = db.query(Tag)

    # Filter by category if provided
    if category:
        query = query.filter(Tag.category == category)

    # Search by name if provided
    if search:
        query = query.filter(Tag.name.ilike(f"%{search}%"))

    # Order by system tags first, then alphabetically
    query = query.order_by(Tag.is_system.desc(), Tag.name)

    tags = query.all()
    return tags


@router.post("", response_model=TagSchema, status_code=201)
async def create_tag(
    tag_data: TagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new custom tag."""
    # Check if tag already exists (case-insensitive)
    existing = db.query(Tag).filter(
        Tag.name.ilike(tag_data.name)
    ).first()

    if existing:
        # Return existing tag instead of error
        return existing

    tag = Tag(
        name=tag_data.name,
        category=tag_data.category or "custom",
        is_system=False,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)

    return tag


@router.get("/{tag_id}", response_model=TagSchema)
async def get_tag(
    tag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single tag by ID."""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    return tag


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a custom tag (system tags cannot be deleted, only admins can delete)."""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if tag.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system tags")

    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can delete tags")

    db.delete(tag)
    db.commit()

    return None
