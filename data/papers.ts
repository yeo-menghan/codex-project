import { Paper } from "../types/paper";

const AVATAR_BASE_URL =
  "https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars";

const DEFAULT_BRUNETTE_AVATAR = {
  url: `${AVATAR_BASE_URL}/brunette.glb`,
  body: "F" as const,
  voice: "af_bella" as const
};

export const papers: Paper[] = [
  {
    id: "paper1",
    title: "Attention Is All You Need",
    summary: "Introduced the Transformer architecture with pure attention.",
    intro_script:
      "Hello~ I am the Transformer paper. I replaced recurrence with attention and made sequence modeling much more parallel.",
    personality: "confident",
    avatar: DEFAULT_BRUNETTE_AVATAR
  },
  {
    id: "paper2",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    summary: "Bidirectional pretraining for strong language understanding.",
    intro_script:
      "Hi there. I am BERT. I read text in both directions during pretraining so downstream NLP tasks can fine tune with strong contextual representations.",
    personality: "calm",
    avatar: DEFAULT_BRUNETTE_AVATAR
  },
  {
    id: "paper3",
    title: "LoRA: Low-Rank Adaptation of Large Language Models",
    summary: "Efficiently fine tunes large models using low-rank adapters.",
    intro_script:
      "Yo. I am LoRA. I keep the base model frozen and inject trainable low rank matrices, which greatly cuts training cost while preserving quality.",
    personality: "playful",
    avatar: DEFAULT_BRUNETTE_AVATAR
  }
];
