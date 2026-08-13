import { relations } from 'drizzle-orm';
import { bigint, index, pgTable, text, timestamp, uuid, integer, primaryKey, boolean, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from "@auth/core/adapters"

export const findingSeverity = pgEnum('finding_severity', [
  "critical",
  "warning",
  "info",
]);

export const reviewStatus = pgEnum('review_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  name: text('name'),
  image: text('image'),
  emailVerified: timestamp('email_verified'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({
      columns: [table.provider,
      table.providerAccountId],
    }),
  ]
)

export const installations = pgTable('installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubInstallationId: bigint('github_installation_id', { mode: 'number' }).notNull().unique(),
  accountLogin: text('account_login').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const userInstallations = pgTable('user_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  installationId: uuid('installation_id').notNull().references(() => installations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_installations_user_installation_unique').on(table.userId, table.installationId),
  index('user_installations_installation_id_idx').on(table.installationId),
])


export const repos = pgTable('repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id').notNull().references(() => installations.id),
  githubRepoId: bigint('github_repo_id', { mode: 'number' }).notNull().unique(),
  fullName: text('full_name').notNull(), // "org/repo"
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at')
}, (table) => [
  index('repos_installation_id_idx').on(table.installationId),
]);

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  keyHash: text('key_hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('api_keys_user_id_idx').on(table.userId),
]);

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  repoId: uuid('repo_id').notNull().references(() => repos.id),
  prNumber: bigint('pr_number', { mode: 'number' }).notNull(),
  headSha: text('head_sha').notNull(),
  status: reviewStatus('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('reviews_repo_id_idx').on(table.repoId),
  uniqueIndex('reviews_repo_head_unique').on(table.repoId, table.headSha),
]);

export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').notNull().references(() => reviews.id),
  file: text('file').notNull(),
  line: bigint('line', { mode: 'number' }).notNull(),
  severity: findingSeverity('severity').notNull(),
  message: text('message').notNull(),
  rationale: text('rationale').notNull(),
  resolved: boolean('resolved').default(false).notNull(),
}, (table) => [
  index('findings_review_id_idx').on(table.reviewId),
]);

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  userInstallations: many(userInstallations),
  accounts: many(accounts),
}));

export const installationsRelations = relations(installations, ({ many }) => ({
  repos: many(repos),
  userInstallations: many(userInstallations),
}));

export const reposRelations = relations(repos, ({ one }) => ({
  installation: one(installations, {
    fields: [repos.installationId],
    references: [installations.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  repo: one(repos, {
    fields: [reviews.repoId],
    references: [repos.id],
  }),
  findings: many(findings),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  review: one(reviews, {
    fields: [findings.reviewId],
    references: [reviews.id],
  }),
}));

export const userInstallationsRelations =
  relations(userInstallations, ({ one }) => ({
    user: one(users, {
      fields: [userInstallations.userId],
      references: [users.id],
    }),
    installation: one(installations, {
      fields: [userInstallations.installationId],
      references: [installations.id],
    }),
  }));

export const accountsRelations = relations(accounts,
  ({ one }) => ({
    user: one(users, {
      fields: [accounts.userId],
      references: [users.id],
    }),
  }));