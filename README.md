# AMS — Asset Management System

React 19 + Vite 6 + TypeScript strict + Tailwind CSS + shadcn/ui + Firebase.

## Prerequisites

- Node 20 LTS or higher
- npm 9 or higher

## Setup

```bash
# Install dependencies
npm ci

# Copy env template and fill in Firebase values
cp .env.example .env.local
# Edit .env.local with your VITE_FIREBASE_* values
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Preview production build locally

```bash
npm run preview
```

## Tests

```bash
npm test -- --run
```

## Type checking

```bash
npm run typecheck
```

## Firebase backend deployment

```bash
# Deploy Firestore + Storage rules and indexes
npm run deploy:rules

# Deploy Cloud Functions
npm run deploy:functions

# Deploy everything (rules + functions)
npm run deploy:backend

# Run Firebase emulators locally
npm run emulators
```

> Note: Requires `npx firebase login` run interactively before first deploy.
> The Firebase project id is configured in `.firebaserc` (not committed until
> the project exists — see docs/superpowers/plans/).

## Environment variables

See `.env.example` for all required variables.
Local dev: `.env.local` (gitignored).
Production: set in Vercel project dashboard → Settings → Environment Variables.
