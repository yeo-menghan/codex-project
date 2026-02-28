import { useCallback, useMemo, useState } from "react";
import type { AvatarEmotion, ChatMessage, ChatResponse } from "../types/paper";

interface UseChatOptions {
  paperId: string;
  onAssistantResponse?: (payload: ChatResponse) => Promise<void> | void;
}

interface UseChatResult {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

function normalizeEmotion(emotion?: string): AvatarEmotion {
  if (emotion === "happy" || emotion === "smug" || emotion === "annoyed") {
    return emotion;
  }
  return "neutral";
}

export function useChat({
  paperId,
  onAssistantResponse
}: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || loading) {
        return;
      }

      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setLoading(true);

      try {
        const response = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            paper_id: paperId,
            message: trimmed
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Chat request failed (${response.status})`);
        }

        const payload = (await response.json()) as ChatResponse;
        const normalizedPayload: ChatResponse = {
          content: payload.content,
          emotion: normalizeEmotion(payload.emotion)
        };

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: normalizedPayload.content
          }
        ]);

        await onAssistantResponse?.(normalizedPayload);
      } catch (sendError) {
        const message =
          sendError instanceof Error ? sendError.message : "Unable to send message";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [loading, onAssistantResponse, paperId]
  );

  return useMemo(
    () => ({
      messages,
      loading,
      error,
      sendMessage
    }),
    [error, loading, messages, sendMessage]
  );
}
