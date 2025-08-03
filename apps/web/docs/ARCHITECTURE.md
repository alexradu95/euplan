# Architecture Decisions

## Overview

EuPlan was simplified from a complex real-time collaboration system to a clean single-user document editor. This document explains the current architecture and the reasoning behind key decisions.

## Current Architecture

### High-Level Design
```
┌─────────────┐    HTTP    ┌─────────────┐    SQL    ┌─────────────┐
│   Browser   │ ────────► │ Next.js App │ ────────► │ PostgreSQL  │
│   (Y.js)    │ ◄──────── │ (API Routes)│ ◄──────── │             │
└─────────────┘           └─────────────┘           └─────────────┘
```

### Component Layer
- **YjsProvider:** Document state management and auto-save orchestration
- **TiptapEditor:** Rich text editing with Y.js integration
- **DocumentHeader:** Save status and document metadata
- **API Routes:** Simple CRUD operations with user authentication

### Data Layer
- **Documents Table:** Simple user ownership model (user_id + document_id)
- **Y.js Binary Storage:** Efficient document storage with full edit history
- **Auto-save Strategy:** Debounced saves (2 second delay) with optimistic UI

## Key Design Decisions

### 1. Keep Y.js Without Real-time Sync

**Decision:** Maintain Y.js for local editor features only
**Reasoning:**
- ✅ Excellent undo/redo functionality
- ✅ Already integrated with Tiptap
- ✅ Future-proof for collaboration
- ✅ Efficient change tracking
- ❌ 80KB bundle cost (acceptable for rich editor)

**Alternative Considered:** Remove Y.js entirely
**Why Rejected:** Would require implementing undo/redo and rewriting Tiptap integration

### 2. Client-Side Auto-Save vs Server-Side Sync

**Decision:** Client-side debounced auto-save
**Reasoning:**
- ✅ Simpler architecture (no sync server needed)
- ✅ Lower infrastructure costs
- ✅ Easier to debug and maintain
- ✅ Good user experience with save status feedback

**Alternative Considered:** Keep sync server for persistence only
**Why Rejected:** Over-engineered for single-user use case

### 3. Simple Database Schema

**Decision:** Minimal tables (users, documents, auth tables only)
**Reasoning:**
- ✅ Fast queries with simple ownership model
- ✅ No complex permission logic needed
- ✅ Easy to understand and maintain
- ✅ Room to add complexity later if needed

**Alternative Considered:** Keep collaboration tables for future use
**Why Rejected:** YAGNI principle - add complexity when actually needed

### 4. Binary Y.js Storage Format

**Decision:** Store Y.js documents as base64-encoded binary
**Reasoning:**
- ✅ Preserves full Y.js functionality
- ✅ Efficient storage size
- ✅ No conversion overhead
- ✅ Maintains edit history for undo/redo

**Alternative Considered:** Convert to JSON for human readability
**Why Rejected:** Would lose Y.js features and require conversion layer

## Performance Characteristics

### Load Times
- **Document List:** ~100ms (simple user_id query)
- **Document Load:** ~200ms (single document fetch + Y.js decode)
- **First Paint:** <1s (no WebSocket connection delay)

### Save Performance
- **Auto-save Delay:** 2 seconds (debounced)
- **Save Duration:** ~150ms (API call + database write)
- **Offline Handling:** Graceful degradation with retry

### Bundle Size
- **Y.js:** ~80KB (editor functionality)
- **Tiptap:** ~100KB (rich text features)
- **Total JS:** ~300KB (reasonable for rich editor)

## Scalability Considerations

### Current Limits
- **Single User:** No concurrency concerns
- **Document Size:** Y.js handles large documents well
- **Storage:** PostgreSQL can handle millions of documents

### Future Scaling Points
- **Collaboration:** Add WebSocket layer back when needed
- **File Attachments:** Add blob storage integration
- **Search:** Add full-text search indexes
- **Mobile:** React Native app can reuse core logic

## Security Model

### Authentication
- **NextAuth.js:** Industry standard authentication
- **Session-based:** Simple session verification
- **No sharing:** Users can only access their own documents

### Data Protection
- **Ownership Validation:** Every API call validates user_id
- **SQL Injection:** Drizzle ORM provides protection
- **XSS Prevention:** React's built-in protection

## Migration History

### Previous Architecture (Removed)
- **Sync Server:** NestJS WebSocket server
- **Real-time Sync:** Y.js WebSocket provider  
- **Complex Permissions:** Multi-user access control
- **Connected Users:** Live presence tracking

### Why Simplified
- **No Users Yet:** Pre-release app, no backward compatibility needed
- **Over-Engineered:** Enterprise features for personal use case
- **Maintenance Burden:** Complex sync logic for minimal benefit
- **Cost:** Separate server infrastructure

## Decision Criteria for Future Changes

When considering adding complexity back:

1. **User Demand:** Actual user requests for collaboration
2. **Usage Patterns:** Evidence of multi-user need
3. **Cost/Benefit:** Clear value proposition
4. **Implementation:** Gradual addition, not big bang

## Alternatives Considered

### 1. Remove Y.js Entirely
- **Pro:** Smaller bundle, simpler architecture
- **Con:** Lose excellent undo/redo, need custom implementation
- **Decision:** Keep Y.js for editor quality

### 2. Keep Sync Server for Persistence
- **Pro:** Centralized save logic
- **Con:** Extra infrastructure, over-engineered
- **Decision:** Move to client-side auto-save

### 3. Use Plain Text Storage
- **Pro:** Human readable, easier debugging
- **Con:** Lose rich text features, need conversion layer
- **Decision:** Keep Y.js binary format

### 4. Add Version History Now
- **Pro:** User feature, could be useful
- **Con:** Added complexity, not requested yet
- **Decision:** Wait for user demand (YAGNI)
