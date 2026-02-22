#!/usr/bin/env python3
"""Generate a long-lived service token for the MCP server.

Usage:
    python generate_token.py --secret-key YOUR_SECRET_KEY --email user@example.com

Or via environment variables:
    SECRET_KEY=xxx USER_EMAIL=user@example.com python generate_token.py
"""

import argparse
import os
from datetime import datetime, timedelta
from jose import jwt


def generate_service_token(secret_key: str, email: str, algorithm: str = "HS256") -> str:
    expire = datetime.utcnow() + timedelta(days=3650)  # 10 years
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, secret_key, algorithm=algorithm)


def main():
    parser = argparse.ArgumentParser(description="Generate MCP service token")
    parser.add_argument("--secret-key", default=os.environ.get("SECRET_KEY", ""))
    parser.add_argument("--email", default=os.environ.get("USER_EMAIL", ""))
    parser.add_argument("--algorithm", default="HS256")
    args = parser.parse_args()

    secret_key = args.secret_key
    email = args.email

    if not secret_key:
        print("Error: --secret-key or SECRET_KEY env var required")
        raise SystemExit(1)
    if not email:
        print("Error: --email or USER_EMAIL env var required")
        raise SystemExit(1)

    token = generate_service_token(secret_key, email, args.algorithm)
    print(f"\nService token for {email}:\n")
    print(token)
    print(f"\nSet this as POTATOES_API_TOKEN in your MCP server environment.\n")


if __name__ == "__main__":
    main()
