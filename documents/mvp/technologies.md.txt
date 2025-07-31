-----

### **Architectural Blueprint: Privacy-First Knowledge Platform**

**Date:** July 31, 2025
**Author:** Gemini Strategic AI
**Target:** A high-performance, privacy-first, cross-platform knowledge management application.

### 1\. Core Philosophy

Every technical decision will be anchored to these three principles:

1.  **Local-First:** The application must be 100% functional offline. The network is for synchronization, not operation.
2.  **Privacy-by-Design:** All user content is end-to-end encrypted (E2EE). The server is a zero-knowledge conduit. We cannot read user data, even if we wanted to.
3.  **Performance-Centric:** The user experience must be instantaneous. Every interaction, from app launch to data sync, should feel fluid and responsive.

### 2\. The Monorepo Structure

We will use a monorepo to manage our entire codebase. This simplifies dependency management, promotes code sharing, and streamlines our development and deployment processes.

**Tooling:**

  * **Package Manager:** `pnpm` - For its speed and efficient handling of disk space with shared dependencies.
  * **Build System:** `Turborepo` - For high-performance build caching and task orchestration across the monorepo.

**Directory Structure:**

```
europa-knowledge/
├── apps/
│   ├── web/            # The Next.js web application (The main product)
│   ├── mobile/         # The React Native (Expo) mobile app
│   └── sync-server/    # The NestJS real-time sync service
│
├── packages/
│   ├── core/           # CRITICAL: Shared business logic, types, schemas, crypto
│   ├── ui/             # Shared React WEB components (Buttons, Modals, etc.)
│   ├── eslint-config/  # Centralized ESLint configuration
│   └── tsconfig/       # Centralized TypeScript base configurations
│
├── package.json
├── pnpm-workspace.yaml
└── turborepo.json
```

-----

### 3\. Application & Package Breakdown

#### **`apps/web` - The Primary Web Application**

  * **Technology:** Next.js 14+ (App Router), React 19, TypeScript.
  * **Responsibilities:**
      * The entire user-facing web experience.
      * User authentication (login, registration) using `Auth.js`.
      * Rendering the `Tiptap.dev` editor.
      * Integrating the **`WebLLM`** engine for local AI features.
      * Handling all client-side encryption/decryption of user data.
      * Connecting to the `sync-server` via WebSockets to send/receive data.
      * Using Server Components to fetch non-sensitive account data (e.g., subscription status).

#### **`apps/sync-server` - The Zero-Knowledge Sync Service**

  * **Technology:** NestJS 10+, WebSocket API (`Gateways`), TypeScript.
  * **Responsibilities:**
      * Its **ONLY** job is to manage persistent WebSocket connections.
      * It will authenticate users based on a JWT provided upon connection.
      * It manages "rooms" based on user ID, ensuring users only receive their own data.
      * It receives encrypted binary blobs from one client and broadcasts them to all other authenticated clients for that same user.
      * **It does not persist, decrypt, or process any user content.** It is a stateless and zero-knowledge message broker.

#### **`apps/mobile` - The Mobile Companion**

  * **Technology:** React Native with Expo (SDK 53+).
  * **Responsibilities:**
      * Provide a native mobile experience for accessing and editing notes.
      * It will **not** share UI code with `apps/web` but will consume the `packages/core` for all logic.
      * Implement client-side encryption/decryption, identical to the web app.
      * Connect to the same `sync-server` to sync data.
      * Integrate **`MLC-LLM`** for on-device AI features.

#### **`packages/core` - The Shared Brain**

  * This is the most critical package for ensuring consistency. It will be consumed by `web`, `mobile`, and potentially `sync-server`.
  * **Contents:**
      * **`Y.js` Schemas:** The definition of your document structure.
      * **`Zod` Schemas:** For robust data validation across the stack.
      * **TypeScript Types:** A single source of truth for all data models.
      * **Crypto Utilities:** Standardized functions for encryption (`SubtleCrypto` via Web Crypto API) and decryption.
      * **Constants:** Shared constants like API URLs or event names.

