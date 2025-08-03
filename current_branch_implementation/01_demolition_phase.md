# Phase 1: Demolition Phase
**Timeline:** Day 1 (4 hours)
**Goal:** Remove sync server and WebSocket infrastructure

## ⚠️ Before You Start

```bash
# Create backup branch
git branch backup/pre-simplification

# Create working branch
git checkout -b simplify/remove-sync-server

# Commit current state
git add .
git commit -m "Backup before simplification"
```

## Step 1.1: Delete Sync Server (30 minutes)

### 1.1.1 Remove Sync Server Directory
```bash
# Nuclear option - just delete the entire sync server
rm -rf apps/sync-server
```

### 1.1.2 Update Workspace Configuration
**File:** `pnpm-workspace.yaml`
```yaml
# Remove this line:
# - "apps/sync-server"

# Keep only:
packages:
  - "apps/web"
  - "packages/*"
```

### 1.1.3 Update Root Package.json
**File:** `package.json`
```json
{
  "scripts": {
    // Remove any sync-server related scripts
    // Remove: "dev:sync": "pnpm --filter sync-server dev"
    // Remove: "build:sync": "pnpm --filter sync-server build"
  }
}
```

### 1.1.4 Update Docker Configuration (if exists)
**File:** `docker-compose.yml`
```yaml
# Remove sync-server service entirely
# Keep only web app and database services
```

## Step 1.2: Remove WebSocket Dependencies (45 minutes)

### 1.2.1 Remove Package Dependencies
```bash
cd apps/web

# Remove WebSocket related packages
pnpm remove socket.io-client y-websocket

# Also check for and remove:
pnpm remove @types/socket.io-client
# Any other WebSocket related packages
```

### 1.2.2 Find All WebSocket Imports
```bash
# Search for WebSocket imports to remove
grep -r "socket.io" apps/web/
grep -r "y-websocket" apps/web/
grep -r "WebSocket" apps/web/
```

### 1.2.3 Delete WebSocket Hook Files
```bash
# Delete these files entirely:
rm apps/web/hooks/useWebSocket.ts
```

## Step 1.3: Clean Up Existing Hooks (90 minutes)

### 1.3.1 Simplify useYjsDocument.ts
**File:** `apps/web/hooks/useYjsDocument.ts`

**Remove these imports:**
```typescript
// Remove all socket.io imports
// Remove y-websocket imports
// Remove any WebSocket provider imports
```

**Remove these features:**
- WebSocket connection logic
- Sync provider initialization
- Connection status tracking
- Awareness/cursor tracking
- Online/offline handling for sync

**Keep these features:**
- Y.Doc initialization
- Basic document state
- Local Y.js operations

### 1.3.2 Update YjsProvider
**File:** `apps/web/providers/YjsProvider.tsx`

**Remove:**
- WebSocket connection setup
- Sync provider configuration
- Connection status state
- Multi-user awareness
- Real-time sync logic

**Keep:**
- Y.Doc creation and management
- Basic document switching
- Authentication integration

## Step 1.4: Remove WebSocket Logic from Components (45 minutes)

### 1.4.1 Update DocumentHeader Component
**File:** `apps/web/components/DocumentHeader.tsx`

**Remove:**
- Connection status indicators
- Real-time sync status
- Connected users display
- WebSocket error states

**Keep:**
- Document title
- Save status (we'll implement this in Phase 2)
- User menu
- Navigation

### 1.4.2 Update TiptapEditor Component  
**File:** `apps/web/components/TiptapEditor.tsx`

**Remove:**
- Collaboration extension configuration
- Awareness/cursor extensions
- Real-time presence features

**Keep:**
- Core Tiptap editor setup
- Y.js text binding (for undo/redo)
- All formatting extensions
- Basic editor functionality

## Step 1.5: Clean Up Types and Utilities (30 minutes)

### 1.5.1 Update WebSocket Types
**File:** `apps/web/types/websocket.ts`
```bash
# Either delete this file entirely or clean out WebSocket types
rm apps/web/types/websocket.ts
```

### 1.5.2 Remove WebSocket API Routes (if any)
```bash
# Look for and remove any WebSocket related API routes
find apps/web/app/api -name "*socket*" -delete
find apps/web/app/api -name "*sync*" -delete
```

## Step 1.6: Update Environment Variables (15 minutes)

### 1.6.1 Clean .env Files
**Files:** `.env.local`, `.env.example`

**Remove:**
```bash
# Remove sync server related variables
SYNC_SERVER_URL=
WEBSOCKET_URL=
SYNC_SERVER_PORT=
```

**Keep:**
```bash
# Keep database and auth variables
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

## ✅ Validation Checklist

After completing Phase 1, verify:

- [ ] `apps/sync-server` directory is completely deleted
- [ ] No `socket.io-client` or `y-websocket` in package.json
- [ ] No WebSocket imports in any files
- [ ] `useWebSocket.ts` is deleted
- [ ] WebSocket logic removed from all components
- [ ] Environment variables cleaned up
- [ ] Project still compiles (even if it doesn't work yet)

## 🧪 Test Phase 1

```bash
cd apps/web

# Should install without WebSocket dependencies
pnpm install

# Should compile without WebSocket imports
pnpm build

# Should start (but functionality will be broken - that's expected)
pnpm dev
```

**Expected State After Phase 1:**
- ✅ App compiles and starts
- ❌ Document editing won't save (we'll fix in Phase 2)
- ❌ Some UI elements may be broken (we'll fix in Phase 3)
- ✅ No WebSocket errors in console

## 📝 Commit Your Progress

```bash
git add .
git commit -m "Phase 1: Remove sync server and WebSocket infrastructure

- Deleted apps/sync-server completely
- Removed socket.io-client and y-websocket dependencies  
- Cleaned up WebSocket imports and logic
- Removed connection status tracking
- App compiles but document persistence is broken (will fix in Phase 2)"
```

---
**Next:** Proceed to `02_core_rebuild.md` to rebuild the core persistence logic.