import { TalkingHead } from "talkinghead";
import { HeadTTS } from "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.1.0/+esm";

const avatarNode = document.getElementById("avatar");
const promptInput = document.getElementById("prompt");
const avatarModelSelect = document.getElementById("avatarModel");
const voiceHintEl = document.getElementById("voiceHint");
const respondBtn = document.getElementById("respondBtn");
const statusEl = document.getElementById("status");
const responseEl = document.getElementById("response");

const AVATAR_BASE_URL =
  "https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars";

const AVATAR_PRESETS = {
  brunette: {
    label: "Brunette (TalkingHead)",
    url: `${AVATAR_BASE_URL}/brunette.glb`,
    body: "F",
    voice: "af_bella"
  },
  avaturn: {
    label: "Avaturn",
    // In TalkingHead repo this sample is named avatar.glb
    url: `${AVATAR_BASE_URL}/avatar.glb`,
    body: "F",
    voice: "af_nicole"
  },
  avatarsdk: {
    label: "AvatarSDK",
    url: `${AVATAR_BASE_URL}/avatarsdk.glb`,
    body: "M",
    voice: "am_fenrir"
  },
  mpfb: {
    label: "MPFB",
    url: `${AVATAR_BASE_URL}/mpfb.glb`,
    body: "M",
    voice: "am_fenrir"
  }
};

const head = new TalkingHead(avatarNode, {
  cameraView: "upper",
  cameraRotateEnable: true,
  cameraRotateSpeed: 2,
  lipsyncModules: ["en"],
  ttsEndpoint: null
});

const headtts = new HeadTTS({
  model: "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped",
  endpoints: ["webgpu", "wasm"],
  languages: ["en-us"],
  voices: ["af_bella", "am_fenrir", "af_nicole"],
  workerModule:
    "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.1.0/modules/worker-tts.mjs",
  dictionaryURL:
    "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.1.0/dictionaries"
});

function setStatus(text) {
  statusEl.textContent = text;
}

function getSelectedPreset() {
  return AVATAR_PRESETS[avatarModelSelect.value] || AVATAR_PRESETS.brunette;
}

function updateVoiceHint() {
  const preset = getSelectedPreset();
  voiceHintEl.textContent = `Voice: ${preset.voice}`;
}

function buildResponse(prompt) {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return "Please give me a prompt and I will respond.";
  }
  if (/hello|hi|hey/i.test(trimmed)) {
    return "Hello. I am a browser avatar with local neural text-to-speech.";
  }
  if (/name/i.test(trimmed)) {
    return "You can call me Kokoro Head. I speak using ONNX in your browser.";
  }
  return `I heard your prompt: ${trimmed}. This is a short generated reply from the demo app.`;
}

async function synthesize(text, voice) {
  await headtts.setup({
    voice,
    language: "en-us",
    speed: 1,
    audioEncoding: "wav"
  });

  const messages = await headtts.synthesize({ input: text });
  const audioMessage = messages.find((message) => message.type === "audio");
  if (!audioMessage) {
    const errorMessage = messages.find((message) => message.type === "error");
    throw new Error(errorMessage?.data?.error || "No audio returned by HeadTTS");
  }
  return audioMessage.data;
}

async function init() {
  const preset = getSelectedPreset();
  let activePreset = preset;
  updateVoiceHint();

  setStatus(`Loading avatar: ${preset.label}...`);
  try {
    await head.showAvatar({
      url: preset.url,
      body: preset.body,
      avatarMood: "neutral",
      lipsyncLang: "en"
    });
  } catch (error) {
    console.warn("Avatar load failed, falling back to brunette.", error);
    avatarModelSelect.value = "brunette";
    updateVoiceHint();
    const fallback = AVATAR_PRESETS.brunette;
    activePreset = fallback;
    await head.showAvatar({
      url: fallback.url,
      body: fallback.body,
      avatarMood: "neutral",
      lipsyncLang: "en"
    });
    setStatus("Selected avatar failed to load. Fell back to Brunette.");
  }
  head.start();

  setStatus("Connecting TTS backend and loading model (first run can take time)...");
  await headtts.connect();
  await headtts.setup({
    voice: activePreset.voice,
    language: "en-us",
    speed: 1,
    audioEncoding: "wav"
  });
  setStatus("Ready");
}

avatarModelSelect.addEventListener("change", async () => {
  const preset = getSelectedPreset();
  updateVoiceHint();
  respondBtn.disabled = true;
  avatarModelSelect.disabled = true;

  try {
    setStatus(`Switching avatar: ${preset.label}...`);
    await head.showAvatar({
      url: preset.url,
      body: preset.body,
      avatarMood: "neutral",
      lipsyncLang: "en"
    });
    await headtts.setup({
      voice: preset.voice,
      language: "en-us",
      speed: 1,
      audioEncoding: "wav"
    });
    setStatus("Ready");
  } catch (error) {
    console.error(error);
    avatarModelSelect.value = "brunette";
    updateVoiceHint();
    const fallback = AVATAR_PRESETS.brunette;
    try {
      await head.showAvatar({
        url: fallback.url,
        body: fallback.body,
        avatarMood: "neutral",
        lipsyncLang: "en"
      });
      await headtts.setup({
        voice: fallback.voice,
        language: "en-us",
        speed: 1,
        audioEncoding: "wav"
      });
      setStatus(
        `Avatar switch failed (${error.message || error}). Fell back to Brunette.`
      );
    } catch (fallbackError) {
      console.error(fallbackError);
      setStatus(`Avatar switch failed: ${error.message || error}`);
    }
  } finally {
    respondBtn.disabled = false;
    avatarModelSelect.disabled = false;
  }
});

respondBtn.addEventListener("click", async () => {
  const preset = getSelectedPreset();
  const prompt = promptInput.value;
  const reply = buildResponse(prompt);

  responseEl.textContent = `Avatar response: ${reply}`;
  respondBtn.disabled = true;
  avatarModelSelect.disabled = true;
  setStatus("Synthesizing speech...");

  try {
    const ttsOutput = await synthesize(reply, preset.voice);

    setStatus("Speaking...");
    await head.speakAudio(ttsOutput, { lipsyncLang: "en" });
    setStatus("Ready");
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message || error}`);
  } finally {
    respondBtn.disabled = false;
    avatarModelSelect.disabled = false;
  }
});

init().catch((error) => {
  console.error(error);
  setStatus(`Initialization failed: ${error.message || error}`);
});
