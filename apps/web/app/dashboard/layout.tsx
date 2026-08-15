import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  return (
    <DashboardShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      onSignOut={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      {children}
    </DashboardShell>
  );
}
