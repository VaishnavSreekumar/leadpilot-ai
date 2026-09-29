'use client';

import { useState, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SalesAssistantProps {
  leadId: string;
  leadName: string;
  leadPriority: string | null;
  isAnalyzed: boolean;
}

// ---------------------------------------------------------------------------
// Starter prompts
// ---------------------------------------------------------------------------

const STARTER_PROMPTS = [
  'Summarize this lead',
  'What should I ask next?',
  'Draft a follow-up response',
  'How should I handle the objection?',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SalesAssistant({
  leadId,
  leadName,
  leadPriority,
  isAnalyzed,
}: SalesAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Cooldown countdown ticker
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const isSendDisabled = isLoading || cooldownSeconds > 0 || inputValue.trim().length === 0;

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || cooldownSeconds > 0) return;

    // Build history from current messages (max 6 turns = 12 messages)
    const historyForRequest: { role: 'user' | 'assistant'; content: string }[] = messages
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyForRequest,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          const remaining = data.cooldownRemaining ?? 5;
          setCooldownSeconds(remaining);
          setErrorMessage(data.error ?? 'Please wait before sending another message.');
          // Remove the optimistically added user message on rate-limit
          setMessages((prev) => prev.slice(0, -1));
          setInputValue(trimmed);
        } else {
          setErrorMessage(
            data.error ?? 'The sales assistant is temporarily unavailable. Please try again.'
          );
        }
        return;
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setCooldownSeconds(5); // start 5s cooldown after successful send
    } catch {
      setErrorMessage('A network error occurred. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleStarterPrompt = (prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  const copyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Clipboard unavailable — silent fail
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setErrorMessage(null);
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'HOT':
        return 'text-rose-400';
      case 'WARM':
        return 'text-amber-400';
      default:
        return 'text-sky-400';
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Sales Assistant</h2>
            <p className="text-[11px] text-zinc-500 font-mono">
              Grounded to{' '}
              <span className="text-zinc-300">{leadName}</span>
              {leadPriority && (
                <span className={`ml-1.5 font-bold ${getPriorityColor(leadPriority)}`}>
                  · {leadPriority}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Grounded context indicator */}
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-md bg-indigo-950/40 border border-indigo-800/40 text-indigo-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 inline-block"></span>
            Grounded
          </span>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-md hover:bg-zinc-800 transition-colors font-mono"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Context not-analyzed notice */}
      {!isAnalyzed && (
        <div className="px-5 py-2.5 bg-amber-950/30 border-b border-amber-900/30 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-[11px] text-amber-300/80">
            This lead hasn&apos;t been AI-analyzed yet. The assistant will work from basic lead data. Run AI Analysis above for richer context.
          </p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 min-h-[280px] max-h-[420px] overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full py-8 gap-5">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-zinc-300">Ask anything about this lead</p>
              <p className="text-xs text-zinc-500 max-w-xs">
                Answers are grounded exclusively to the selected lead&apos;s data. No information from
                other leads will be used.
              </p>
            </div>

            {/* Starter prompts */}
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleStarterPrompt(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-700/60 bg-zinc-900 hover:bg-zinc-800 hover:border-indigo-700/60 text-zinc-300 hover:text-white transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Conversation messages */
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-lg bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                )}

                <div
                  className={`max-w-[80%] group ${
                    msg.role === 'user'
                      ? 'bg-indigo-600/20 border border-indigo-600/30 rounded-xl rounded-tr-sm px-3.5 py-2.5'
                      : 'bg-zinc-950/60 border border-zinc-800/80 rounded-xl rounded-tl-sm px-3.5 py-2.5'
                  }`}
                >
                  <p className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {msg.role === 'assistant' && (
                    <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => copyMessage(msg.content, idx)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 font-mono transition-colors"
                      >
                        {copiedIndex === idx ? (
                          <span className="text-emerald-400">✓ Copied</span>
                        ) : (
                          <span>Copy</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-7 w-7 rounded-lg bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="px-4 py-2 bg-rose-950/30 border-t border-rose-900/30 flex items-center justify-between gap-3">
          <p className="text-xs text-rose-300">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Cooldown banner */}
      {cooldownSeconds > 0 && !errorMessage && (
        <div className="px-4 py-1.5 bg-zinc-950/60 border-t border-zinc-800/60 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-[11px] text-zinc-400 font-mono">
            Cooling down — {cooldownSeconds}s remaining
          </p>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              id="sales-assistant-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this lead… (Enter to send, Shift+Enter for new line)"
              rows={2}
              maxLength={1000}
              disabled={isLoading}
              className="w-full resize-none rounded-xl bg-zinc-950 border border-zinc-700/60 focus:border-indigo-600/60 focus:outline-none px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors disabled:opacity-50 leading-relaxed"
            />
            <span className="absolute bottom-2 right-3 text-[10px] text-zinc-600 font-mono pointer-events-none">
              {inputValue.length}/1000
            </span>
          </div>

          <button
            type="submit"
            disabled={isSendDisabled}
            id="sales-assistant-send-btn"
            className="h-[62px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shrink-0 flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : cooldownSeconds > 0 ? (
              <span className="font-mono text-[11px]">{cooldownSeconds}s</span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>

        <p className="text-[10px] text-zinc-600 mt-1.5 font-mono">
          Answers are grounded to this lead only · Conversation is not stored
        </p>
      </div>
    </div>
  );
}
