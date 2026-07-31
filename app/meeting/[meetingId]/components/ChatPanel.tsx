'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChat, useLocalParticipant } from '@livekit/components-react';
import type { ReceivedChatMessage } from '@livekit/components-core';
import { Button } from '@/components/ui/button';
import { X, Send } from 'lucide-react';

interface ChatPanelProps {
  onClose: () => void;
  onUnreadChange: (count: number) => void;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function ChatPanel({ onClose, onUnreadChange }: ChatPanelProps) {
  const { chatMessages, send, isSending } = useChat();
  const { localParticipant } = useLocalParticipant();
  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(chatMessages.length);
  const unreadRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Track unread messages
  useEffect(() => {
    const newCount = chatMessages.length - prevLengthRef.current;
    if (newCount > 0) {
      unreadRef.current += newCount;
      onUnreadChange(unreadRef.current);
    }
    prevLengthRef.current = chatMessages.length;
  }, [chatMessages.length, onUnreadChange]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isSending) return;
    setInputValue('');
    try {
      await send(text);
    } catch {
      // Non-fatal
    }
  }, [inputValue, isSending, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const localIdentity = localParticipant?.identity ?? '';

  return (
    <div className="flex flex-col h-full bg-background border-l w-72 sm:w-80 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm">Chat</h2>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose} aria-label="Close chat">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {chatMessages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8">No messages yet</p>
        ) : (
          chatMessages.map((msg: ReceivedChatMessage) => {
            const isLocal = msg.from?.identity === localIdentity;
            const senderName = msg.from?.name ?? msg.from?.identity ?? 'Unknown';
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 ${isLocal ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`flex items-baseline gap-2 text-[10px] text-muted-foreground ${
                    isLocal ? 'flex-row-reverse' : ''
                  }`}
                >
                  <span className="font-medium">{isLocal ? 'You' : senderName}</span>
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm break-words ${
                    isLocal
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 resize-none text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring min-h-[38px] max-h-24"
            rows={1}
            placeholder="Type a message…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Chat message input"
          />
          <Button
            size="icon"
            className="w-9 h-9 shrink-0"
            onClick={handleSend}
            disabled={isSending || !inputValue.trim()}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
