"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { setUserModelCredential, clearUserModelCredential } from "@rio/db";
import { encryptProviderKey, providerKeySuffix } from "@/lib/model-credentials";

export async function saveModelCredentialAction(
  _prevState: { error: string | null; success: boolean },
  formData: FormData
): Promise<{ error: string | null; success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const provider = String(formData.get("provider") ?? "");
  const modelName = String(formData.get("model") ?? "").trim();
  const apiKey = String(formData.get("api_key") ?? "").trim();

  if (provider !== "groq" && provider !== "openrouter") {
    return { error: "Choose a provider.", success: false };
  }
  if (!modelName) {
    return { error: "Model name is required.", success: false };
  }
  if (!apiKey) {
    return { error: "API key is required.", success: false };
  }

  await setUserModelCredential({
    userId: session.user.id,
    provider,
    modelName,
    apiKeyEncrypted: encryptProviderKey(apiKey),
    lastFour: providerKeySuffix(apiKey),
  });

  revalidatePath("/dashboard/settings");
  return { error: null, success: true };
}

export async function disconnectModelCredentialAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await clearUserModelCredential(session.user.id);
  revalidatePath("/dashboard/settings");
}
