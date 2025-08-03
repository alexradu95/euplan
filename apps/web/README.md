# EuPlan - Personal Document Editor

A clean, fast personal document editor built with Next.js, Y.js, and Tiptap.

## Features

- 📝 Rich text editing with Tiptap
- 💾 Auto-save functionality  
- ↩️ Excellent undo/redo with Y.js
- 🔐 Secure authentication
- 📱 Responsive design
- ⚡ Fast and lightweight

## Architecture

**Simplified Stack:**
- **Frontend:** Next.js 15 + React + TypeScript
- **Editor:** Tiptap + Y.js (for undo/redo)
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** NextAuth.js
- **Styling:** Tailwind CSS

**Architecture Overview:**
```
Browser (Y.js Editor) → Next.js API Routes → PostgreSQL
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- pnpm (recommended)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd euplan/apps/web
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure:
   ```env
   DATABASE_URL="postgresql://..."
   NEXTAUTH_SECRET="your-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. **Set up database:**
   ```bash
   npx drizzle-kit push
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```

## Development

### Project Structure
```
apps/web/
├── app/                 # Next.js App Router
│   ├── api/            # API routes
│   ├── editor/         # Editor pages
│   └── auth/           # Authentication pages
├── components/         # React components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and database
├── providers/          # React context providers
└── types/              # TypeScript type definitions
```

### Key Components

- **YjsProvider:** Manages Y.js documents and auto-save
- **TiptapEditor:** Rich text editor component
- **DocumentHeader:** Shows save status and document info
- **useDocumentPersistence:** Auto-save hook

### API Endpoints

- `GET /api/documents` - List user's documents
- `POST /api/documents` - Create new document
- `GET /api/documents/[id]` - Get document content
- `POST /api/documents/[id]/autosave` - Auto-save document

## Testing

```bash
# Unit tests
pnpm test

# E2E tests  
pnpm test:e2e

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Deployment

The application is designed to deploy easily to any platform that supports Next.js:

- **Vercel:** Automatic deployment from git
- **Railway/Render:** PostgreSQL + Next.js hosting
- **Self-hosted:** Docker deployment ready

## Performance

- **Fast loading:** No WebSocket overhead
- **Efficient saves:** Debounced auto-save (2s delay)
- **Optimized bundle:** Only essential dependencies
- **Database indexes:** Optimized queries for document loading

## Future Enhancements

When needed, the architecture supports adding:
- **Family sharing:** Document sharing with simple permissions
- **Real-time collaboration:** Y.js already supports this
- **Offline support:** Service worker + local storage
- **Version history:** Document snapshots
- **Mobile app:** React Native with shared logic

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes following the existing patterns
4. Run tests: `pnpm test && pnpm test:e2e`
5. Commit and push: `git commit -m "Add my feature"`
6. Create pull request

## License

MIT License - see LICENSE file for details.
