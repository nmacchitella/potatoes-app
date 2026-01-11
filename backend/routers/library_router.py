"""
Library Router

Handles library sharing (partner/family mode) where two users
share ALL their recipes and collections with mutual editing rights.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List
from datetime import datetime

from database import get_db
from auth import get_current_user
from models import User, LibraryShare
from schemas import (
    LibraryShareCreate,
    LibraryShareResponse,
    LibraryPartner,
    PendingLibraryInvite,
    ShareableUser,
)
from services.notification_service import create_notification

router = APIRouter(prefix="/library", tags=["library-sharing"])


def get_library_partners(db: Session, user_id: str) -> List[str]:
    """
    Get list of user IDs that share libraries with the given user.
    Returns partner IDs for accepted library shares (in either direction).
    """
    shares = db.query(LibraryShare).filter(
        LibraryShare.status == "accepted",
        or_(
            LibraryShare.inviter_id == user_id,
            LibraryShare.invitee_id == user_id
        )
    ).all()

    partner_ids = []
    for share in shares:
        if share.inviter_id == user_id:
            partner_ids.append(share.invitee_id)
        else:
            partner_ids.append(share.inviter_id)

    return partner_ids


@router.get("/partners", response_model=List[LibraryPartner])
async def list_library_partners(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all users who share libraries with the current user.
    These are accepted mutual shares where both users can see/edit each other's content.
    """
    shares = db.query(LibraryShare).filter(
        LibraryShare.status == "accepted",
        or_(
            LibraryShare.inviter_id == current_user.id,
            LibraryShare.invitee_id == current_user.id
        )
    ).all()

    partners = []
    for share in shares:
        # Get the partner (the other user in the share)
        if share.inviter_id == current_user.id:
            partner = db.query(User).filter(User.id == share.invitee_id).first()
        else:
            partner = db.query(User).filter(User.id == share.inviter_id).first()

        if partner:
            partners.append(LibraryPartner(
                id=partner.id,
                name=partner.name,
                profile_image_url=partner.profile_image_url,
                share_id=share.id,
                since=share.accepted_at or share.created_at
            ))

    return partners


@router.get("/invites/pending", response_model=List[PendingLibraryInvite])
async def list_pending_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List pending library share invitations received by the current user.
    """
    invites = db.query(LibraryShare).filter(
        LibraryShare.invitee_id == current_user.id,
        LibraryShare.status == "pending"
    ).all()

    result = []
    for invite in invites:
        inviter = db.query(User).filter(User.id == invite.inviter_id).first()
        if inviter:
            result.append(PendingLibraryInvite(
                id=invite.id,
                inviter=ShareableUser(
                    id=inviter.id,
                    name=inviter.name,
                    profile_image_url=inviter.profile_image_url
                ),
                created_at=invite.created_at
            ))

    return result


@router.get("/invites/sent", response_model=List[LibraryShareResponse])
async def list_sent_invites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List library share invitations sent by the current user (pending ones).
    """
    invites = db.query(LibraryShare).filter(
        LibraryShare.inviter_id == current_user.id,
        LibraryShare.status == "pending"
    ).all()

    result = []
    for invite in invites:
        inviter = current_user
        invitee = db.query(User).filter(User.id == invite.invitee_id).first()
        if invitee:
            result.append(LibraryShareResponse(
                id=invite.id,
                inviter=ShareableUser(
                    id=inviter.id,
                    name=inviter.name,
                    profile_image_url=inviter.profile_image_url
                ),
                invitee=ShareableUser(
                    id=invitee.id,
                    name=invitee.name,
                    profile_image_url=invitee.profile_image_url
                ),
                status=invite.status,
                created_at=invite.created_at,
                accepted_at=invite.accepted_at
            ))

    return result


