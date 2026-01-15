"use client";

import { useState, FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { MessageCircle, Sparkles, Send } from "lucide-react";

export default function SimpleChatPage() {
  const [inputValue, setInputValue] = useState("");
  
  const { messages, sendMessage, status } = useChat({
    // @ts-expect-error - Custom fetch
    fetch: (url: string, options: RequestInit) => {
      return fetch("http://127.0.0.1:4000/api/chat", options);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    await sendMessage({
      parts: [{ type: "text" as const, text: inputValue }],
    });

    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-16 items-center border-b px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
            <Sparkles className="size-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">AI Chat (简化版)</h1>
            <p className="text-xs text-gray-500">测试基本输入功能</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageCircle className="size-16 text-gray-300" />
              <h2 className="mt-4 text-lg font-semibold">开始对话</h2>
              <p className="text-sm text-gray-500">在下方输入框输入消息测试</p>
            </div>
          ) : (
            messages.map((msg: UIMessage) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.parts
                    .filter((part) => part.type === "text")
                    .map((part) => (part.type === "text" ? part.text : ""))
                    .join("")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="mx-auto max-w-4xl">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter发送, Shift+Enter换行)"
              className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              rows={1}
              style={{ minHeight: "52px", maxHeight: "200px" }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-5" />
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-gray-500">
            {isLoading ? "正在发送..." : "Enter 发送，Shift+Enter 换行"}
          </p>
        </div>
      </div>
    </div>
  );
}

