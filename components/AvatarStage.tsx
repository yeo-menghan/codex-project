import { forwardRef, useEffect, useImperativeHandle } from "react";
import { useAvatarController, type AvatarController } from "../hooks/useAvatarController";
import type { PaperAvatarConfig } from "../types/paper";

export interface AvatarStageHandle extends AvatarController {}

interface AvatarStageProps {
  avatar: PaperAvatarConfig;
  onReadyChange?: (ready: boolean) => void;
}

const AvatarStage = forwardRef<AvatarStageHandle, AvatarStageProps>(function AvatarStage(
  { avatar, onReadyChange },
  ref
) {
  const controller = useAvatarController({ avatar });

  useEffect(() => {
    onReadyChange?.(controller.ready);
  }, [controller.ready, onReadyChange]);

  useImperativeHandle(
    ref,
    () => ({
      speak: controller.speak,
      stop: controller.stop,
      setEmotion: controller.setEmotion
    }),
    [controller.setEmotion, controller.speak, controller.stop]
  );

  return (
    <div className="avatarStage">
      <div ref={controller.containerRef} className="avatarViewport" />
      <div className={`avatarStatus ${controller.ready ? "ready" : "loading"}`}>
        {controller.status}
      </div>
    </div>
  );
});

export default AvatarStage;
