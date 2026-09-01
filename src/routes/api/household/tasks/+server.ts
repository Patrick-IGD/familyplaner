import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getDb } from "$lib/server/db";
import { household } from "$lib/server/db/schema";
import { householdTasks } from "$lib/server/modules/tasks/service";

// Öffentliche gemeinsame Aufgaben für den Haushaltsmodus (ohne Anmeldung):
// nur nicht-persönliche, nicht-archivierte Vorlagen des Haushalts.
// Vorlage personal => NICHT gemeinsam sichtbar (auch nicht ohne Marker).

export const GET: RequestHandler = async () => {
  const db = getDb();
  const [householdRow] = await db.select().from(household).limit(1);
  if (!householdRow) {
    return json({ error: "no household" }, { status: 404 });
  }
  const tasks = await householdTasks(householdRow.id);
  return json({
    tasks: tasks.filter(
      (task) => task.status !== "hidden" && task.title.length > 0,
    ),
  });
};
