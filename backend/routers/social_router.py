"""
Social Router

Handles user follows, profiles, and social feed.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from typing import List, Optional

from database import get_db
from auth import get_current_user, get_current_user_optional
from models import User, UserFollow, Recipe
from schemas import (
    UserSearchResult, UserProfilePublic, FollowResponse,
    RecipeSummary, RecipeListResponse,
)
import math

router = APIRouter(prefix="/users", tags=["social"])


@router.get("/search", response_model=List[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search for users by name or username."""
    search_term = f"%{q}%"

    users = db.query(User).filter(
        User.id != current_user.id,
        User.is_public == True,
        or_(
            User.name.ilike(search_term),
            User.username.ilike(search_term)
        )
    ).limit(limit).all()

    # Get follow statuses
    results = []
    for user in users:
        follow = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == user.id
        ).first()

        results.append(UserSearchResult(
            id=user.id,
            name=user.name,
            username=user.username,
            profile_image_url=user.profile_image_url,
            is_public=user.is_public,
            is_followed_by_me=follow is not None and follow.status == 'confirmed',
            follow_status=follow.status if follow else None,
        ))

    return results


@router.get("/{username}", response_model=UserProfilePublic)
async def get_user_profile(
    username: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a user's public profile by username."""
    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if user is public or if current user is viewing their own profile
    if not user.is_public and (not current_user or current_user.id != user.id):
        raise HTTPException(status_code=404, detail="User not found")

    # Get follower/following counts
    follower_count = db.query(UserFollow).filter(
        UserFollow.following_id == user.id,
        UserFollow.status == 'confirmed'
    ).count()

    following_count = db.query(UserFollow).filter(
        UserFollow.follower_id == user.id,
        UserFollow.status == 'confirmed'
    ).count()

    # Check if current user follows this user
    is_followed_by_me = False
    follow_status = None
    if current_user and current_user.id != user.id:
        follow = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == user.id
        ).first()
        if follow:
            is_followed_by_me = follow.status == 'confirmed'
            follow_status = follow.status

    return UserProfilePublic(
        id=user.id,
        name=user.name,
        username=user.username,
        bio=user.bio,
        profile_image_url=user.profile_image_url,
        is_public=user.is_public,
        follower_count=follower_count,
        following_count=following_count,
        is_followed_by_me=is_followed_by_me,
        follow_status=follow_status,
    )


