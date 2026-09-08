CREATE TYPE "public"."guideline_source" AS ENUM('rio_yml', 'imported');--> statement-breakpoint
CREATE TABLE "coding_guidelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"path_glob" text NOT NULL,
	"rule_text" text NOT NULL,
	"source" "guideline_source" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues_index" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"issue_number" bigint NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" text,
	"indexed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"path_glob" text,
	"pattern" text,
	"instruction" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_index" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"pr_number" bigint NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"head_sha" text,
	"indexed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coding_guidelines" ADD CONSTRAINT "coding_guidelines_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues_index" ADD CONSTRAINT "issues_index_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learnings" ADD CONSTRAINT "learnings_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_index" ADD CONSTRAINT "pr_index_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coding_guidelines_repo_id_idx" ON "coding_guidelines" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "issues_index_repo_id_idx" ON "issues_index" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_index_repo_issue_unique" ON "issues_index" USING btree ("repo_id","issue_number");--> statement-breakpoint
CREATE INDEX "learnings_repo_id_idx" ON "learnings" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "pr_index_repo_id_idx" ON "pr_index" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_index_repo_pr_unique" ON "pr_index" USING btree ("repo_id","pr_number");