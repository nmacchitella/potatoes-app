"""
Notification Router

Handles user notifications.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from database import get_db
from auth import get_current_user
from models import User, Notification, UserFollow, GroceryListShare
from schemas import Notification as NotificationSchema, NotificationMarkRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationSchema])
async def get_notifications(
    unread_only: bool = Query(False, description="Only return unread notifications"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's notifications."""
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id
    )

    if unread_only:
        query = query.filter(Notification.is_read == False)

    query = query.order_by(desc(Notification.created_at))
    query = query.offset(offset).limit(limit)

    notifications = query.all()

    # For follow_request notifications, check if they're still actionable
    result = []
    for notif in notifications:
        notif_dict = {
            "id": notif.id,
            "user_id": notif.user_id,
            "type": notif.type,
            "title": notif.title,
            "message": notif.message,
            "link": notif.link,
            "data": notif.data,
            "is_read": notif.is_read,
            "created_at": notif.created_at,
            "is_actionable": None,
        }

        if notif.type == "follow_request" and notif.data:
            follower_id = notif.data.get("follower_id")
            if follower_id:
                # Check if the follow request is still pending
                follow = db.query(UserFollow).filter(
                    UserFollow.follower_id == follower_id,
                    UserFollow.following_id == current_user.id
                ).first()
                # Only actionable if follow exists and is still pending
                notif_dict["is_actionable"] = follow is not None and follow.status == "pending"

        elif notif.type == "grocery_share_invitation" and notif.data:
            share_id = notif.data.get("share_id")
            if share_id:
                # Check if the grocery share is still pending
                share = db.query(GroceryListShare).filter(
                    GroceryListShare.id == share_id,
                    GroceryListShare.user_id == current_user.id
                ).first()
                # Only actionable if share exists and is still pending
                notif_dict["is_actionable"] = share is not None and share.status == "pending"

        result.append(notif_dict)

    return result


@router.get("/unread-count")
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get count of unread notifications."""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()

    return {"message": "Notification marked as read"}


@router.post("/read-all")
async def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})

    db.commit()

    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a notification."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()

    return {"message": "Notification deleted"}
