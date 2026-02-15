import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  customType,
} from "drizzle-orm/pg-core";

// Custom type for pgvector embeddings (1536 dimensions)
const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string) {
    const trimmed = value.trim().replace(/^\[/, "").replace(/\]$/, "");
    return trimmed ? trimmed.split(",").map((v) => Number(v.trim())) : [];
  },
});

// Agent context table — stores search parameters for each search request
export const agentCtx = pgTable("agent_ctx", {
  id: uuid("id").primaryKey().defaultRandom(),
  origin: varchar("origin", { length: 10 }).notNull(),
  destination: varchar("destination", { length: 10 }).notNull(),
  departureDate: date("departure_date").notNull(),
  returnDate: date("return_date"),
  cabinClass: varchar("cabin_class", { length: 20 }).default("economy"),
  directOnly: boolean("direct_only").default(false),
  llmProvider: varchar("llm_provider", { length: 20 }).default("ollama"),
  llmModel: varchar("llm_model", { length: 50 }).default("qwen3:8b"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Agent state table — tracks execution status of each search
export const agentState = pgTable("agent_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentCtxId: uuid("agent_ctx_id")
    .notNull()
    .references(() => agentCtx.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Memory table — stores agent reasoning steps with vector embeddings for semantic search
export const memory = pgTable("memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentCtxId: uuid("agent_ctx_id").references(() => agentCtx.id, {
    onDelete: "cascade",
  }),
  content: text("content").notNull(),
  embedding: vector1536("embedding"),
  stepNumber: integer("step_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Flight results table — stores extracted flight data
export const flightResults = pgTable("flight_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentCtxId: uuid("agent_ctx_id")
    .notNull()
    .references(() => agentCtx.id, { onDelete: "cascade" }),
  airline: varchar("airline", { length: 100 }),
  departureTime: timestamp("departure_time", { withTimezone: true }),
  arrivalTime: timestamp("arrival_time", { withTimezone: true }),
  duration: varchar("duration", { length: 20 }),
  stops: integer("stops").default(0),
  price: numeric("price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  flightUrl: text("flight_url"),
  rawData: jsonb("raw_data"),
  verified: boolean("verified").default(false),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
