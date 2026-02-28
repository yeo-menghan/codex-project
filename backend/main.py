import io
import json
import os
import re
import sys
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

PDF_READER_SOURCE = None
try:
    from pypdf import PdfReader

    PDF_READER_SOURCE = "pypdf"
except ImportError:  # pragma: no cover
    try:
        from PyPDF2 import PdfReader  # type: ignore[no-redef]

        PDF_READER_SOURCE = "PyPDF2"
    except ImportError:  # pragma: no cover
        PdfReader = None  # type: ignore[assignment]


PaperPersonality = Literal["confident", "playful", "calm"]
Emotion = Literal["neutral", "happy", "smug", "annoyed"]

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_SOURCE_CHARS = 24000

AVATAR_BASE_URL = "https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars"
DEFAULT_AVATAR = {
    "url": f"{AVATAR_BASE_URL}/brunette.glb",
    "body": "F",
    "voice": "af_bella",
}

PAPERS = {
    "paper1": {
        "title": "Attention Is All You Need",
        "summary": "Introduced the Transformer architecture with pure attention.",
        "intro_script": "I am the Transformer paper. I replaced recurrence with attention to improve parallel sequence modeling.",
        "key_points": [
            "Removed recurrence and convolution from sequence transduction core.",
            "Used multi-head self-attention and positional encoding.",
            "Enabled higher parallelism and strong translation quality.",
        ],
        "personality": "confident",
    },
    "paper2": {
        "title": "BERT: Pre-training of Deep Bidirectional Transformers",
        "summary": "Bidirectional masked-language pretraining for language understanding.",
        "intro_script": "I am BERT. I pretrain bidirectional representations and then fine tune efficiently for downstream tasks.",
        "key_points": [
            "Trained with masked language modeling and next sentence prediction.",
            "Bidirectional context improved many NLP benchmarks.",
            "Simple fine-tuning for task-specific heads became practical.",
        ],
        "personality": "calm",
    },
    "paper3": {
        "title": "LoRA: Low-Rank Adaptation of Large Language Models",
        "summary": "Efficient adaptation by injecting trainable low-rank matrices.",
        "intro_script": "I am LoRA. I keep base weights frozen and train small low-rank adapters for efficient tuning.",
        "key_points": [
            "Freezes base model weights and trains compact adapters.",
            "Cuts trainable parameters and memory footprint significantly.",
            "Maintains competitive downstream task quality.",
        ],
        "personality": "playful",
    },
}


class AvatarConfig(BaseModel):
    url: str
    body: Literal["F", "M"]
    voice: Literal["af_bella", "af_nicole", "am_fenrir"]


class PaperProfile(BaseModel):
    id: str
    title: str
    summary: str
    intro_script: str
    personality: PaperPersonality
    avatar: AvatarConfig


