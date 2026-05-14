"use server";

import { prisma } from "@/lib/db";
import { getDefaultUser, getActiveAccount, getTradesForAccount } from "@/lib/queries";
import { generateInsights } from "@/lib/insights/rules";
import { revalidatePath } from "next/cache";

export async function refreshInsights() {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);
  if (!account) return;
  const trades = await getTradesForAccount(account.id);
  const drafts = generateInsights(trades);

  // Wipe non-pinned rule-based insights for this user; recreate fresh.
  await prisma.insight.deleteMany({
    where: { userId: user.id, source: "rules", isPinned: false },
  });
  for (const d of drafts) {
    await prisma.insight.create({
      data: {
        userId: user.id,
        kind: d.kind,
        severity: d.severity,
        title: d.title,
        body: d.body,
        data: d.data ? JSON.stringify(d.data) : null,
        source: "rules",
      },
    });
  }
  revalidatePath("/insights");
}

export async function dismissInsight(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.insight.update({ where: { id }, data: { isDismissed: true } });
  revalidatePath("/insights");
}

export async function pinInsight(formData: FormData) {
  const id = String(formData.get("id"));
  const insight = await prisma.insight.findUnique({ where: { id } });
  await prisma.insight.update({
    where: { id },
    data: { isPinned: !(insight?.isPinned ?? false) },
  });
  revalidatePath("/insights");
}