@router.get("/{username}/recipes", response_model=RecipeListResponse)
async def get_user_recipes(
    username: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a user's public recipes."""
    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Only show public recipes for other users
    query = db.query(Recipe).filter(
        Recipe.author_id == user.id,
        Recipe.deleted_at.is_(None),
        Recipe.status == 'published'
    )

    # If viewing own profile, show all recipes
    if current_user and current_user.id == user.id:
        query = db.query(Recipe).filter(
            Recipe.author_id == user.id,
            Recipe.deleted_at.is_(None)
        )
    else:
        query = query.filter(Recipe.privacy_level == 'public')

    total = query.count()
    query = query.options(joinedload(Recipe.author))
    query = query.order_by(Recipe.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    recipes = query.all()

    return RecipeListResponse(
        items=[RecipeSummary.model_validate(r) for r in recipes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1
    )


@router.post("/{user_id}/follow", response_model=FollowResponse)
async def follow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Follow a user."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    # Check if target user exists
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already following
    existing = db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.following_id == user_id
    ).first()

    if existing:
        if existing.status == 'confirmed':
            raise HTTPException(status_code=400, detail="Already following this user")
        elif existing.status == 'pending':
            raise HTTPException(status_code=400, detail="Follow request already pending")
        elif existing.status == 'declined':
            # Allow re-requesting
            existing.status = 'pending' if not target_user.is_public else 'confirmed'
            db.commit()
            return FollowResponse(
                status=existing.status,
                message="Follow request sent" if existing.status == 'pending' else "Now following"
            )

    # Create follow relationship
    # If user is public, auto-confirm. Otherwise, pending.
    status = 'confirmed' if target_user.is_public else 'pending'

    follow = UserFollow(
        follower_id=current_user.id,
        following_id=user_id,
        status=status,
    )
    db.add(follow)
    db.commit()

    return FollowResponse(
        status=status,
        message="Now following" if status == 'confirmed' else "Follow request sent"
    )


@router.delete("/{user_id}/follow", response_model=FollowResponse)
async def unfollow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unfollow a user."""
    follow = db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.following_id == user_id
    ).first()

    if not follow:
        raise HTTPException(status_code=400, detail="Not following this user")

    db.delete(follow)
    db.commit()

    return FollowResponse(
        status='confirmed',
        message="Unfollowed successfully"
    )


@router.get("/me/followers", response_model=List[UserSearchResult])
async def get_my_followers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of users following the current user."""
    follows = db.query(UserFollow).filter(
        UserFollow.following_id == current_user.id,
        UserFollow.status == 'confirmed'
    ).all()

    follower_ids = [f.follower_id for f in follows]
    followers = db.query(User).filter(User.id.in_(follower_ids)).all() if follower_ids else []

    # Check if current user follows them back
    results = []
    for user in followers:
        follow_back = db.query(UserFollow).filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == user.id
        ).first()

        results.append(UserSearchResult(
            id=user.id,
            name=user.name,
            username=user.username,
            profile_image_url=user.profile_image_url,
            is_public=user.is_public,
            is_followed_by_me=follow_back is not None and follow_back.status == 'confirmed',
            follow_status=follow_back.status if follow_back else None,
        ))

    return results


@router.get("/me/following", response_model=List[UserSearchResult])
async def get_my_following(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of users the current user is following."""
    follows = db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.status == 'confirmed'
    ).all()

    following_ids = [f.following_id for f in follows]
    following = db.query(User).filter(User.id.in_(following_ids)).all() if following_ids else []

    results = []
    for user in following:
        results.append(UserSearchResult(
            id=user.id,
            name=user.name,
            username=user.username,
            profile_image_url=user.profile_image_url,
            is_public=user.is_public,
            is_followed_by_me=True,
            follow_status='confirmed',
        ))

    return results


@router.get("/me/follow-requests", response_model=List[UserSearchResult])
async def get_follow_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get pending follow requests for the current user."""
    follows = db.query(UserFollow).filter(
        UserFollow.following_id == current_user.id,
        UserFollow.status == 'pending'
    ).all()

    requester_ids = [f.follower_id for f in follows]
    requesters = db.query(User).filter(User.id.in_(requester_ids)).all() if requester_ids else []

    results = []
    for user in requesters:
        results.append(UserSearchResult(
            id=user.id,
            name=user.name,
            username=user.username,
            profile_image_url=user.profile_image_url,
            is_public=user.is_public,
            is_followed_by_me=False,
            follow_status='pending',
        ))

    return results


@router.post("/me/follow-requests/{user_id}/accept", response_model=FollowResponse)
async def accept_follow_request(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Accept a follow request."""
    follow = db.query(UserFollow).filter(
        UserFollow.follower_id == user_id,
        UserFollow.following_id == current_user.id,
        UserFollow.status == 'pending'
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Follow request not found")

    follow.status = 'confirmed'
    db.commit()

    return FollowResponse(
        status='confirmed',
        message="Follow request accepted"
    )


@router.post("/me/follow-requests/{user_id}/decline", response_model=FollowResponse)
async def decline_follow_request(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Decline a follow request."""
    follow = db.query(UserFollow).filter(
        UserFollow.follower_id == user_id,
        UserFollow.following_id == current_user.id,
        UserFollow.status == 'pending'
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Follow request not found")

    follow.status = 'declined'
    db.commit()

    return FollowResponse(
        status='confirmed',
        message="Follow request declined"
    )


# Feed endpoint
@router.get("/me/feed", response_model=RecipeListResponse)
async def get_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get recipes from users the current user follows."""
    # Get IDs of users we follow
    following = db.query(UserFollow.following_id).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.status == 'confirmed'
    ).all()

    following_ids = [f[0] for f in following]

    if not following_ids:
        return RecipeListResponse(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
            total_pages=1
        )

    query = db.query(Recipe).filter(
        Recipe.author_id.in_(following_ids),
        Recipe.privacy_level == 'public',
        Recipe.status == 'published',
        Recipe.deleted_at.is_(None)
    )

    total = query.count()
    query = query.options(joinedload(Recipe.author))
    query = query.order_by(Recipe.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    recipes = query.all()

    return RecipeListResponse(
        items=[RecipeSummary.model_validate(r) for r in recipes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1
    )
