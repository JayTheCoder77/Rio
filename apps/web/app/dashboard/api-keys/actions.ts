"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createApiKey, revokeApiKey } from "@rio/db";
import { generateApiKey, keySuffix } from "@/lib/api-keys";

export async function createApiKeyAction(
  _prevState: { plaintext: string | null; error: string | null },
  formData: FormData
): Promise<{ plaintext: string | null; error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { plaintext: null, error: "Name is required." };
  }

  const { plaintext, hash } = generateApiKey();

  await createApiKey({
    userId: session.user.id,
    name,
    keyHash: hash,
    lastFour: keySuffix(plaintext),
  });

  revalidatePath("/dashboard/api-keys");
  return { plaintext, error: null };
}

export async function revokeApiKeyAction(keyId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await revokeApiKey({ userId: session.user.id, keyId });
  revalidatePath("/dashboard/api-keys");
}
