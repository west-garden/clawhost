"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAgentStatus } from "@/hooks/use-agent-status";
import { startAgent } from "@/lib/actions";
import { toast } from "sonner";
import type { AgentStatus } from "@/types";
import { Send, AlertTriangle, Play, X, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({
  agentId,
  agentName,
  initialStatus,
}: {
  agentId: string;
  agentName: string;
  initialStatus: AgentStatus;
}) {
  const t = useTranslations("chat");
  const ta = useTranslations("agent");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { status: liveStatus } = useAgentStatus(agentId, true);
  const currentStatus = liveStatus?.status ?? initialStatus;
  const isRunning = currentStatus === "running";

  const initial = (agentName || "?")[0].toUpperCase();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleStart() {
    setStartLoading(true);
    const result = await startAgent(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(ta("startSuccess"));
    }
    setStartLoading(false);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming || !isRunning) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  accumulated += delta;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                      role: "assistant",
                      content: accumulated,
                    };
                    return updated;
                  });
                }
              } catch {
                // Skip non-JSON lines
              }
            }
          }
        }
      }
    } catch (err) {
      toast.error(t("connectionError"));
      // Remove the empty assistant message on error
      setMessages((prev) => {
        if (prev[prev.length - 1]?.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Not running state
  if (!isRunning) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {t("notRunning")}
          </p>
          <p className="text-xs text-muted-foreground mb-4">{t("startToChat")}</p>
          <button
            onClick={handleStart}
            disabled={startLoading}
            className="glass-btn py-2 px-4 text-sm"
          >
            {startLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>
              {startLoading ? ta("actions.starting") : ta("actions.start")}
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages */}
      <div className="chat-messages">
        {/* Warning banner */}
        {!warningDismissed && (
          <div className="chat-warning">
            <AlertTriangle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary leading-relaxed flex-1">
              {t("warning")}
            </p>
            <button
              onClick={() => setWarningDismissed(true)}
              className="text-muted-foreground hover:text-primary flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 items-start ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5 ${
                msg.role === "assistant"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {msg.role === "assistant" ? initial : "U"}
            </div>
            <div
              className={
                msg.role === "assistant"
                  ? "chat-bubble chat-bubble-bot"
                  : "chat-bubble chat-bubble-user"
              }
            >
              {msg.content || (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="flex items-end gap-2.5 bg-muted border border-border rounded-xl p-2.5 focus-within:border-primary transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("inputPlaceholder")}
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground resize-none outline-none max-h-32 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="glass-btn w-8 h-8 flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          {t("aiDisclaimer")}
        </p>
      </div>
    </div>
  );
}