#### **`packages/ui` - The Web Design System**

  * **Technology:** React, Tailwind CSS, `cva`, Storybook.
  * **Responsibilities:**
      * Contains reusable UI components (`Button`, `Modal`, `Input`, `Card`, etc.) for the **web application only**.
      * This ensures a consistent look and feel across the Next.js app. It will be built using `Shadcn/ui` patterns.

-----

### 4\. Data Flow: The End-to-End Encryption & Sync Story

This flow is the heart of our privacy promise.

1.  **User Action:** A user types a character in the `Tiptap` editor within the `apps/web` browser window.
2.  **Local Update:** `Tiptap` updates its internal state, which in turn updates the shared `Y.js` document (`Y.Doc`).
3.  **Capture Change:** A `Y.js` event listener captures this change as a small, binary `update` blob.
4.  **Client-Side Encryption:** This `update` blob is encrypted on the user's device using a symmetric key derived from their password via PBKDF2 (the key is held only in memory).
5.  **Transmit:** The **encrypted blob** is sent via a WebSocket connection to the `sync-server`.
6.  **Broadcast:** The `sync-server` authenticates the message's origin, identifies the user's "room," and broadcasts the encrypted blob to all other clients in that room (e.g., the user's logged-in mobile phone).
7.  **Receive & Decrypt:** The `apps/mobile` client receives the encrypted blob, decrypts it using the same key (which it would have derived upon login), and applies the binary `update` to its local `Y.js` document.
8.  **UI Update:** The React Native UI, being reactive to changes in the `Y.js` document, updates to show the new character instantly.

### 5\. Authentication & Authorization

  * **Provider:** `Auth.js` (v5+) will be used within the Next.js app.
  * **Flow:**
    1.  User signs up with email/password. The password is **hashed with Argon2** and stored in the database. A **unique salt** is used for each user.
    2.  User logs in. Upon success, an `httpOnly` cookie containing a **JWT** is issued.
    3.  This JWT will be used to authenticate API requests to the Next.js backend and will be sent as the authentication token when opening the WebSocket connection to the `sync-server`.
    4.  The encryption key is **never sent to the server**. It is derived from the user's password on the client at login time and kept in memory.

### 6\. Development and Deployment Strategy (CI/CD)

  * **Source Control:** GitHub.
  * **CI/CD:** GitHub Actions.
  * **Deployment Targets:**
      * `apps/web` -\> **Vercel**. It's built for Next.js and offers the best performance and developer experience.
      * `apps/sync-server` -\> **Hetzner Cloud** or **Scaleway** (as a Docker container). This ensures EU data residency for our infrastructure.
      * `apps/mobile` -\> **Expo Application Services (EAS) Build**. To build and submit to the App Store and Play Store.
  * **Workflows:**
      * **On Pull Request:** Automatically run linting, type-checking, and unit tests on *affected* packages (`pnpm test --filter...`).
      * **On Merge to `main`:** Trigger deployment workflows for the respective applications.

### 7\. First 8 Weeks: MVP Development Plan

  * **Week 1:** Monorepo Setup. Initialize Turborepo, pnpm, and all the app/package skeletons. Configure shared ESLint/TypeScript. Get "Hello World" running and deploying for `web` and `sync-server`.
  * **Weeks 2-3:** Core Document & Editor. Define the initial `Y.js` and `Zod` schemas in `packages/core`. Implement the `Tiptap` editor in `apps/web`. The user should be able to create and edit a local, non-synced document.
  * **Weeks 4-5:** Authentication. Integrate `Auth.js`. Users should be able to sign up, log in, and log out. Create protected pages.
  * **Weeks 6-8:** The Magic Sync Loop. Build the basic NestJS WebSocket server. Connect the web app to it. Implement the E2EE data flow. **Goal:** A character typed in one browser tab appears instantly in another logged-in tab. This validates the entire core architecture.