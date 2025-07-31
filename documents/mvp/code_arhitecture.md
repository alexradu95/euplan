graph TD
    subgraph "User Interaction"
        User
    end

    subgraph "Cloud Infrastructure"
        Vercel[Vercel Hosting]
        Hetzner[Hetzner/Scaleway Cloud<br/>(Docker)]
        AuthDB[(Auth Database<br/>PostgreSQL)]
    end

    subgraph "Development & CI/CD"
        GitHub[GitHub Repository<br/>(Source Code + Actions)]
    end

    subgraph "Monorepo: euplan (pnpm + Turborepo)"
        direction LR
        subgraph "apps"
            WebApp[web<br/>(Next.js + Auth.js + WebLLM)]
            SyncServer[sync-server<br/>(NestJS WebSocket)]
            MobileApp[mobile<br/>(React Native + Expo + MLC-LLM)]
        end
        subgraph "packages"
            CorePkg[core<br/>(Y.js, Zod Schemas, Crypto)]
            UIPkg[ui<br/>(Shared React Web Components)]
            TSConfigPkg[tsconfig<br/>(Shared TS Configs)]
            ESLintPkg[eslint-config<br/>(Shared Linting Rules)]
        end
    end

    %% Define Connections and Data Flows

    %% User to Applications
    User -- HTTPS Browser Session --> WebApp
    User -- Native App Usage --> MobileApp

    %% Application to Backend Services
    WebApp -- REST API for Auth --> AuthDB
    WebApp -- WSS (E2EE Blobs) --> SyncServer
    MobileApp -- WSS (E2EE Blobs) --> SyncServer

    %% Monorepo Internal Dependencies
    WebApp --- consumes ---> CorePkg
    WebApp --- consumes ---> UIPkg
    WebApp --- extends ---> TSConfigPkg
    WebApp --- extends ---> ESLintPkg

    MobileApp --- consumes ---> CorePkg
    MobileApp --- extends ---> TSConfigPkg
    MobileApp --- extends ---> ESLintPkg

    SyncServer --- consumes ---> CorePkg
    SyncServer --- extends ---> TSConfigGPT-Crawler
    SyncServer --- extends ---> ESLintPkg

    %% Deployment Pipeline (CI/CD)
    GitHub -- Push to main --> Vercel
    GitHub -- Push to main --> Hetzner
    Vercel -- Deploys --> WebApp
    Hetzner -- Deploys --> SyncServer
    Hetzner -- connects to --> AuthDB

    classDef app fill:#D9EAD3,stroke:#333,stroke-width:2px;
    classDef package fill:#FFF2CC,stroke:#333,stroke-width:2px;
    classDef cloud fill:#C9DAF8,stroke:#333,stroke-width:2px;
    classDef user fill:#F4CCCC,stroke:#333,stroke-width:2px;

    class User user
    class WebApp,MobileApp,SyncServer app
    class CorePkg,UIPkg,TSConfigPkg,ESLintPkg package
    class Vercel,Hetzner,AuthDB,GitHub cloud