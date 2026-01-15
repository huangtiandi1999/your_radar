# AGENT.md - Your Radar Project Architecture

## Project Overview

**Your Radar** is an AI-powered intelligent system built with LangChain and LangGraph. The project uses a Monorepo architecture managed by pnpm workspace, designed to provide automated intelligent workflow capabilities.

## Tech Stack

- **AI Framework**: LangChain, LangGraph
- **AI Models**: OpenAI, DeepSeek
- **Frontend**: Next.js 16, React 19, TailwindCSS 4
- **Backend**: Hono
- **Build Tools**: Rslib, Rspack, Rsbuild
- **Package Manager**: pnpm (v10.26.0)
- **Language**: TypeScript 5.8.3

## Project Structure

```
your_radar/
├── apps/
│   ├── radar/                     # Next.js frontend application
│   │   ├── app/
│   │   │   ├── page.tsx           # Main page (SSE streaming demo)
│   │   │   ├── layout.tsx         # Root layout
│   │   │   └── globals.css        # Global styles
│   │   └── package.json
│   │
│   └── radar_server/              # Hono backend service
│       ├── src/
│       │   └── index.ts           # Server entry with SSE endpoints
│       └── package.json
│
├── packages/
│   └── core/                      # Core AI Agent library (WIP)
│       ├── src/
│       │   ├── index.ts           # Entry point with demo code
│       │   ├── graph/             # LangGraph workflow demos
│       │   ├── model/             # AI model configurations
│       │   └── constant/          # Constants
│       ├── langgraph.json
│       ├── rslib.config.ts
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json
└── LICENSE
```

## Module Overview

### Apps/Radar - Frontend Application

**Technology**: Next.js 16 with App Router + React 19 + TailwindCSS 4

**Features**:
- SSE (Server-Sent Events) streaming communication demo
- Real-time display of AI responses
- Responsive UI with modern design

### Apps/Radar_Server - Backend Service

**Technology**: Hono (lightweight web framework)

**Features**:
- RESTful API endpoints
- SSE streaming support
- CORS enabled
- Runs on port 4000

**API Endpoints**:
- `GET /api/test` - Test endpoint
- `GET /api/chat` - SSE streaming endpoint

### Packages/Core - AI Agent Library

**Status**: Work in Progress (Demo Stage)

**Current Content**:
- LangChain and LangGraph integration examples
- AI model configuration (OpenAI, DeepSeek)
- Demo workflows and tools
- Experimental features

**Note**: This package contains demo code and is under active development. The actual production features are yet to be implemented.

## Development Commands

### Root Level

```bash
# Start all apps in parallel
pnpm run dev

# Start Core LangGraph dev server
pnpm run dev:core

# Build all packages
pnpm run build

# Build Core package
pnpm run build:core

# Build and execute Core package
pnpm run exec:core
```

### Individual Apps

```bash
# Frontend
cd apps/radar && pnpm run dev

# Backend
cd apps/radar_server && pnpm run dev

# Core package
cd packages/core && pnpm run dev
```

## Environment Setup

Create `.env` file in `packages/core/`:

```env
# AI model selection: openai | deepseek
MODEL=openai

# Optional: Custom API base URL
API_BASE_URL=https://your-custom-endpoint.com/v1

# API Keys (if needed)
OPENAI_API_KEY=your_api_key
DEEPSEEK_API_KEY=your_api_key
```

## Key Dependencies

### Frontend
- next: ^16.1.1
- react: ^19.2.3
- tailwindcss: ^4

### Backend
- hono: ^4.11.4
- @hono/node-server: ^1.19.8

### Core
- @langchain/langgraph: ^1.0.7
- @langchain/core: ^1.1.5
- langchain: ^1.2.0
- zod: ^4.2.0

## Architecture Features

- **Monorepo Structure**: Shared packages with independent apps
- **Type Safety**: Full TypeScript with Zod validation
- **Modern Stack**: Latest versions of Next.js, React, and build tools
- **Real-time Communication**: SSE streaming for responsive UX
- **Extensible**: Easy to add new features and integrations

## Development Status

| Module | Status | Description |
|--------|--------|-------------|
| Frontend (Radar) | ✅ Demo Ready | SSE streaming UI demo |
| Backend (Radar Server) | ✅ Demo Ready | Basic API with SSE |
| Core Library | 🚧 In Development | Demo code and experiments |

## Future Plans

- Implement production-ready AI workflows
- Add more AI tools and integrations
- Develop comprehensive user interface
- Add persistent storage
- Implement authentication and authorization
- Add monitoring and logging
- Write comprehensive tests
- Set up CI/CD pipeline

## Resources

- [LangChain Documentation](https://js.langchain.com/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)
- [Next.js Documentation](https://nextjs.org/)
- [Hono Documentation](https://hono.dev/)

## License

See LICENSE file in the root directory.

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-15
