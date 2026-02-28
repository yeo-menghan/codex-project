import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { HeadTTS } from "@met4citizen/headtts";
import type { TalkingHead } from "@met4citizen/talkinghead";
import type { AvatarEmotion, PaperAvatarConfig } from "../types/paper";

export interface AvatarController {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  setEmotion: (emotion: AvatarEmotion) => void;
}

interface UseAvatarControllerOptions {
  avatar: PaperAvatarConfig;
}

interface UseAvatarControllerResult extends AvatarController {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  status: string;
  ready: boolean;
}

const EMOTION_TO_MOOD: Record<AvatarEmotion, string> = {
  neutral: "neutral",
  happy: "happy",
  smug: "happy",
  annoyed: "angry"
};

const HEAD_OPTIONS = {
  cameraView: "upper",
  cameraRotateEnable: true,
  cameraRotateSpeed: 2,
  // Next.js bundling breaks TalkingHead's relative dynamic import for lipsync modules.
  // Kokoro timestamped output includes visemes, so explicit lipsync modules are not needed.
  lipsyncModules: [],
  ttsEndpoint: null
};

const TTS_OPTIONS = {
  model: "onnx-community/Kokoro-82M-v1.0-ONNX-timestamped",
  endpoints: ["webgpu", "wasm"],
  languages: ["en-us"],
  voices: ["af_bella", "af_nicole", "am_fenrir"],
  workerModule:
    "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.1.0/modules/worker-tts.mjs",
  dictionaryURL:
    "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.1.0/dictionaries"
};

function callHeadMethod(head: TalkingHead | null, method: string) {
  if (!head) {
    return;
  }
  try {
    const fn = (head as Record<string, unknown>)[method];
    if (typeof fn === "function") {
      (fn as () => void).call(head);
    }
  } catch {
    // Best-effort stop/mood calls for library-version differences.
  }
}

export function useAvatarController({
  avatar
}: UseAvatarControllerOptions): UseAvatarControllerResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<TalkingHead | null>(null);
  const ttsRef = useRef<HeadTTS | null>(null);
  const disposedRef = useRef(false);
  const speakEpochRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading avatar...");

  const stop = useCallback(() => {
    speakEpochRef.current += 1;

    const head = headRef.current;
    callHeadMethod(head, "stopSpeaking");
    callHeadMethod(head, "stopAudio");
    callHeadMethod(head, "interrupt");
  }, []);

  const setEmotion = useCallback((emotion: AvatarEmotion) => {
    const head = headRef.current;
    if (!head) {
      return;
    }

    const mood = EMOTION_TO_MOOD[emotion] ?? "neutral";
    try {
      const maybeSetMood = (head as Record<string, unknown>).setMood;
      if (typeof maybeSetMood === "function") {
        (maybeSetMood as (nextMood: string) => void).call(head, mood);
      }
    } catch {
      // Mood support depends on TalkingHead version.
    }
  }, []);

  const synthesize = useCallback(
    async (text: string) => {
      const tts = ttsRef.current;
      if (!tts) {
        throw new Error("TTS is not ready");
      }

      await tts.setup({
        voice: avatar.voice,
        language: "en-us",
        speed: 1,
        audioEncoding: "wav"
      });

      const messages = await tts.synthesize({ input: text });
      const audioMessages = messages
        .filter((message) => message.type === "audio")
        .sort(
          (a, b) =>
            ((a as { metaData?: { part?: number } }).metaData?.part ?? 0) -
            ((b as { metaData?: { part?: number } }).metaData?.part ?? 0)
        );

      if (audioMessages.length === 0) {
        const errorMessage = messages.find((message) => message.type === "error");
        throw new Error(errorMessage?.data?.error ?? "No audio returned by HeadTTS");
      }

      return audioMessages.map((message) => message.data);
    },
    [avatar.voice]
  );

  const speak = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const head = headRef.current;
      if (!head || !ttsRef.current) {
        return;
      }

      stop();
      const epoch = speakEpochRef.current;

      const audioParts = await synthesize(trimmed);
      if (epoch !== speakEpochRef.current) {
        return;
      }

      for (const audioData of audioParts) {
        if (epoch !== speakEpochRef.current) {
          return;
        }
        await head.speakAudio(audioData, { lipsyncLang: "en" });
      }
    },
    [stop, synthesize]
  );

  useEffect(() => {
    let cancelled = false;
    disposedRef.current = false;

    const init = async () => {
      if (!containerRef.current) {
        return;
      }

      setReady(false);
      setStatus("Loading avatar...");

      try {
        const [{ TalkingHead }, { HeadTTS }] = await Promise.all([
          import("@met4citizen/talkinghead"),
          import("@met4citizen/headtts")
        ]);

        if (cancelled || disposedRef.current || !containerRef.current) {
          return;
        }

        const head = new TalkingHead(containerRef.current, HEAD_OPTIONS);
        const tts = new HeadTTS(TTS_OPTIONS);

        headRef.current = head;
        ttsRef.current = tts;

        await head.showAvatar({
          url: avatar.url,
          body: avatar.body,
          avatarMood: "neutral",
          lipsyncLang: "en"
        });
        head.start();

        setStatus("Loading TTS...");
        await tts.connect();
        await tts.setup({
          voice: avatar.voice,
          language: "en-us",
          speed: 1,
          audioEncoding: "wav"
        });

        if (cancelled || disposedRef.current) {
          return;
        }

        setReady(true);
        setStatus("Ready");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Avatar engine failed to initialize";
        setStatus(`Error: ${message}`);
      }
    };

    init();

    return () => {
      cancelled = true;
      disposedRef.current = true;
      stop();
      headRef.current = null;
      ttsRef.current = null;
      setReady(false);
    };
  }, [avatar.body, avatar.url, avatar.voice, stop]);

  return {
    containerRef,
    status,
    ready,
    speak,
    stop,
    setEmotion
  };
}
