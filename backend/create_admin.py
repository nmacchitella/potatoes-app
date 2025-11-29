#!/usr/bin/env python3
"""
Create or promote an admin user.

Usage:
    python create_admin.py <email>
"""

import sys
import uuid
from getpass import getpass
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from database import engine
from models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_admin(email: str):
    with Session(engine) as db:
        # Check if user exists
        user = db.query(User).filter(User.email == email).first()

        if user:
            if user.is_admin:
                print(f"User {email} is already an admin.")
                return

            # Promote existing user
            user.is_admin = True
            db.commit()
            print(f"User {email} has been promoted to admin.")
        else:
            # Create new admin user
            password = getpass("Enter password for new admin user: ")
            confirm = getpass("Confirm password: ")

            if password != confirm:
                print("Passwords do not match.")
                sys.exit(1)

            if len(password) < 6:
                print("Password must be at least 6 characters.")
                sys.exit(1)

            user = User(
                id=str(uuid.uuid4()),
                email=email,
                hashed_password=pwd_context.hash(password),
                display_name="Admin",
                is_admin=True,
                is_verified=True
            )
            db.add(user)
            db.commit()
            print(f"Admin user {email} created successfully.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python create_admin.py <email>")
        sys.exit(1)

    create_admin(sys.argv[1])
