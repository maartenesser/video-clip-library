# Video Clip Library

Transform long-form videos (3-10 min) into a searchable library of tagged short clips (3-20 sec) for Instagram and social media ad creation.

## Architecture

- **Frontend/API**: Next.js 14 on Vercel
- **Database**: Supabase PostgreSQL
- **Video Processing**: Cloudflare Containers (Python + FFmpeg)
- **Storage**: Cloudflare R2

## Project Structure

```
video-clip-library/
├── apps/
│   └── web/                # Next.js app (Vercel)
├── packages/
│   ├── database/           # Supabase schema + client
│   ├── storage/            # R2 client
│   └── shared/             # Shared types
├── workers/
│   └── cloudflare/         # Cloudflare Container (Python)
└── docs/
    └── prompts/            # Agent prompts
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Python 3.11+
- Docker (for local testing)

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific tests
pnpm test:database
pnpm test:storage
pnpm test:api
pnpm test:ui
pnpm test:e2e
pnpm test:workers
```

## License

MIT
