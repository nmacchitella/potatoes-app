import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from starlette.background import BackgroundTasks
from dotenv import load_dotenv
load_dotenv()

# Email configuration
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
    MAIL_FROM=os.getenv("MAIL_FROM", "noreply@potatoes.app"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=os.getenv("MAIL_STARTTLS", "True").lower() == "true",
    MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS", "False").lower() == "true",
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

class EmailService:
    def __init__(self):
        self.fastmail = FastMail(conf)

    def _get_base_template(self, content: str) -> str:
        """Base email template with branding - responsive for desktop and mobile"""
        return f'''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Potatoes</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                    <tr>
                        <td style="padding: 32px 24px 24px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center">
                                        <div style="width: 48px; height: 48px; background-color: #F59E0B; border-radius: 10px; display: inline-block; line-height: 48px; font-size: 24px;">
                                            🥔
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding-top: 12px;">
                                        <h1 style="margin: 0; color: #111827; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Potatoes</h1>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px 24px;">
                            {content}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
                                This email was sent by Potatoes
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                                If you didn't request this email, you can safely ignore it.
                            </p>
                        </td>
                    </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 480px;">
                    <tr>
                        <td style="padding: 24px; text-align: center;">
                            <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                                © 2024 Potatoes. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
'''

    def _get_verification_content(self, link: str) -> str:
        """Verification email content"""
        return f'''
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
        <td align="center">
            <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px; font-weight: 600;">Verify your email</h2>
        </td>
    </tr>
    <tr>
        <td>
            <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
                Thanks for signing up! Please verify your email address to complete your registration.
            </p>
        </td>
    </tr>
    <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td style="background-color: #F59E0B; border-radius: 8px;">
                        <a href="{link}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; text-align: center;">
                            Verify Email Address
                        </a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
    <tr>
        <td>
            <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px; text-align: center;">
                Or copy and paste this link into your browser:
            </p>
            <p style="margin: 0; padding: 12px 16px; background-color: #f3f4f6; border-radius: 8px; word-break: break-all;">
                <a href="{link}" style="color: #F59E0B; font-size: 12px; text-decoration: none;">{link}</a>
            </p>
        </td>
    </tr>
    <tr>
        <td style="padding-top: 24px;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                This link will expire in 24 hours.
            </p>
        </td>
    </tr>
</table>
'''

    def _get_reset_password_content(self, link: str) -> str:
        """Password reset email content"""
        return f'''
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
        <td align="center">
            <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px; font-weight: 600;">Reset your password</h2>
        </td>
    </tr>
    <tr>
        <td>
            <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 15px; line-height: 1.6; text-align: center;">
                We received a request to reset your password. Click the button below to create a new password.
            </p>
        </td>
    </tr>
    <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                    <td style="background-color: #F59E0B; border-radius: 8px;">
                        <a href="{link}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; text-align: center;">
                            Reset Password
                        </a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
    <tr>
        <td>
            <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 13px; text-align: center;">
                Or copy and paste this link into your browser:
            </p>
            <p style="margin: 0; padding: 12px 16px; background-color: #f3f4f6; border-radius: 8px; word-break: break-all;">
                <a href="{link}" style="color: #F59E0B; font-size: 12px; text-decoration: none;">{link}</a>
            </p>
        </td>
    </tr>
    <tr>
        <td style="padding-top: 24px;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            </p>
        </td>
    </tr>
</table>
'''

    async def send_verification_email(self, email: EmailStr, token: str, background_tasks: BackgroundTasks):
        """Send verification email"""
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        link = f"{frontend_url}/auth/verify-email?token={token}"

        content = self._get_verification_content(link)
        html_body = self._get_base_template(content)

        message = MessageSchema(
            subject="Verify your Potatoes account",
            recipients=[email],
            body=html_body,
            subtype=MessageType.html
        )

        try:
            background_tasks.add_task(self.fastmail.send_message, message)
        except Exception as e:
            print(f"Failed to send email: {e}")

    async def send_password_reset_email(self, email: EmailStr, token: str, background_tasks: BackgroundTasks):
        """Send password reset email"""
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        link = f"{frontend_url}/auth/reset-password?token={token}"

        content = self._get_reset_password_content(link)
        html_body = self._get_base_template(content)

        message = MessageSchema(
            subject="Reset your Potatoes password",
            recipients=[email],
            body=html_body,
            subtype=MessageType.html
        )

        try:
            background_tasks.add_task(self.fastmail.send_message, message)
        except Exception as e:
            print(f"Failed to send email: {e}")
