Definitive Data Architecture: Europa Knowledge Platform
Last Updated: August 1, 2025
Author: Gemini Strategic AI
Status: Final Approved Architecture

1. Executive Summary & Core Principles
This document outlines the complete data architecture for the Europa Knowledge application. The design is a hybrid model engineered to meet three non-negotiable, foundational principles:

Local-First Operation: The application must be fully functional offline. The user's primary interaction is with data stored on their own device, ensuring speed and availability regardless of network connectivity.

Zero-Knowledge Privacy: All user-generated content must be protected with end-to-end encryption (E2EE). The server infrastructure will act as a zero-knowledge conduit and vault, incapable of decrypting or reading user data.

Durable & Seamless Sync: User data must be permanently and safely backed up on the server. It must sync seamlessly and without conflict across all of the user's devices.

To achieve these principles, we will implement a three-tiered data storage strategy, distributing responsibility between the client's memory, the client's disk, and the server's database.

2. The Three Layers of Data Storage
A user's document data exists simultaneously in three distinct layers, each optimized for a specific role.

Layer 1: The Live Layer (Client-Side Memory)
Technology: Y.js Document (Y.Doc)

Location: Browser RAM

Role: The "Source of Truth" for the Active Session. This is the high-speed, in-memory CRDT document that the Tiptap editor is directly bound to. All user keystrokes, formatting changes, and other edits are applied instantly to this object. Its primary function is to provide a fluid, zero-latency user experience and to generate the incremental updates required for synchronization.

Layer 2: The Offline Cache (Client-Side Disk)
Technology: sql.js (SQLite via WebAssembly)

Location: Browser's sandboxed storage (IndexedDB)

Role: High-Performance Offline Cache. This layer provides persistence between user sessions. Its sole responsibilities are to (a) load the document state into the in-memory Y.Doc on application startup for instant access, and (b) periodically save a snapshot of the Y.Doc's state back to disk. This layer is considered ephemeral; it is a convenience for performance, not a durable backup. It can be completely rebuilt from the server's backup if lost.

Layer 3: The Durable Backup (Server-Side Database)
Technology: PostgreSQL

Location: Secure server infrastructure (e.g., Hetzner Cloud, located in the EU).

Role: The Permanent, Encrypted, Zero-Knowledge Vault. This is the ultimate backup for all user data. It ensures that no data is ever lost, even if the user loses all their devices. The data is stored as an encrypted binary blob, making it unreadable by server administrators or any unauthorized party. PostgreSQL is chosen over file-based systems like SQLite for its proven scalability, concurrency, and robust operational tooling required for a production server environment.

3. The End-to-End Data Synchronization Flow
This flow details how a single change propagates through all three layers, ensuring data is updated, synced, and backed up simultaneously.

graph TD
    subgraph "User Device (Client)"
        direction TB
        Tiptap["Tiptap Editor UI"] --> YDoc
        subgraph "Data Management"
            direction LR
            YDoc[("Live Y.js Document<br/>(In-Memory)")]
            SQLite[("Offline SQLite Cache<br/>(On-Disk)")]
        end
    end

    subgraph "Our Server (EU)"
        direction TB
        NestServer["NestJS Sync Server<br/>(Zero-Knowledge)"]
        PostgresDB[("Durable PostgreSQL Vault<br/>(Encrypted Blobs)")]
        NestServer --> PostgresDB
    end

    YDoc -- "2. Encrypted Update Blob" --> NestServer
    NestServer -- "4. Encrypted Update Blob" --> YDoc
    YDoc -- "5. Periodic Snapshot" --> SQLite

Step-by-Step Process:

User Edit (Client): A user types a character in the Tiptap editor. The change is instantly applied to the in-memory Y.Doc.

Sync & Backup (Client → Server): The Y.Doc emits a tiny, incremental update blob containing only the new character data. This blob is encrypted on the client using a key the server never sees. The encrypted blob is sent via WebSocket to the NestJS server.

Durable Storage (Server): The NestJS server receives the encrypted blob. It authenticates the user, retrieves their current master encrypted document from PostgreSQL, applies the new update to it, and saves the resulting, slightly larger encrypted document back to PostgreSQL.

Real-time Sync (Server → Other Clients): The server broadcasts the same encrypted update blob it just received to all of the user's other connected devices (e.g., their mobile phone). Those devices decrypt the blob and apply the update to their own in-memory Y.Doc, causing their UI to update instantly.

Offline Persistence (Client): Independently and periodically (e.g., every few seconds), the client takes a complete snapshot of its in-memory Y.Doc, encrypts it, and saves it to the local SQLite database, overwriting the old cache entry.

4. Data Recovery & New Device Onboarding
This architecture robustly handles data loss from a cleared browser cache or when a user logs in on a new device.

Initial State: The client application starts with an empty local SQLite cache.

Authentication: The user logs in successfully.

Connection: The client establishes a secure WebSocket connection to the NestJS sync server.

Fetch Backup: The client requests the full document state. The server queries PostgreSQL for the user's latest complete encrypted document blob.

Transmission: The server sends this complete encrypted blob to the client.

Hydration: The client decrypts the blob locally. The resulting data is used to hydrate the in-memory Y.Doc, instantly restoring the user's entire document.

Cache Rebuilding: The client now saves this restored state to its local SQLite database, fully rebuilding the offline cache for future fast-loading sessions.

This ensures a seamless and secure user experience where data is never permanently lost.