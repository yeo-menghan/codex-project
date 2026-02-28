# Simple Avatar TTS Demo

Minimal browser demo that combines:

- TalkingHead: avatar rendering + lip sync
- HeadTTS: browser ONNX text-to-speech engine
- Kokoro timestamped ONNX model: `onnx-community/Kokoro-82M-v1.0-ONNX-timestamped`

## Run

Serve this folder over HTTP (do not open `index.html` directly from `file://`):

```bash
npx serve .
```

Then open the printed local URL (usually `http://localhost:3000`).

## Usage

1. Wait for status to become `Ready`.
2. Choose an avatar model.
3. Enter a prompt.
4. Click `Respond`.

Each avatar model is tied to an associated Kokoro voice. The app generates a short text reply, synthesizes speech with HeadTTS/Kokoro, and sends audio + timestamps + visemes to TalkingHead so the avatar speaks with lip sync.

Sample avatar files are loaded from `TalkingHead/main/avatars` on GitHub raw URLs, because not all avatar assets are available under the `@1.7` jsDelivr tag.

## Notes

- First run can take a while because model and assets are downloaded.
- Best experience is in a modern Chromium browser.