class ChatRequest(BaseModel):
    paper_id: str
    message: str = Field(min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    content: str
    emotion: Emotion


def _extract_text_from_chat_response(response: object) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return ""

    first_choice = choices[0]
    message = getattr(first_choice, "message", None)
    if message is None:
        return ""

    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                text = block.get("text")
                if text:
                    parts.append(str(text))
            else:
                text = getattr(block, "text", "")
                if text:
                    parts.append(str(text))
        return "\n".join(parts).strip()
    return str(content or "").strip()


def request_openai_text(
    client: OpenAI,
    model: str,
    system_prompt: str,
    user_message: str,
    *,
    temperature: float = 0.7,
    max_tokens: int = 320,
) -> str:
    responses_api = getattr(client, "responses", None)
    if responses_api is not None and hasattr(responses_api, "create"):
        response = responses_api.create(
            model=model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        return str(getattr(response, "output_text", "") or "").strip()

    chat_api = getattr(client, "chat", None)
    completions_api = getattr(chat_api, "completions", None) if chat_api else None
    if completions_api is not None and hasattr(completions_api, "create"):
        response = completions_api.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return _extract_text_from_chat_response(response)

    raise RuntimeError(
        "OpenAI client has neither responses.create nor chat.completions.create."
    )


def load_environment() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return

    if load_dotenv is not None:
        load_dotenv(dotenv_path=env_path, override=False)
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def detect_openai_key_format_issue() -> bool:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return False
    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("OPENAI_API_KEY") and "=" not in stripped:
            return True
    return False


def ensure_openai_client() -> tuple[OpenAI, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        hint = (
            " Expected format in backend/.env: OPENAI_API_KEY=your_key_here."
            if detect_openai_key_format_issue()
            else ""
        )
        raise HTTPException(
            status_code=500,
            detail=f"OPENAI_API_KEY is not configured on the backend.{hint}",
        )

    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    return OpenAI(api_key=api_key), model


def coerce_personality(value: str | None) -> PaperPersonality:
    if value in {"confident", "playful", "calm"}:
        return value
    return "calm"


def build_system_prompt(paper: dict) -> str:
    key_points = "\n".join(f"- {point}" for point in paper["key_points"])
    return (
        "You are a research paper embodied as an anime-style persona.\n"
        "Rules:\n"
        "1) Stay grounded to the provided summary and key points only.\n"
        "2) Do not hallucinate experimental details or claims.\n"
        "3) Keep tone consistent with personality.\n"
        "4) Keep the answer under 200 words.\n"
        "5) Return strict JSON with keys: content, emotion.\n"
        "emotion must be one of: neutral, happy, smug, annoyed.\n\n"
        f"Title: {paper['title']}\n"
        f"Personality: {paper['personality']}\n"
        f"Summary: {paper['summary']}\n"
        f"Key points:\n{key_points}"
    )


def infer_emotion(content: str, personality: str) -> Emotion:
    lowered = content.lower()
    defensive_markers = (
        "cannot",
        "can't",
        "outside",
        "not provided",
        "unclear",
        "not in",
        "insufficient",
    )
    if any(marker in lowered for marker in defensive_markers):
        return "annoyed"
    if personality == "confident":
        return "smug"
    if personality == "playful":
        return "happy"
    return "neutral"


def parse_llm_output(raw_text: str, personality: str) -> ChatResponse:
    candidate = raw_text.strip()

    parsed = None
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        json_match = re.search(r"\{.*\}", candidate, flags=re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group(0))
            except json.JSONDecodeError:
                parsed = None

    if isinstance(parsed, dict):
        content = str(parsed.get("content", "")).strip()
        emotion = str(parsed.get("emotion", "")).strip().lower()
    else:
        content = candidate
        emotion = ""

    if not content:
        content = "I cannot answer confidently from my provided summary."

    if emotion not in {"neutral", "happy", "smug", "annoyed"}:
        emotion = infer_emotion(content, personality)

    return ChatResponse(content=content, emotion=emotion)  # type: ignore[arg-type]


def parse_json_object(text: str) -> dict | None:
    candidate = text.strip()
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", candidate, flags=re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def first_nonempty_line(text: str, fallback: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped[:160]
    return fallback


def fallback_paper_profile(source_text: str, filename: str, personality: str | None) -> dict:
    title_fallback = first_nonempty_line(source_text, Path(filename).stem or "Uploaded Paper")
    summary = " ".join(source_text.strip().split())[:220]
    if not summary:
        summary = "Uploaded research paper summary is unavailable from extracted text."
    intro = f"I am {title_fallback}. {summary}"
    return {
        "title": title_fallback,
        "summary": summary,
        "intro_script": intro[:260],
        "key_points": [summary[:120]],
        "personality": coerce_personality(personality),
    }


def build_profile_from_source(
    *,
    client: OpenAI,
    model: str,
    source_text: str,
    filename: str,
    personality: str | None,
) -> dict:
    system_prompt = (
        "You generate concise paper profiles from extracted paper text.\n"
        "Return strict JSON with exactly these keys:\n"
        "title (string), summary (string), intro_script (string), key_points (array of 3 strings), personality (confident|playful|calm).\n"
        "Rules:\n"
        "- Ground all claims in provided text only.\n"
        "- summary: max 35 words.\n"
        "- intro_script: max 45 words, 1-2 sentences, conversational.\n"
        "- key_points: exactly 3 short bullets.\n"
        "- If unsure, stay conservative."
    )

    user_prompt = (
        f"Filename: {filename}\n"
        f"Preferred personality: {personality or 'auto'}\n"
        "Extracted paper text:\n"
        f"{source_text[:MAX_SOURCE_CHARS]}"
    )

    raw = request_openai_text(
        client,
        model,
        system_prompt,
        user_prompt,
        temperature=0.3,
        max_tokens=500,
    )
    parsed = parse_json_object(raw)
    if not parsed:
        return fallback_paper_profile(source_text, filename, personality)

    title = str(parsed.get("title", "")).strip() or first_nonempty_line(
        source_text, Path(filename).stem or "Uploaded Paper"
    )
    summary = str(parsed.get("summary", "")).strip()
    intro_script = str(parsed.get("intro_script", "")).strip()

    key_points_raw = parsed.get("key_points", [])
    key_points = [str(x).strip() for x in key_points_raw if str(x).strip()]
    if not key_points:
        key_points = [summary or "Key point unavailable"]
    if len(key_points) < 3:
        key_points.extend([key_points[-1]] * (3 - len(key_points)))
    key_points = key_points[:3]

    if not summary:
        summary = " ".join(source_text.strip().split())[:220]
    if not intro_script:
        intro_script = f"I am {title}. {summary}"[:260]

    return {
        "title": title[:180],
        "summary": summary[:240],
        "intro_script": intro_script[:260],
        "key_points": key_points,
        "personality": coerce_personality(str(parsed.get("personality", personality))),
    }


def extract_upload_text(file: UploadFile, payload: bytes) -> str:
    filename = (file.filename or "uploaded-paper").lower()
    is_pdf = file.content_type == "application/pdf" or filename.endswith(".pdf")

    if is_pdf:
        if PdfReader is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    "PDF upload parser is not installed in the running backend interpreter. "
                    f"python={sys.executable}. "
                    f"Install with: {sys.executable} -m pip install pypdf PyPDF2 "
                    "and restart uvicorn."
                ),
            )

        try:
            reader = PdfReader(io.BytesIO(payload))
            pages = []
            for page in reader.pages[:15]:
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(text.strip())
            extracted = "\n".join(pages)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=400, detail=f"Could not parse PDF: {exc}") from exc

        if not extracted.strip():
            raise HTTPException(
                status_code=400,
                detail="PDF has no extractable text. Try a text-based PDF.",
            )
        return extracted

    try:
        extracted = payload.decode("utf-8")
    except UnicodeDecodeError:
        extracted = payload.decode("latin-1", errors="ignore")

    if not extracted.strip():
        raise HTTPException(status_code=400, detail="Uploaded file has no readable text.")
    return extracted


