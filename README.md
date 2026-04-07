# POLICE_EDUCATION

POLICE_EDUCATION is a full-stack project built with:

- **Python** for the backend
- **Angular** for the frontend

## Folder Structure

- `backend/` - contains the Python server and backend logic
- `frontend/` - contains the Angular client application

## Repository Setup

This repository uses a single GitHub repository for both backend and frontend code.

## Backend AI Endpoint

Authenticated API endpoint:

- `POST /api/ai/ask`

Request JSON:

```json
{
  "prompt": "Your question..."
}
```

Response JSON:

```json
{
  "answer": "Model answer text"
}
```

Environment variables (`backend/.env`):

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, default `gpt-5.4`)
- `OPENAI_TIMEOUT_SECONDS` (optional, default `30`)
- `OPENAI_API_URL` (optional, default `https://api.openai.com/v1/responses`)
