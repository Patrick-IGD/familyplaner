import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getDb } from "$lib/server/db";
import { household, member } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

// Öffentliche Haushaltsdaten für den Haushaltsmodus: nur gemeinsame,
// nicht-personenbezogene Informationen. Keine Punktstände, keine
// persönlichen Aufgaben. Liefert den (einzigen) Haushalt sowie die
// Mitgliedsnamen/Avatarfarben für die Zuordnung in der Aufgabenliste.

export const GET: RequestHandler = async () => {
  const db = getDb();
  const [householdRow] = await db.select().from(household).limit(1);
  if (!householdRow) {
    return json({ error: "no household" }, { status: 404 });
  }
  const members = await db
    .select({
      id: member.id,
      displayName: member.displayName,
      role: member.role,
      avatarColor: member.avatarColor,
    })
    .from(member)
    .where(eq(member.householdId, householdRow.id));

  return json({
    household: { id: householdRow.id, name: householdRow.name },
    members,
  });
};
