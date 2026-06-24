import os
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from faster_whisper import WhisperModel


API_KEY = os.getenv("WHISPER_API_KEY", "")
MODEL_NAME = os.getenv("WHISPER_MODEL", "tiny")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
MAX_UPLOAD_MB = int(os.getenv("WHISPER_MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

app = FastAPI(title="Statie Whisper", version="0.1.0")
model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)


def require_auth(authorization: str | None) -> None:
    if not API_KEY:
        raise HTTPException(status_code=500, detail="WHISPER_API_KEY is not configured")
    if authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/v1/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("id"),
    prompt: str | None = Form(None),
    authorization: str | None = Header(default=None),
) -> dict[str, object]:
    require_auth(authorization)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"Audio file exceeds {MAX_UPLOAD_MB}MB")

    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    started = time.monotonic()
    tmp_path = ""

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        segments, info = model.transcribe(
            tmp_path,
            language=language or None,
            initial_prompt=prompt or None,
            beam_size=1,
            vad_filter=True,
        )
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
        return {
            "text": text,
            "language": info.language,
            "durationMs": round((time.monotonic() - started) * 1000),
        }
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except FileNotFoundError:
                pass
