import { FormEvent, useState } from "react";
import { useDebugwiseStore } from "../../store/debugwise-store";

interface AssistantPanelProps {
  onAsk: (prompt: string) => Promise<void>;
}

export function AssistantPanel({ onAsk }: AssistantPanelProps) {
  const [prompt, setPrompt] = useState("");
  const chat = useDebugwiseStore((state) => state.chat);
  const isExecuting = useDebugwiseStore((state) => state.isExecuting);
  const assistantError = useDebugwiseStore((state) => state.assistantError);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }
    await onAsk(prompt);
    setPrompt("");
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Offline assistant</p>
          <h2>Debug mentor</h2>
        </div>
      </div>
      <div className="chat-log">
        {chat.map((message, index) => (
          <article className={`chat-bubble ${message.role}`} key={`${message.role}-${index}`}>
            <span>{message.role === "assistant" ? "DebugWise" : "You"}</span>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      {assistantError ? <article className="alert-banner error">{assistantError}</article> : null}
      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Why is this failing, and what fix would you trust in production?"
        />
        <button type="submit" disabled={isExecuting}>
          {isExecuting ? "Working..." : "Ask assistant"}
        </button>
      </form>
    </section>
  );
}
