import { auth, signOut } from "@/auth";
import { createInstallState } from "@/lib/install-state";
import { redirect } from "next/navigation";

async function startInstall() {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const state = await createInstallState(session.user.id);
  const slug = process.env.GITHUB_APP_SLUG;

  redirect(`https://github.com/apps/${slug}/installations/new?state=${state}`);
}

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Signed in as: {session?.user?.name ?? "unknown"}</p>
      <p>Email: {session?.user?.email ?? "unknown"}</p>
      <p>User ID: {session?.user?.id ?? "unknown"}</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit">Sign out</button>
      </form>
      <form action={startInstall}>
        <button type="submit">Install Rio</button>
      </form>
    </div>
  );
}
