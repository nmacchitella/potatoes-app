# Integrations

Setting up external services for Potatoes.

## Google OAuth

Enable "Sign in with Google" functionality.

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the **Google+ API** (or Google Identity)

### 2. Configure OAuth Consent Screen

1. Navigate to **APIs & Services → OAuth consent screen**
2. Choose **External** user type
3. Fill in required fields:
   - App name: `Potatoes`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users (while in testing mode)

### 3. Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Potatoes Web Client`
5. Authorized JavaScript origins:
   ```
   http://localhost:3000
   https://potatoes-frontend.fly.dev
   ```
6. Authorized redirect URIs:
   ```
   http://localhost:8000/api/auth/google/callback
   https://potatoes-backend.fly.dev/api/auth/google/callback
   ```
7. Copy the **Client ID** and **Client Secret**

### 4. Configure Environment

**Local (.env):**
```env
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
```

**Production (Fly.io):**
```bash
fly secrets set GOOGLE_CLIENT_ID="123456789-abc.apps.googleusercontent.com" -a potatoes-backend
fly secrets set GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxx" -a potatoes-backend
```

### 5. Test OAuth Flow

1. Start backend: `uvicorn main:app --reload`
2. Visit: `http://localhost:8000/api/auth/google/login`
3. Should return Google authorization URL
4. Complete OAuth flow

### Troubleshooting

| Error | Solution |
|-------|----------|
| "redirect_uri_mismatch" | Add exact redirect URI to Google Console |
| "access_denied" | Check OAuth consent screen configuration |
| "invalid_client" | Verify client ID and secret |

---

## Email (SMTP)

Enable email verification and password reset emails.

### Gmail Setup

Gmail requires an **App Password** (not your regular password).

#### 1. Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**

#### 2. Generate App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select app: **Mail**
3. Select device: **Other** → Enter "Potatoes"
4. Click **Generate**
5. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)

#### 3. Configure Environment

**Local (.env):**
```env
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM=your-email@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

**Production (Fly.io):**
```bash
fly secrets set MAIL_USERNAME="your-email@gmail.com" -a potatoes-backend
fly secrets set MAIL_PASSWORD="xxxx xxxx xxxx xxxx" -a potatoes-backend
fly secrets set MAIL_FROM="your-email@gmail.com" -a potatoes-backend
```

### Alternative SMTP Providers

#### SendGrid

```env
MAIL_SERVER=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USERNAME=apikey
MAIL_PASSWORD=SG.xxxxxxxxxxxxx
MAIL_FROM=noreply@yourdomain.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

#### Mailgun

```env
MAIL_SERVER=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=postmaster@mg.yourdomain.com
MAIL_PASSWORD=your-mailgun-password
MAIL_FROM=noreply@yourdomain.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

### Test Email

```bash
# In Python shell
cd backend
source venv/bin/activate
python

>>> from services.email_service import EmailService
>>> # Check configuration loads without error
```

### Email Templates

Emails use HTML templates defined in `services/email_service.py`:
- **Verification email:** Sent on registration
- **Password reset:** Sent on forgot password request

---

## Cloudinary (Image Upload)

Enable recipe image uploads.

### 1. Create Cloudinary Account

1. Sign up at [Cloudinary](https://cloudinary.com/)
2. Go to Dashboard
3. Copy your credentials:
   - Cloud name
   - API Key
   - API Secret

### 2. Configure Environment

**Local (.env):**
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz
```

**Production (Fly.io):**
```bash
fly secrets set CLOUDINARY_CLOUD_NAME="your-cloud-name" -a potatoes-backend
fly secrets set CLOUDINARY_API_KEY="123456789012345" -a potatoes-backend
fly secrets set CLOUDINARY_API_SECRET="abcdefghijklmnopqrstuvwxyz" -a potatoes-backend
```

### 3. Usage

Images are uploaded via the recipe creation/update endpoints. The frontend sends the image, backend uploads to Cloudinary, and stores the returned URL.

---

## Integration Status

Check which integrations are configured:

| Integration | Required | Status Check |
|-------------|----------|--------------|
| Google OAuth | No | Try `/api/auth/google/login` |
| Email | No | Registration will skip verification if not configured |
| Cloudinary | No | Image upload will fail gracefully |

### Minimal Setup

For a working app with no integrations:
1. Users can register/login with email+password
2. Email verification is skipped
3. No Google login option
4. No image uploads

This is fine for development and testing.

---

## Security Best Practices

1. **Never commit secrets** - Use `.env` files (gitignored) or Fly.io secrets
2. **Use app passwords** - Never use your main Google password
3. **Rotate secrets** - Regenerate periodically, especially if compromised
4. **Restrict OAuth origins** - Only add URLs you actually use
5. **Monitor usage** - Check Google Cloud Console for OAuth usage
