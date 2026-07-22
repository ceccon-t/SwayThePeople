import { useEffect, useRef, useState } from 'react';
import { COUNCILOR_POSITION_BY_ID } from '@core/model/constants';
import { Pending, Section, Spinner } from '../components/common';
import { useStore } from '../store';

export function Chat(): JSX.Element {
  const { campaign, screen, command, navigate } = useStore();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const councilor = campaign
    ? Object.values(campaign.councilors.hired).find((c) => c?.id === screen.councilorId)
    : null;
  const thread = councilor ? campaign?.chats[councilor.id] : undefined;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length, thread?.pendingReply]);

  if (!campaign || !councilor) {
    return (
      <Section title="Chat">
        <p className="muted">Pick a hired councilor to talk to.</p>
        <div className="chat-picker">
          {campaign &&
            Object.values(campaign.councilors.hired)
              .filter((c): c is NonNullable<typeof c> => c !== null)
              .map((c) => (
                <button
                  key={c.id}
                  className="btn"
                  onClick={() => navigate({ name: 'chat', councilorId: c.id })}
                >
                  {c.name}
                </button>
              ))}
        </div>
        {campaign && Object.values(campaign.councilors.hired).every((c) => c === null) && (
          <Pending label="Hire a councilor first — then they are always available to talk." />
        )}
      </Section>
    );
  }

  const send = async (): Promise<void> => {
    const message = text.trim();
    if (!message) return;
    setText('');
    await command({ type: 'chatSend', councilorId: councilor.id, text: message });
  };

  return (
    <div className="chat-screen">
      <Section
        title={`${councilor.name} — ${COUNCILOR_POSITION_BY_ID[councilor.positionId].title}`}
        actions={
          <button className="btn small ghost" onClick={() => navigate({ name: 'councilors' })}>
            ← Team
          </button>
        }
      >
        <div className="chat-window">
          {(thread?.messages ?? []).map((message, index) => (
            <div key={index} className={`chat-bubble ${message.role}`}>
              <span className="chat-author">
                {message.role === 'player' ? 'You' : councilor.name} · day {message.day}
              </span>
              <p>{message.text}</p>
            </div>
          ))}
          {thread?.pendingReply && (
            <div className="chat-bubble councilor typing">
              <Spinner /> <em>{councilor.name} is typing…</em>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input">
          <textarea
            rows={2}
            value={text}
            placeholder={`Ask ${councilor.name} anything — strategy, gossip, doubts…`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            className="btn primary"
            disabled={!text.trim() || thread?.pendingReply}
            onClick={() => void send()}
          >
            Send
          </button>
        </div>
      </Section>
    </div>
  );
}
