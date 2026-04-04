"use client";

import { useState, useRef, useCallback } from "react";
import type { GatewayClient, GatewayEvent } from "@/lib/gateway-client";
import type { ChatMessage, ChatEventPayload } from "@/types";

interface UseWsChatOptions {
  client: GatewayClient | null;
  connected: boolean;
  sessionKey: string;
  getMessages: () => ChatMessage[];
  updateMessages: (messages: ChatMessage[]) => void;
}

interface UseWsChatReturn {
  isStreaming: boolean;
  sendMessage: (text: string) => void;
  abortGeneration: () => void;
  handleEvent: (evt: GatewayEvent) => void;
}

export function useWsChat({
  client,
  connected,
  sessionKey,
  getMessages,
  updateMessages,
}: UseWsChatOptions): UseWsChatReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingTextRef = useRef("");
  const runIdRef = useRef<string | null>(null);

  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;

  // Handle Gateway events
  const handleEvent = useCallback((evt: GatewayEvent) => {
    if (evt.event === "chat") {
      const payload = evt.payload as ChatEventPayload | undefined;
      if (!payload) return;

      // Only process events for our session
      if (payload.sessionKey && payload.sessionKey !== sessionKeyRef.current) {
        return;
      }

      switch (payload.state) {
        case "delta": {
          // Accumulate streaming text
          const text = payload.message?.content;
          if (typeof text === "string") {
            streamingTextRef.current = text;
          } else if (Array.isArray(text)) {
            streamingTextRef.current = text
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("");
          }

          // Update messages with streaming text
          const messages = getMessages();
          const lastMsg = messages[messages.length - 1];

          if (lastMsg?.role === "assistant" && lastMsg._isStreaming) {
            // Update existing streaming message
            const updated = [...messages];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: streamingTextRef.current,
            };
            updateMessages(updated);
          } else {
            // Add new streaming message
            updateMessages([
              ...messages,
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: streamingTextRef.current,
                timestamp: Date.now(),
                _isStreaming: true,
              },
            ]);
          }
          break;
        }

        case "final": {
          const text = payload.message?.content;
          let finalText = "";
          if (typeof text === "string") {
            finalText = text;
          } else if (Array.isArray(text)) {
            finalText = text
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("");
          }

          // Replace streaming message with final
          const messages = getMessages();
          const lastMsg = messages[messages.length - 1];

          if (lastMsg?._isStreaming) {
            const updated = [...messages];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: finalText,
              _isStreaming: undefined,
            };
            updateMessages(updated);
          } else {
            // Add final message if no streaming message
            updateMessages([
              ...messages,
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: finalText,
                timestamp: Date.now(),
              },
            ]);
          }

          streamingTextRef.current = "";
          runIdRef.current = null;
          setIsStreaming(false);
          break;
        }

        case "error": {
          // Replace streaming with error message
          const messages = getMessages();
          const lastMsg = messages[messages.length - 1];
          const errMsg = payload.errorMessage || "生成失败";

          if (lastMsg?._isStreaming) {
            const updated = [...messages];
            updated[updated.length - 1] = {
              ...lastMsg,
              content: `⚠ ${errMsg}`,
              _isStreaming: undefined,
            };
            updateMessages(updated);
          }

          streamingTextRef.current = "";
          runIdRef.current = null;
          setIsStreaming(false);
          break;
        }

        case "aborted": {
          // Keep partial text as final message
          const messages = getMessages();
          const lastMsg = messages[messages.length - 1];

          if (lastMsg?._isStreaming) {
            const updated = [...messages];
            updated[updated.length - 1] = {
              ...lastMsg,
              _isStreaming: undefined,
            };
            updateMessages(updated);
          }

          streamingTextRef.current = "";
          runIdRef.current = null;
          setIsStreaming(false);
          break;
        }
      }
    }
  }, [getMessages, updateMessages]);

  // Send message
  const sendMessage = useCallback((text: string) => {
    if (!client || !connected || !sessionKey) return;

    const idempotencyKey = crypto.randomUUID();
    runIdRef.current = idempotencyKey;
    streamingTextRef.current = "";

    // Add user message
    const messages = getMessages();
    const updatedMessages = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: text,
        timestamp: Date.now(),
      },
    ];
    updateMessages(updatedMessages);

    setIsStreaming(true);

    // Send to Gateway
    client.request("chat.send", {
      sessionKey,
      message: text,
      idempotencyKey,
    }).catch((err) => {
      console.error("[useWsChat] Send failed:", err);
      setIsStreaming(false);

      // Add error message
      const currentMessages = getMessages();
      updateMessages([
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: `⚠ 发送失败: ${err}`,
          timestamp: Date.now(),
        },
      ]);
    });
  }, [client, connected, sessionKey, getMessages, updateMessages]);

  // Abort generation
  const abortGeneration = useCallback(() => {
    if (!client || !connected || !runIdRef.current || !sessionKey) return;

    client.request("chat.abort", {
      sessionKey,
      runId: runIdRef.current,
    }).catch(() => {});
  }, [client, connected, sessionKey]);

  return {
    isStreaming,
    sendMessage,
    abortGeneration,
    handleEvent,
  };
}