"use server";

import { prisma } from "@/lib/db";
import { getDefaultUser } from "@/lib/queries";
import { revalidatePath } from "next/cache";

export async function updateSettings(formData: FormData) {
  const user = await getDefaultUser();
  await prisma.settings.update({
    where: { userId: user.id },
    data: {
      baseCurrency: String(formData.get("baseCurrency") ?? "USD"),
      riskPerTradePct: Number(formData.get("riskPerTradePct") ?? 1),
      maxDailyLossPct: Number(formData.get("maxDailyLossPct") ?? 3),
      maxOpenTrades: Number(formData.get("maxOpenTrades") ?? 5),
      minRiskReward: Number(formData.get("minRiskReward") ?? 1.5),
      enforcePreTradeChecklist: formData.get("enforcePreTradeChecklist") === "on",
      tiltDetectionEnabled: formData.get("tiltDetectionEnabled") === "on",
      overtradingThreshold: Number(formData.get("overtradingThreshold") ?? 5),
      aiEnabled: formData.get("aiEnabled") === "on",
      defaultTimezone: String(formData.get("defaultTimezone") ?? "UTC"),
    },
  });
  revalidatePath("/settings");
}

export async function createAccount(formData: FormData) {
  const user = await getDefaultUser();
  await prisma.account.create({
    data: {
      userId: user.id,
      name: String(formData.get("name") ?? "My account"),
      broker: formData.get("broker")?.toString() || null,
      accountType: String(formData.get("accountType") ?? "live"),
      assetFocus: String(formData.get("assetFocus") ?? "mixed"),
      currency: String(formData.get("currency") ?? "USD"),
      initialBalance: Number(formData.get("initialBalance") ?? 10000),
      leverage: Number(formData.get("leverage") ?? 1),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function setActiveAccount(formData: FormData) {
  const user = await getDefaultUser();
  const id = String(formData.get("id"));
  await prisma.account.updateMany({
    where: { userId: user.id },
    data: { isActive: false },
  });
  await prisma.account.update({ where: { id }, data: { isActive: true } });
  revalidatePath("/");
}
