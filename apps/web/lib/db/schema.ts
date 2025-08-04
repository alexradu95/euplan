import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  uuid,
  index,
} from "drizzle-orm/pg-core"

// Users table - stores account information (credentials-only, no external providers)
export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  hashedPassword: text("hashedPassword").notNull(), // Required for credential-based auth
})

// Removed accounts table - no external OAuth providers for privacy/security

// Sessions table - manages active user sessions
export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

// Verification tokens - for email verification, password resets
export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
)

// Documents table - stores user documents with HTML content
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Document"),
    content: text("content"), // HTML content from Tiptap editor
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
  },
  (documents) => ({
    userIdIdx: index("idx_documents_user_id").on(documents.userId),
    userIdUpdatedAtIdx: index("idx_documents_user_id_updated_at").on(documents.userId, documents.updatedAt),
    userIdCreatedAtIdx: index("idx_documents_user_id_created_at").on(documents.userId, documents.createdAt),
  })
)

// Removed documentAccess table - no longer needed for single-user documents
// All documents are owned by their creator (userId), no sharing/collaboration needed

// Dashboard configuration - stores widget layouts per period
export const dashboardConfigs = pgTable(
  "dashboard_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // 'daily', 'weekly', 'monthly'
    layout: text("layout").notNull(), // JSON string of widget layout configuration
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
  },
  (configs) => ({
    userIdPeriodIdx: index("idx_dashboard_configs_user_period").on(configs.userId, configs.period),
    userIdUpdatedAtIdx: index("idx_dashboard_configs_user_updated_at").on(configs.userId, configs.updatedAt),
  })
)

// Widget instances - individual widgets on dashboards
export const widgets = pgTable(
  "widgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => dashboardConfigs.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'periodic-note', 'tasks', 'habits', etc.
    position: text("position").notNull(), // JSON string of { x, y, w, h, minW, minH, etc }
    settings: text("settings"), // JSON string of widget-specific configuration
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
  },
  (widgets) => ({
    configIdIdx: index("idx_widgets_config_id").on(widgets.configId),
    userIdTypeIdx: index("idx_widgets_user_type").on(widgets.userId, widgets.type),
  })
)

// Widget data storage - encrypted content for each widget per period
export const widgetData = pgTable(
  "widget_data",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    widgetId: uuid("widget_id")
      .notNull()
      .references(() => widgets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodId: text("period_id").notNull(), // e.g., 'daily-2025-01-15', 'weekly-2025-01-13'
    data: text("data"), // Encrypted JSON string of widget content
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
  },
  (data) => ({
    widgetPeriodIdx: index("idx_widget_data_widget_period").on(data.widgetId, data.periodId),
    userIdPeriodIdx: index("idx_widget_data_user_period").on(data.userId, data.periodId),
    widgetIdUpdatedAtIdx: index("idx_widget_data_widget_updated_at").on(data.widgetId, data.updatedAt),
  })
)