"use client";

import Link from "next/link";
import { MessageCircle, Sparkles, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <div className="mx-auto max-w-2xl text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 shadow-lg">
            <Sparkles className="size-10 text-primary" />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-6xl">
          欢迎使用 <span className="text-primary">Your Radar</span>
        </h1>

        <p className="mb-8 text-lg text-muted-foreground">
          基于 LangGraph 和 AI Elements 构建的智能对话平台
        </p>

        {/* Features */}
        <div className="mb-12 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6 text-left shadow-sm">
            <MessageCircle className="mb-3 size-8 text-primary" />
            <h3 className="mb-2 font-semibold">智能对话</h3>
            <p className="text-muted-foreground text-sm">
              与AI进行自然流畅的对话，获取即时响应
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 text-left shadow-sm">
            <Sparkles className="mb-3 size-8 text-primary" />
            <h3 className="mb-2 font-semibold">现代化UI</h3>
            <p className="text-muted-foreground text-sm">
              基于AI Elements构建的精美界面
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/chat"
          className="group inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl"
        >
          开始对话
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