def make_paper_id(title: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if not base:
        base = "paper"

    candidate = base
    suffix = 1
    while candidate in PAPERS:
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate


def paper_to_profile(paper_id: str, paper: dict) -> PaperProfile:
    personality = coerce_personality(paper.get("personality"))
    intro_script = str(paper.get("intro_script") or f"I am {paper['title']}. {paper['summary']}")
    return PaperProfile(
        id=paper_id,
        title=str(paper["title"]),
        summary=str(paper["summary"]),
        intro_script=intro_script,
        personality=personality,
        avatar=AvatarConfig(**DEFAULT_AVATAR),
    )


def create_app() -> FastAPI:
    load_environment()
    app = FastAPI(title="PaperWaifu Backend", version="0.2.0")

    cors_origins = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "pdf_parser": PDF_READER_SOURCE or "none"}

    @app.get("/papers", response_model=list[PaperProfile])
    def list_papers() -> list[PaperProfile]:
        return [paper_to_profile(paper_id, paper) for paper_id, paper in PAPERS.items()]

    @app.post("/papers/upload", response_model=PaperProfile)
    async def upload_paper(
        file: UploadFile = File(...),
        personality: str | None = Form(default=None),
    ) -> PaperProfile:
        payload = await file.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        if len(payload) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
            )

        source_text = extract_upload_text(file, payload)
        client, model = ensure_openai_client()

        try:
            profile = build_profile_from_source(
                client=client,
                model=model,
                source_text=source_text,
                filename=file.filename or "uploaded-paper",
                personality=personality,
            )
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover
            raise HTTPException(
                status_code=502,
                detail=f"OpenAI summarization failed: {exc}",
            ) from exc

        paper_id = make_paper_id(profile["title"])
        PAPERS[paper_id] = {
            "title": profile["title"],
            "summary": profile["summary"],
            "intro_script": profile["intro_script"],
            "key_points": profile["key_points"],
            "personality": profile["personality"],
        }

        return paper_to_profile(paper_id, PAPERS[paper_id])

    @app.post("/chat", response_model=ChatResponse)
    def chat(payload: ChatRequest) -> ChatResponse:
        paper = PAPERS.get(payload.paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Unknown paper_id")

        client, model = ensure_openai_client()

        try:
            output_text = request_openai_text(
                client=client,
                model=model,
                system_prompt=build_system_prompt(paper),
                user_message=f"User question: {payload.message}",
            )
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}") from exc

        return parse_llm_output(output_text, paper["personality"])

    return app


app = create_app()
