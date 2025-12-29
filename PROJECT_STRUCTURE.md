# Project Structure: Agent Service

## Overview
- **Architecture Type**: Microservice (Background Workers & AI Agents)
- **Main Stack**: NestJS (TypeScript)
- **Root**: `c:\web\squashdaddy\agent-service`

## 📂 Directory Structure

```
c:\web\squashdaddy\agent-service
├── 📁 src                  # Source code
│   ├── 📁 agent-brain      # AI logic modules (Gemini integration, Orchestrator)
│   ├── 📁 database         # MongoDB connection & schema setup
│   ├── 📁 gmail-watcher    # Gmail monitoring, parsing, and job queue producers
│   ├── 📁 bookings         # Booking management logic
│   ├── 📁 calendar-sync    # Calendar synchronization logic
│   ├── 📁 config           # Configuration and validation schemas
│   └── 📄 app.module.ts    # Main application module
├── 📄 package.json         # Dependencies & Scripts
├── 📄 tsconfig.json        # TypeScript configuration
└── 📄 .env.example         # Environment variables template
```

## 🏗 Configurations

- **Framework**: NestJS
- **Language**: TypeScript
- **Entry Point**: `src/main.ts`
- **Key Configuration Files**:
  - `package.json`: Application metadata and scripts.
  - `.env`: Environment variables (Redis Host, MongoDB URI, Google Credentials).
  - `nest-cli.json`: NestJS CLI configuration.

## 📦 Dependencies

- **Core**: `@nestjs/core`, `@nestjs/common`, `@nestjs/config`
- **Queue System**: `bullmq`, `@nestjs/bullmq` (Redis-based job processing)
- **Database**: `mongoose`, `@nestjs/mongoose`
- **External Services**: 
  - `googleapis` (Gmail API)
  - `@google/generative-ai` (Gemini LLM)
  - `axios` (HTTP Requests)

## 📜 Commands

| Command                     | Description                                      |
|-----------------------------|--------------------------------------------------|
| `npm run start`             | Start the application                            |
| `npm run start:dev`         | Start in watch mode (hot-reload)                 |
| `npm run build`             | Compile TypeScript to `dist/`                    |
| `npm run test`              | Run unit tests                                   |
