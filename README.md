# PaperWaifu Carousel

TikTok-style vertical research paper browser with animated waifu avatars.

## Features (MVP)

- Full-screen vertical paper carousel (`swiper` vertical mode)
- One animated avatar per paper slide (`TalkingHead`)
- Intro speech auto-plays when slide becomes active (`HeadTTS` + Kokoro ONNX)
- Floating right-side actions: Like, Share, Chat
- Upload sub-panel to add new papers (`.pdf`, `.txt`, `.md`)
- Backend-generated profile from uploaded paper (title, brief summary, intro script, personality)
- Bottom chat drawer per paper
- Chat requests sent to FastAPI backend, backend calls OpenAI, returns `content` + `emotion`
- Avatar speaks backend responses with lip sync

## Project structure

- `pages/index.tsx`: app entry
- `components/`: carousel, slide, avatar stage, action buttons, chat drawer
- `hooks/useAvatarController.ts`: avatar/TTS orchestration
- `hooks/useChat.ts`: frontend chat API client
- `data/papers.ts`: hardcoded paper list (MVP)
- `backend/main.py`: FastAPI backend with `/papers`, `/papers/upload`, `/chat`

## Frontend setup

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# set OPENAI_API_KEY in your shell or .env loader
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs on `http://127.0.0.1:8000`.

## Environment variables

Copy `.env.example` and configure:

- `NEXT_PUBLIC_API_BASE_URL` (frontend -> backend URL)
- `OPENAI_API_KEY` (backend)
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
- `CORS_ORIGINS` (optional)

## Troubleshooting

- If you see `Cannot find module './lipsync-en.mjs'` in Next.js, keep `lipsyncModules: []` (already set in `useAvatarController`) and use timestamped Kokoro output, which includes viseme timing data.

## API

`GET /papers`

Returns all current paper profiles used by the carousel.

`POST /papers/upload` (`multipart/form-data`)

Fields:

- `file`: paper file (`.pdf`, `.txt`, `.md`)
- `personality` (optional): `confident | calm | playful`

Response:

```json
{
  "id": "new-paper-id",
  "title": "Paper title",
  "summary": "Brief generated summary",
  "intro_script": "Short spoken intro",
  "personality": "calm",
  "avatar": {
    "url": "https://.../brunette.glb",
    "body": "F",
    "voice": "af_bella"
  }
}
```

`POST /chat`

```json
{
  "paper_id": "paper1",
  "message": "What is your main contribution?"
}
```

```json
{
  "content": "My main contribution is ...",
  "emotion": "smug"
}
```
