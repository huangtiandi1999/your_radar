"use client";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from 'ai';
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
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputAttachments,
  PromptInputAttachment,
} from "@/components/ai-elements/prompt-input";
import { MessageCircle, Sparkles } from "lucide-react";
import { useState } from "react";

function ChatContent() {
  const [text, setText] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
        api: 'http://127.0.0.1:4000/api/chat',
    }),
    onData: (dataPart) => {
      console.log('Received:', dataPart.type, dataPart.data);
    }
  });


  const onPromptSubmit = async (message: {
    text: string;
    files: Array<{ type: string; url: string; mediaType?: string; filename?: string }>;
  }) => {
    if (!message.text.trim()) return;

    // 使用新的消息格式发送消息
    setText("");
    await sendMessage({
      text: message.text,
    });
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-16 items-center border-b border-border bg-background px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Your Radar</h1>
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
          <PromptInput onSubmit={onPromptSubmit} className="w-full" accept="image/*,.pdf,.doc,.docx,.txt">
            <PromptInputAttachments>
              {(attachment) => (
                <PromptInputAttachment key={attachment.id} data={attachment} />
              )}
            </PromptInputAttachments>
            
            <PromptInputTextarea
              placeholder="输入消息... (Enter发送, Shift+Enter换行)"
              onChange={handleInput}
              value={text}
              className="min-h-[60px]"
              autoFocus
            />
            
            <PromptInputFooter>
              <PromptInputSubmit
                disabled={isLoading || !text.trim()}
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
  return <ChatContent />;
}

