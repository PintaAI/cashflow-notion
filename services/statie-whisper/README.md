# Statie Whisper Service

Small private transcription service for Statie debate audio. It uses `faster-whisper` with CPU-friendly `int8` inference.

Run on a VPS:

```bash
docker build -t statie-whisper services/statie-whisper
docker run -d --name statie-whisper --restart unless-stopped \
  -p 127.0.0.1:9001:8000 \
  -e WHISPER_API_KEY='change-me' \
  -e WHISPER_MODEL='tiny' \
  -e WHISPER_DEVICE='cpu' \
  -e WHISPER_COMPUTE_TYPE='int8' \
  statie-whisper
```

Configure the Next.js app:

```env
WHISPER_BASE_URL=http://127.0.0.1:9001
WHISPER_API_KEY=change-me
STT_LANGUAGE=id
STT_MAX_UPLOAD_MB=25
```

Model guidance:

- `tiny`: fastest, lowest VPS cost, rougher Indonesian accuracy.
- `base`: better accuracy, still manageable on small CPU VPS.
- `small`: recommended if the VPS has enough CPU/RAM and users can wait longer.

Keep the port bound to `127.0.0.1` or an internal Docker network. Do not expose this service publicly.
