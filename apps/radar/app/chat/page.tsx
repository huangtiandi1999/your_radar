"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputProvider,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputButton,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { MessageCircle, PaperclipIcon, Sparkles } from "lucide-react";

function ChatContent() {
  // 使用 @ai-sdk/react v3 的新 API
  const { messages, sendMessage, status } = useChat({
    // @ts-expect-error - Custom fetch for backend endpoint
    fetch: (url: string, options: RequestInit) => {
      return fetch("http://127.0.0.1:4000/api/chat", options);
    },
  });

  const { textInput } = usePromptInputController();

  const onPromptSubmit = async (message: {
    text: string;
    files: Array<{ type: string; url: string; mediaType?: string; filename?: string }>;
  }) => {
    if (!message.text.trim()) return;

    // 使用新的消息格式发送消息
    await sendMessage({
      parts: [{ type: "text" as const, text: message.text }],
    });
  };

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-16 items-center border-b border-border bg-background px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Chat</h1>
            <p className="text-muted-foreground text-xs">
              由 AI SDK 驱动
            </p>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-4xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="开始对话"
              description="向AI提问任何问题，开启智能对话体验"
              icon={<MessageCircle className="size-16 text-muted-foreground/50" />}
            />
          ) : (
            messages.map((msg: UIMessage) => (
              <Message key={msg.id} from={msg.role}>
                <MessageContent className={msg.role === "user" ? "bg-primary text-primary-foreground" : ""}>
                  <MessageResponse>
                    {msg.parts
                      .filter((part) => part.type === "text")
                      .map((part) => (part.type === "text" ? part.text : ""))
                      .join("")}
                  </MessageResponse>
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="mx-auto w-full max-w-4xl">
          <PromptInput onSubmit={onPromptSubmit} className="w-full">
            <PromptInputTextarea
              placeholder="输入消息... (Enter发送, Shift+Enter换行)"
              className="min-h-[60px]"
              autoFocus
            />
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputButton onClick={() => {}}>
                  <PaperclipIcon className="size-4" />
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={isLoading || !textInput.value.trim()}
                status={isLoading ? "streaming" : undefined}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <PromptInputProvider>
      <ChatContent />
    </PromptInputProvider>
  );
}

