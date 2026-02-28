import { FormEvent, useState } from "react";
import type { ChatMessage } from "../types/paper";

interface ChatDrawerProps {
  open: boolean;
  title: string;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}

export default function ChatDrawer({
  open,
  title,
  messages,
  loading,
  error,
  onClose,
  onSend
}: ChatDrawerProps) {
  const [input, setInput] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = input.trim();
    if (!next || loading) {
      return;
    }
    setInput("");
    await onSend(next);
  };

  return (
    <>
      <div className={`drawerBackdrop ${open ? "open" : ""}`} onClick={onClose} />
      <section className={`chatDrawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <header className="chatHeader">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} className="closeBtn" aria-label="Close chat">
            Close
          </button>
        </header>

        <div className="chatMessages">
          {messages.length === 0 ? (
            <p className="chatPlaceholder">Ask this waifu paper about methods, contributions, or trade-offs.</p>
          ) : null}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
              {message.content}
            </div>
          ))}
          {loading ? <div className="bubble assistant">Thinking...</div> : null}
        </div>

        <form className="chatComposer" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this paper"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>

        {error ? <p className="chatError">{error}</p> : null}
      </section>
    </>
  );
}
