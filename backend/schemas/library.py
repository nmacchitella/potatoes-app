from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from schemas.user import ShareableUser


class LibraryShareCreate(BaseModel):
    """Request to invite a user to share libraries."""
    invitee_id: str


class LibraryShareResponse(BaseModel):
    """Response for a library share invitation."""
    id: str
    inviter: ShareableUser
    invitee: ShareableUser
    status: str  # pending, accepted, declined
    created_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LibraryPartner(BaseModel):
    """A user who shares their library with you (and vice versa)."""
    id: str  # The partner's user ID
    name: str
    profile_image_url: Optional[str] = None
    share_id: str  # The LibraryShare ID (for removing the share)
    since: datetime  # When the share was accepted

    class Config:
        from_attributes = True


class PendingLibraryInvite(BaseModel):
    """A pending library share invitation."""
    id: str  # The LibraryShare ID
    inviter: ShareableUser
    created_at: datetime

    class Config:
        from_attributes = True
