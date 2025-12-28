"""
Image Upload Service

Handles image uploads to Cloudinary storage.
"""

import uuid

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile

from config import logger, settings

# Allowed image types and max size
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def configure_cloudinary():
    """Configure Cloudinary with credentials."""
    if not is_cloudinary_configured():
        return False

    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    return True


def is_cloudinary_configured() -> bool:
    """Check if Cloudinary is configured."""
    return bool(
        settings.cloudinary_cloud_name
        and settings.cloudinary_api_key
        and settings.cloudinary_api_secret
    )


async def upload_image(
    file: UploadFile,
    prefix: str = "recipes",
) -> str:
    """
    Upload an image to Cloudinary.

    Args:
        file: The uploaded file
        prefix: Folder prefix (e.g., 'recipes', 'users')

    Returns:
        Public URL of the uploaded image

    Raises:
        HTTPException: If upload fails or file is invalid
    """
    if not configure_cloudinary():
        raise HTTPException(
            status_code=503,
            detail="Image storage is not configured",
        )

    # Validate content type
    content_type = file.content_type
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_CONTENT_TYPES.keys())}",
        )

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    # Generate unique public_id
    public_id = f"{prefix}/{uuid.uuid4()}"

    # Upload to Cloudinary
    try:
        result = cloudinary.uploader.upload(
            content,
            public_id=public_id,
            folder="potatoes",
            resource_type="image",
            transformation=[
                {"quality": "auto", "fetch_format": "auto"},  # Auto-optimize
                {"width": 1200, "crop": "limit"},  # Max width 1200px
            ],
        )
        image_url = result["secure_url"]
        logger.info(f"Uploaded image: {image_url}")
        return image_url

    except Exception as e:
        logger.error(f"Failed to upload image to Cloudinary: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to upload image",
        )


async def delete_image(url: str) -> bool:
    """
    Delete an image from Cloudinary.

    Args:
        url: The public URL of the image

    Returns:
        True if deleted, False if not a Cloudinary image
    """
    if not configure_cloudinary():
        return False

    # Check if this is a Cloudinary image
    if "cloudinary.com" not in url:
        return False

    try:
        # Extract public_id from URL
        # URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}
        parts = url.split("/upload/")
        if len(parts) != 2:
            return False

        # Get everything after upload/ and remove version and extension
        path = parts[1]
        # Remove version (v1234567890/)
        if path.startswith("v"):
            path = "/".join(path.split("/")[1:])
        # Remove extension
        public_id = path.rsplit(".", 1)[0]

        cloudinary.uploader.destroy(public_id)
        logger.info(f"Deleted image: {public_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to delete image from Cloudinary: {e}")
        return False
