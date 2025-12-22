# Environment Variables Setup Guide

This guide explains which environment variables need to be added to which service for the Google OAuth2 integration.

## 📁 Agent Service (NestJS) - `agent-service/.env`

**This is the PRIMARY configuration file for OAuth2.**

```bash
# Google OAuth2 Credentials
# Get these from: https://console.cloud.google.com/apis/credentials
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Frontend URL (where to redirect users after OAuth)
FRONTEND_URL=http://localhost:3000

# Python Backend API (to save the refresh tokens)
PYTHON_API_URL=http://localhost:8000

# Other existing variables...
REDIS_HOST=localhost
MONGO_URI=mongodb://localhost:27017/agent-service
```

### How to Get Google OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Gmail API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add authorized redirect URI: `http://localhost:3001/auth/google/callback`
7. Copy the Client ID and Client Secret

---

## 📁 Frontend (Next.js) - `NickAI/frontend/.env.local`

**Only needs the Agent Service URL to initiate OAuth.**

```bash
# Existing variables...
NEXT_PUBLIC_API_URL=http://localhost:8000

# Add this for the OAuth flow
NEXT_PUBLIC_AGENT_API=http://localhost:3001
```

### Why?

The frontend needs to redirect users to the agent-service for OAuth:

```typescript
// In your frontend code
const handleConnectGmail = () => {
  window.location.href = `${process.env.NEXT_PUBLIC_AGENT_API}/auth/google/connect/${coachId}`;
};
```

---

## 📁 Python Backend - `NickAI/backend/.env`

**No new OAuth variables needed!**

The Python backend just needs to have the endpoint ready to receive the tokens. The agent-service will call:

```
PATCH /api/coaches/{coachId}/integrations
```

With payload:
```json
{
  "gmail_refresh_token": "1//0gxxxxxxxxxxxxx"
}
```

---

## 🔄 Complete OAuth Flow with Environment Variables

```mermaid
sequenceDiagram
    participant Coach
    participant Frontend<br/>(uses NEXT_PUBLIC_AGENT_API)
    participant AgentService<br/>(uses GMAIL_CLIENT_ID,<br/>GMAIL_CLIENT_SECRET,<br/>GMAIL_REDIRECT_URI)
    participant Google
    participant PythonAPI<br/>(uses PYTHON_API_URL)

    Coach->>Frontend: Clicks "Connect Gmail"
    Frontend->>AgentService: Redirect to NEXT_PUBLIC_AGENT_API/auth/google/connect/:coachId
    AgentService->>Google: Redirect using GMAIL_CLIENT_ID
    Google->>AgentService: Callback to GMAIL_REDIRECT_URI
    AgentService->>PythonAPI: PATCH to PYTHON_API_URL/api/coaches/:id/integrations
    AgentService->>Frontend: Redirect to FRONTEND_URL/settings?status=success
```

---

## ✅ Configuration Checklist

### Agent Service
- [ ] Copy `.env.example` to `.env`
- [ ] Add `GMAIL_CLIENT_ID` from Google Cloud Console
- [ ] Add `GMAIL_CLIENT_SECRET` from Google Cloud Console
- [ ] Set `GMAIL_REDIRECT_URI=http://localhost:3001/auth/google/callback`
- [ ] Set `FRONTEND_URL=http://localhost:3000` (your frontend URL)
- [ ] Set `PYTHON_API_URL=http://localhost:8000` (your Python backend URL)

### Frontend
- [ ] Add `NEXT_PUBLIC_AGENT_API=http://localhost:3001` to `.env.local`

### Python Backend
- [ ] Ensure `PATCH /api/coaches/{coachId}/integrations` endpoint exists
- [ ] Accepts `gmail_refresh_token` in request body
- [ ] No new environment variables needed

---

## 🚀 Production Configuration

### Agent Service Production `.env`

```bash
# Production Google OAuth2 Credentials
GMAIL_CLIENT_ID=production-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=production-client-secret
GMAIL_REDIRECT_URI=https://api.squashdaddy.com/auth/google/callback

# Production URLs
FRONTEND_URL=https://app.squashdaddy.com
PYTHON_API_URL=https://api.squashdaddy.com
```

### Frontend Production `.env.production`

```bash
NEXT_PUBLIC_AGENT_API=https://agent.squashdaddy.com
```

**Important:** Update Google Cloud Console with production redirect URI!

---

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"
**Cause:** `GMAIL_REDIRECT_URI` in `.env` doesn't match Google Cloud Console

**Fix:** Ensure both locations have the exact same URI (including http/https, port, path)

### Error: "GMAIL_CLIENT_ID is undefined"
**Cause:** Environment variables not loaded in agent-service

**Fix:** 
1. Verify `.env` file exists in `agent-service/` directory
2. Restart the agent-service
3. Check that `ConfigModule.forRoot({ isGlobal: true })` is in app.module.ts

### Frontend can't redirect to agent-service
**Cause:** `NEXT_PUBLIC_AGENT_API` not set

**Fix:** Add to frontend `.env.local` and restart frontend dev server

---

## 📝 Summary

| Service | Environment File | Variables Needed |
|---------|-----------------|------------------|
| **Agent Service** | `agent-service/.env` | ✅ `GMAIL_CLIENT_ID`<br/>✅ `GMAIL_CLIENT_SECRET`<br/>✅ `GMAIL_REDIRECT_URI`<br/>✅ `FRONTEND_URL`<br/>✅ `PYTHON_API_URL` |
| **Frontend** | `NickAI/frontend/.env.local` | ✅ `NEXT_PUBLIC_AGENT_API` |
| **Python Backend** | `NickAI/backend/.env` | ❌ No new variables needed |
