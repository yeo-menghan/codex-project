import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AvatarStage, { type AvatarStageHandle } from "./AvatarStage";
import ActionButtons from "./ActionButtons";
import ChatDrawer from "./ChatDrawer";
import { useChat } from "../hooks/useChat";
import type { AvatarEmotion, ChatResponse, Paper } from "../types/paper";

interface PaperSlideProps {
  paper: Paper;
  isActive: boolean;
}

function introEmotion(personality: Paper["personality"]): AvatarEmotion {
  if (personality === "confident") {
    return "smug";
  }
  if (personality === "playful") {
    return "happy";
  }
  return "neutral";
}

export default function PaperSlide({ paper, isActive }: PaperSlideProps) {
  const avatarRef = useRef<AvatarStageHandle | null>(null);
  const introSpokenForPaperRef = useRef<string | null>(null);
  const [avatarReady, setAvatarReady] = useState(false);
  const [liked, setLiked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const handleAssistantResponse = useCallback(
    async (payload: ChatResponse) => {
      if (!isActive || !avatarRef.current) {
        return;
      }
      avatarRef.current.setEmotion(payload.emotion);
      await avatarRef.current.speak(payload.content);
    },
    [isActive]
  );

  const chat = useChat({
    paperId: paper.id,
    onAssistantResponse: handleAssistantResponse
  });

  useEffect(() => {
    if (!isActive) {
      avatarRef.current?.stop();
      setChatOpen(false);
      introSpokenForPaperRef.current = null;
      return;
    }

    if (!avatarReady) {
      return;
    }

    if (introSpokenForPaperRef.current === paper.id) {
      return;
    }

    const speakIntro = async () => {
      if (!avatarRef.current) {
        return;
      }
      introSpokenForPaperRef.current = paper.id;
      avatarRef.current.setEmotion(introEmotion(paper.personality));
      try {
        await avatarRef.current.speak(paper.intro_script);
      } catch {
        // Ignore transient init races; next activation/chat will retry speech.
        introSpokenForPaperRef.current = null;
      }
    };

    void speakIntro();
  }, [avatarReady, isActive, paper.id, paper.intro_script, paper.personality]);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const shareURL = `${window.location.origin}${window.location.pathname}?paper=${paper.id}`;

    try {
      await navigator.clipboard.writeText(shareURL);
      setShareNotice("Link copied");
    } catch {
      setShareNotice("Copy failed");
    }

    window.setTimeout(() => setShareNotice(null), 1400);
  }, [paper.id]);

  const headline = useMemo(() => paper.summary, [paper.summary]);

  return (
    <article className="paperSlide">
      <AvatarStage ref={avatarRef} avatar={paper.avatar} onReadyChange={setAvatarReady} />

      <div className="paperOverlay">
        <p className="paperKicker">PaperWaifu Carousel</p>
        <h2>{paper.title}</h2>
        <p>{headline}</p>
      </div>

      <ActionButtons
        liked={liked}
        onToggleLike={() => setLiked((prev) => !prev)}
        onShare={handleShare}
        onChat={() => setChatOpen(true)}
      />

      {shareNotice ? <div className="shareNotice">{shareNotice}</div> : null}

      <ChatDrawer
        open={chatOpen}
        title={paper.title}
        messages={chat.messages}
        loading={chat.loading}
        error={chat.error}
        onClose={() => setChatOpen(false)}
        onSend={chat.sendMessage}
      />
    </article>
  );
}
