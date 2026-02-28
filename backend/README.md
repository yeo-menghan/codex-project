# PaperWaifu Backend (FastAPI)

## Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Important: run both `pip install` and `uvicorn` from the same active environment.
If PDF upload still fails, call `GET /health` and check `pdf_parser` plus the interpreter path in the error detail.

## Required env vars

- `OPENAI_API_KEY`

## Optional env vars

- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `CORS_ORIGINS` (comma-separated list)

## API

### `GET /papers`

Returns all current paper profiles.

### `POST /papers/upload`

`multipart/form-data` fields:

- `file` (required): `.pdf`, `.txt`, or `.md`
- `personality` (optional): `confident`, `calm`, or `playful`

This endpoint extracts text, asks OpenAI to generate a concise profile, stores it in memory, and returns the created paper profile.

### `POST /chat`

Request:

```json
{
  "paper_id": "paper1",
  "message": "What is your main contribution?"
}
```

Response:

```json
{
  "content": "My main contribution is replacing recurrence with attention...",
  "emotion": "smug"
}
```
