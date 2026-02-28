export type PaperPersonality = "confident" | "playful" | "calm";

export type AvatarEmotion = "neutral" | "happy" | "smug" | "annoyed";

export interface PaperAvatarConfig {
  url: string;
  body: "F" | "M";
  voice: "af_bella" | "af_nicole" | "am_fenrir";
}

export interface Paper {
  id: string;
  title: string;
  summary: string;
  intro_script: string;
  personality: PaperPersonality;
  avatar: PaperAvatarConfig;
}

export interface ChatResponse {
  content: string;
  emotion: AvatarEmotion;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
