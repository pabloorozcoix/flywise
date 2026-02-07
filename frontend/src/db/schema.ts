import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
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

// Agent context table — defines an agent's configuration
export const agentCtx = pgTable("agent_ctx", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentName: text("agent_name").notNull(),
  agentRole: text("agent_role").notNull(),
  goalTitle: text("goal_title").notNull(),
  goalSystemPrompt: text("goal_system_prompt").notNull(),
  model: text("model").notNull(),
  modelTemperature: numeric("model_temperature").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Agent state table — tracks individual runs
export const agentState = pgTable("agent_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentCtxId: uuid("agent_ctx_id").references(() => agentCtx.id),
  iterationsCompleted: integer("iterations_completed").notNull(),
  tokensUsed: integer("tokens_used").notNull(),
  status: text("status"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Memory table — stores agent memory with vector embeddings for semantic search
export const memory = pgTable("memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentStateId: uuid("agent_state_id").references(() => agentState.id),
  text: text("text").notNull(),
  embedding: vector1536("embedding"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Flight results table — stores extracted flight data
export const flightResults = pgTable("flight_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  searchId: uuid("search_id").notNull(),
  airline: text("airline").notNull(),
  flightNumber: text("flight_number"),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  departureTime: timestamp("departure_time", { withTimezone: true }).notNull(),
  arrivalTime: timestamp("arrival_time", { withTimezone: true }).notNull(),
  duration: text("duration"),
  stops: integer("stops").notNull().default(0),
  price: numeric("price"),
  currency: text("currency").default("USD"),
  cabinClass: text("cabin_class"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
