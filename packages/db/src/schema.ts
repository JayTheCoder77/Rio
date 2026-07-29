import { relations } from 'drizzle-orm';
import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubLogin: text('github_login').notNull().unique(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const installations = pgTable('installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  githubInstallationId: bigint('github_installation_id', { mode: 'number' }).notNull().unique(),
  accountLogin: text('account_login').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const repos = pgTable('repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  installationId: uuid('installation_id').notNull().references(() => installations.id),
  githubRepoId: bigint('github_repo_id', { mode: 'number' }).notNull().unique(),
  fullName: text('full_name').notNull(), // "org/repo"
  createdAt: timestamp('created_at').defaultNow().notNull(),
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

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
}));

export const installationsRelations = relations(installations, ({ many }) => ({
  repos: many(repos),
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