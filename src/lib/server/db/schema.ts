// Kern-Datenmodell des Familienplaners (PLAN.md Abschnitt 7).
// Fachliche Zeitpunkte als UTC-Instant (timestamptz).

import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const household = pgTable("household", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const member = pgTable("member", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(), // 'adult' | 'child'
  avatarColor: text("avatar_color").notNull().default("#cfe3d8"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const childCredential = pgTable("child_credential", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => member.id, { onDelete: "cascade" }),
  pinHash: text("pin_hash").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export const deviceSession = pgTable("device_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Aufgaben ---

export const taskTemplate = pgTable("task_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  pointValue: smallint("point_value").notNull().default(0), // 0, 1, 3 oder 5
  rewarded: boolean("rewarded").notNull().default(false),
  recurrence: text("recurrence").notNull().default("once"), // 'once' | 'daily' | 'weekly'
  poolTask: boolean("pool_task").notNull().default(false),
  personal: boolean("personal").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskOccurrence = pgTable("task_occurrence", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => taskTemplate.id, { onDelete: "cascade" }),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'reported' | 'confirmed' | 'rejected' | 'missed'
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskAssignment = pgTable(
  "task_assignment",
  {
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => taskOccurrence.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.occurrenceId, table.memberId] })],
);

export const completionReport = pgTable("completion_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  occurrenceId: uuid("occurrence_id")
    .notNull()
    .references(() => taskOccurrence.id, { onDelete: "cascade" }),
  reportedBy: uuid("reported_by")
    .notNull()
    .references(() => member.id),
  reportedAt: timestamp("reported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const completionDecision = pgTable("completion_decision", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => completionReport.id, { onDelete: "cascade" }),
  decidedBy: uuid("decided_by")
    .notNull()
    .references(() => member.id),
  decision: text("decision").notNull(), // 'confirmed' | 'rejected'
  reason: text("reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Motivation ---

export const reward = pgTable("reward", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  pointCost: integer("point_cost").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const redemptionRequest = pgTable("redemption_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  rewardId: uuid("reward_id")
    .notNull()
    .references(() => reward.id, { onDelete: "cascade" }),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => member.id),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled'
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Append-only Ledger: Beitragspunkte und Einlösungen (ADR-0006).
export const pointLedgerEntry = pgTable("point_ledger_entry", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => household.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => member.id),
  kind: text("kind").notNull(), // 'grant' | 'reserve' | 'release' | 'spend' | 'correction'
  amount: integer("amount").notNull(), // positiv oder negativ, Summe >= 0 pro Mitglied
  referenceType: text("reference_type").notNull(), // 'task_occurrence' | 'redemption_request' | 'correction'
  referenceId: text("reference_id").notNull(), // polymorphe ID (uuid oder Correlations-ID)
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pointBalanceProjection = pgTable("point_balance_projection", {
  memberId: uuid("member_id")
    .primaryKey()
    .references(() => member.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Audit ---

export const auditEvent = pgTable("audit_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").references(() => household.id, {
    onDelete: "cascade",
  }),
  actorId: uuid("actor_id").references(() => member.id),
  action: text("action").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
