import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// Auth schema
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

// Waitlist Schema
export const waitlist = pgTable("waitlist", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Rate Limiting Schema
export const rateLimitAttempts = pgTable("rate_limit_attempts", {
  identifier: text("identifier").primaryKey(), // e.g., IP address
  count: integer("count").notNull().default(1),
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
});

// Room Schema
export const room = pgTable("room", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
  joinCode: text("join_code").notNull(),
  requireAccessBeforeJoining: boolean("require_access_before_joining")
    .notNull()
    .default(false),
  users: jsonb("users").notNull().default([]),
});

export const roomUser = pgTable("room_user", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => room.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  isMicActive: boolean("is_mic_active").notNull().default(false),
  isCamActive: boolean("is_cam_active").notNull().default(false),
  isShareScreen: boolean("is_share_screen").notNull().default(false),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

// Contact Request Status Enum
export const contactRequestStatusEnum = pgEnum("contact_request_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const contactRequests = pgTable(
  "contact_requests",
  {
    id: text("id").primaryKey(),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    receiverEmail: text("receiver_email").notNull(),
    receiverId: text("receiver_id")
      .references(() => user.id, { onDelete: "cascade" }),
    status: contactRequestStatusEnum("status").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Indexes for fast lookup
    index("contact_requests_sender_id_idx").on(table.senderId),
    index("contact_requests_receiver_email_idx").on(table.receiverEmail),
    index("contact_requests_receiver_id_idx").on(table.receiverId),
  ]
);

export const contacts = pgTable(
  "contacts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Composite primary key for uniqueness
    index("contacts_user_id_idx").on(table.userId),
    index("contacts_contact_id_idx").on(table.contactId),
  ]
);

// Team Schema
export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("teams_creator_id_idx").on(table.creatorId),
  ]
);


export const teamMembers = pgTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [

    index("team_members_team_id_idx").on(table.teamId),
    index("team_members_user_id_idx").on(table.userId),
    index("team_members_team_user_idx").on(table.teamId, table.userId),
  ]
);

// Call Invitation Status Enum
export const callInvitationStatusEnum = pgEnum("call_invitation_status", [
  "pending",
  "accepted",
  "rejected",
]);

// Calls Table
export const calls = pgTable(
  "calls",
  {
    id: text("id").primaryKey(), // 6-char code generado manualmente
    name: text("name").notNull(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("calls_creator_id_idx").on(table.creatorId),
  ]
);

// Call Invitations Table
export const callInvitations = pgTable(
  "call_invitations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    callId: text("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    inviteeId: text("invitee_id")
      .references(() => user.id, { onDelete: "set null" }),
    inviteeEmail: text("invitee_email").notNull(),
    status: callInvitationStatusEnum("status").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("call_invitations_call_id_idx").on(table.callId),
    index("call_invitations_invitee_id_idx").on(table.inviteeId),
  ]
);

// Notifications Table
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    callId: text("call_id")
      .references(() => calls.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
  ]
);

const schema = {
  user,
  session,
  account,
  verification,
  waitlist,
  rateLimitAttempts,
  room,
  contactRequests,
  contacts,
  teams,
  teamMembers,
  calls,
  callInvitations,
  notifications,
};

export default schema;
