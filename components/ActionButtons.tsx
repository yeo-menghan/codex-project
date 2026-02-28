interface ActionButtonsProps {
  liked: boolean;
  onToggleLike: () => void;
  onShare: () => void;
  onChat: () => void;
}

export default function ActionButtons({
  liked,
  onToggleLike,
  onShare,
  onChat
}: ActionButtonsProps) {
  return (
    <div className="actionButtons">
      <button type="button" className={`actionBtn ${liked ? "liked" : ""}`} onClick={onToggleLike}>
        <span className="icon" aria-hidden="true">
          ❤
        </span>
        <span className="label">Like</span>
      </button>

      <button type="button" className="actionBtn" onClick={onShare}>
        <span className="icon" aria-hidden="true">
          ↗
        </span>
        <span className="label">Share</span>
      </button>

      <button type="button" className="actionBtn" onClick={onChat}>
        <span className="icon" aria-hidden="true">
          💬
        </span>
        <span className="label">Chat</span>
      </button>
    </div>
  );
}
