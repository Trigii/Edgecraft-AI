"use server";

import { prisma } from "@/lib/db";
import { getDefaultUser } from "@/lib/queries";
import { revalidatePath } from "next/cache";

export async function createStrategy(formData: FormData) {
  const user = await getDefaultUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.strategy.create({
    data: {
      userId: user.id,
      name,
      description: formData.get("description")?.toString() || null,
      playbook: formData.get("playbook")?.toString() || null,
      markets: formData.get("markets")?.toString() || null,
      timeframes: formData.get("timeframes")?.toString() || null,
      color: formData.get("color")?.toString() || "#7cf5b6",
    },
  });
  revalidatePath("/strategies");
}

export async function archiveStrategy(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.strategy.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/strategies");
}

export async function unarchiveStrategy(formData: FormData) {
  const id = String(formData.get("id"));
  await prisma.strategy.update({ where: { id }, data: { isArchived: false } });
  revalidatePath("/strategies");
}
