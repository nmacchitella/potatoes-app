from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import schemas
import auth
import models

router = APIRouter(prefix="/admin", tags=["admin"])


def get_current_admin_user(current_user: models.User = Depends(auth.get_current_user)):
    """Dependency to ensure the current user is an admin"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


@router.get("/users")
def list_all_users(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all users (requires admin privileges)"""
    users = db.query(models.User).offset(skip).limit(limit).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "username": u.username,
            "is_admin": u.is_admin,
            "is_verified": u.is_verified,
            "is_public": u.is_public,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.get("/users/{user_id}")
def get_user(
    user_id: str,
    current_user: models.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get a specific user by ID (requires admin privileges)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "username": user.username,
        "bio": user.bio,
        "profile_image_url": user.profile_image_url,
        "is_admin": user.is_admin,
        "is_verified": user.is_verified,
        "is_public": user.is_public,
        "oauth_provider": user.oauth_provider,
        "created_at": user.created_at,
    }


@router.post("/promote-user/{user_id}")
def promote_user_to_admin(
    user_id: str,
    current_user: models.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Promote a user to admin (requires admin privileges)"""
    target_user = db.query(models.User).filter(models.User.id == user_id).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if target_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already an admin"
        )

    target_user.is_admin = True
    db.commit()
    db.refresh(target_user)

    return {
        "message": f"User {target_user.email} has been promoted to admin",
        "user_id": target_user.id,
        "email": target_user.email
    }


@router.post("/demote-user/{user_id}")
def demote_user_from_admin(
    user_id: str,
    current_user: models.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Demote a user from admin (requires admin privileges)"""
    # Prevent self-demotion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot demote yourself"
        )

    target_user = db.query(models.User).filter(models.User.id == user_id).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not target_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not an admin"
        )

    target_user.is_admin = False
    db.commit()
    db.refresh(target_user)

    return {
        "message": f"User {target_user.email} has been demoted from admin",
        "user_id": target_user.id,
        "email": target_user.email
    }


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: models.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a user (requires admin privileges)"""
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete yourself"
        )

    target_user = db.query(models.User).filter(models.User.id == user_id).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    db.delete(target_user)
    db.commit()

    return {
        "message": f"User {target_user.email} has been deleted",
        "user_id": user_id
    }


@router.get("/stats")
def get_admin_stats(
    current_user: models.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get platform statistics (requires admin privileges)"""
    total_users = db.query(models.User).count()
    verified_users = db.query(models.User).filter(models.User.is_verified == True).count()
    admin_users = db.query(models.User).filter(models.User.is_admin == True).count()
    total_recipes = db.query(models.Recipe).filter(models.Recipe.deleted_at == None).count()
    public_recipes = db.query(models.Recipe).filter(
        models.Recipe.deleted_at == None,
        models.Recipe.privacy_level == "public"
    ).count()
    total_collections = db.query(models.Collection).count()
    total_meal_plans = db.query(models.MealPlan).count()
    total_tags = db.query(models.Tag).count()

    return {
        "users": {
            "total": total_users,
            "verified": verified_users,
            "admins": admin_users,
        },
        "recipes": {
            "total": total_recipes,
            "public": public_recipes,
        },
        "collections": total_collections,
        "meal_plans": total_meal_plans,
        "tags": total_tags,
    }