@router.post("/invite", response_model=LibraryShareResponse)
async def invite_to_share_library(
    data: LibraryShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Invite a user to share libraries (mutual access to all recipes/collections).
    """
    if data.invitee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    # Check invitee exists
    invitee = db.query(User).filter(User.id == data.invitee_id).first()
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for existing share (in either direction)
    existing = db.query(LibraryShare).filter(
        or_(
            and_(
                LibraryShare.inviter_id == current_user.id,
                LibraryShare.invitee_id == data.invitee_id
            ),
            and_(
                LibraryShare.inviter_id == data.invitee_id,
                LibraryShare.invitee_id == current_user.id
            )
        )
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already sharing libraries with this user")
        elif existing.status == "pending":
            raise HTTPException(status_code=400, detail="Invitation already pending")
        elif existing.status == "declined":
            # Allow re-inviting if previously declined
            existing.status = "pending"
            existing.inviter_id = current_user.id
            existing.invitee_id = data.invitee_id
            existing.created_at = datetime.utcnow()
            existing.accepted_at = None
            db.commit()
            db.refresh(existing)
            share = existing
        else:
            raise HTTPException(status_code=400, detail="Invalid share state")
    else:
        # Create new invitation
        share = LibraryShare(
            inviter_id=current_user.id,
            invitee_id=data.invitee_id,
            status="pending"
        )
        db.add(share)
        db.commit()
        db.refresh(share)

    # Send notification to invitee
    create_notification(
        db=db,
        user_id=data.invitee_id,
        type="library_share_invite",
        title="Library Share Invitation",
        message=f"{current_user.name} wants to share their recipe library with you",
        link="/settings",
        data={
            "share_id": share.id,
            "inviter_name": current_user.name,
            "inviter_id": current_user.id
        }
    )

    return LibraryShareResponse(
        id=share.id,
        inviter=ShareableUser(
            id=current_user.id,
            name=current_user.name,
            profile_image_url=current_user.profile_image_url
        ),
        invitee=ShareableUser(
            id=invitee.id,
            name=invitee.name,
            profile_image_url=invitee.profile_image_url
        ),
        status=share.status,
        created_at=share.created_at,
        accepted_at=share.accepted_at
    )


@router.post("/invites/{share_id}/accept", response_model=LibraryShareResponse)
async def accept_library_invite(
    share_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accept a library share invitation.
    After accepting, both users can see and edit each other's recipes and collections.
    """
    share = db.query(LibraryShare).filter(
        LibraryShare.id == share_id,
        LibraryShare.invitee_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if share.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation already {share.status}")

    share.status = "accepted"
    share.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(share)

    # Notify the inviter that their invitation was accepted
    inviter = db.query(User).filter(User.id == share.inviter_id).first()
    create_notification(
        db=db,
        user_id=share.inviter_id,
        type="library_share_accepted",
        title="Library Share Accepted",
        message=f"{current_user.name} accepted your library share invitation",
        link="/settings",
        data={
            "share_id": share.id,
            "partner_name": current_user.name,
            "partner_id": current_user.id
        }
    )

    return LibraryShareResponse(
        id=share.id,
        inviter=ShareableUser(
            id=inviter.id if inviter else share.inviter_id,
            name=inviter.name if inviter else "Unknown",
            profile_image_url=inviter.profile_image_url if inviter else None
        ),
        invitee=ShareableUser(
            id=current_user.id,
            name=current_user.name,
            profile_image_url=current_user.profile_image_url
        ),
        status=share.status,
        created_at=share.created_at,
        accepted_at=share.accepted_at
    )


@router.post("/invites/{share_id}/decline")
async def decline_library_invite(
    share_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Decline a library share invitation.
    """
    share = db.query(LibraryShare).filter(
        LibraryShare.id == share_id,
        LibraryShare.invitee_id == current_user.id
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if share.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation already {share.status}")

    share.status = "declined"
    db.commit()

    return {"message": "Invitation declined"}


@router.delete("/invites/{share_id}")
async def cancel_library_invite(
    share_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a pending library share invitation (by the inviter).
    """
    share = db.query(LibraryShare).filter(
        LibraryShare.id == share_id,
        LibraryShare.inviter_id == current_user.id,
        LibraryShare.status == "pending"
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Invitation not found")

    db.delete(share)
    db.commit()

    return {"message": "Invitation cancelled"}


@router.delete("/partners/{partner_id}")
async def remove_library_partner(
    partner_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a library partner (stop sharing libraries).
    Either user can end the sharing relationship.
    """
    share = db.query(LibraryShare).filter(
        LibraryShare.status == "accepted",
        or_(
            and_(
                LibraryShare.inviter_id == current_user.id,
                LibraryShare.invitee_id == partner_id
            ),
            and_(
                LibraryShare.inviter_id == partner_id,
                LibraryShare.invitee_id == current_user.id
            )
        )
    ).first()

    if not share:
        raise HTTPException(status_code=404, detail="Library partner not found")

    db.delete(share)
    db.commit()

    return {"message": "Library sharing removed"}
