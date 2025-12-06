"""
Notification Service

Centralized service for creating and managing notifications.
"""

import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from models import Notification, User

logger = logging.getLogger("potatoes.notification_service")


def create_notification(
    db: Session,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Notification:
    """
    Create a notification for a user.

    Args:
        db: Database session
        user_id: ID of the user to notify
        notification_type: Type of notification (follow_request, new_follower, etc.)
        title: Notification title
        message: Notification message
        link: Optional link for the notification
        data: Optional additional data as JSON

    Returns:
        Created Notification object
    """
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        link=link,
        data=data,
    )
    db.add(notification)
    logger.debug(f"Created {notification_type} notification for user {user_id}")
    return notification


def notify_follow_request(db: Session, follower: User, target_user: User) -> Notification:
    """
    Create a notification for a follow request.

    Args:
        db: Database session
        follower: User who wants to follow
        target_user: User being followed
    """
    return create_notification(
        db=db,
        user_id=target_user.id,
        notification_type="follow_request",
        title="New Follow Request",
        message=f"{follower.name} wants to follow you",
        link=f"/profile/{follower.username or follower.id}",
        data={
            "follower_id": follower.id,
            "follower_name": follower.name,
            "follower_username": follower.username,
        },
    )


def notify_new_follower(db: Session, follower: User, target_user: User) -> Notification:
    """
    Create a notification for a new follower (when auto-confirmed for public profiles).

    Args:
        db: Database session
        follower: User who started following
        target_user: User being followed
    """
    return create_notification(
        db=db,
        user_id=target_user.id,
        notification_type="new_follower",
        title="New Follower",
        message=f"{follower.name} started following you",
        link=f"/profile/{follower.username or follower.id}",
        data={
            "follower_id": follower.id,
            "follower_name": follower.name,
            "follower_username": follower.username,
        },
    )


def notify_follow_accepted(db: Session, requester: User, accepter: User) -> Notification:
    """
    Create a notification when a follow request is accepted.

    Args:
        db: Database session
        requester: User who requested to follow
        accepter: User who accepted the request
    """
    return create_notification(
        db=db,
        user_id=requester.id,
        notification_type="follow_accepted",
        title="Follow Request Accepted",
        message=f"{accepter.name} accepted your follow request",
        link=f"/profile/{accepter.username or accepter.id}",
        data={
            "user_id": accepter.id,
            "user_name": accepter.name,
            "user_username": accepter.username,
        },
    )


def notify_recipe_saved(
    db: Session,
    recipe_owner: User,
    saver: User,
    recipe_id: str,
    recipe_title: str
) -> Notification:
    """
    Create a notification when someone saves/clones a recipe.

    Args:
        db: Database session
        recipe_owner: Owner of the original recipe
        saver: User who saved the recipe
        recipe_id: ID of the recipe that was saved
        recipe_title: Title of the recipe
    """
    return create_notification(
        db=db,
        user_id=recipe_owner.id,
        notification_type="recipe_saved",
        title="Recipe Saved",
        message=f"{saver.name} saved your recipe \"{recipe_title}\"",
        link=f"/recipes/{recipe_id}",
        data={
            "recipe_id": recipe_id,
            "recipe_title": recipe_title,
            "saver_id": saver.id,
            "saver_name": saver.name,
        },
    )


def mark_notification_read(db: Session, notification_id: str, user_id: str) -> bool:
    """
    Mark a notification as read.

    Args:
        db: Database session
        notification_id: ID of the notification
        user_id: ID of the user (for authorization)

    Returns:
        True if notification was found and marked, False otherwise
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id
    ).first()

    if not notification:
        return False

    notification.is_read = True
    return True


def mark_all_notifications_read(db: Session, user_id: str) -> int:
    """
    Mark all notifications as read for a user.

    Args:
        db: Database session
        user_id: ID of the user

    Returns:
        Number of notifications marked as read
    """
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).update({"is_read": True})

    logger.debug(f"Marked {count} notifications as read for user {user_id}")
    return count


def get_unread_count(db: Session, user_id: str) -> int:
    """
    Get count of unread notifications for a user.

    Args:
        db: Database session
        user_id: ID of the user

    Returns:
        Number of unread notifications
    """
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False
    ).count()
