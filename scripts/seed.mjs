// Seed: Beispielhaushalt mit zwei Erwachsenen, zwei Kindern,
// Beispiel-Aufgaben und Belohnungen. PINs sind Start-PINs und
// müssen nach dem ersten Start geändert werden.
import { Pool } from "pg";
import { hashPin } from "../src/lib/server/modules/identity/crypto.ts";

const databaseUrl = process.env.FAMILYPLANNER_DATABASE_URL;
if (!databaseUrl) {
  console.error("missing FAMILYPLANNER_DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query("begin");

  const existing = await client.query("select id from household limit 1");
  if (existing.rowCount > 0) {
    console.log(
      JSON.stringify({ event: "seed_skipped", reason: "household exists" }),
    );
    await client.query("rollback");
  } else {
    const household = await client.query(
      "insert into household (name) values ('Beispielhaushalt') returning id",
    );
    const householdId = household.rows[0].id;

    const members = [
      { name: "Erwachsener A", role: "adult", color: "#ffd9a8", pin: "1111" },
      { name: "Erwachsene B", role: "adult", color: "#cfd8ff", pin: "2222" },
      { name: "Kind 1", role: "child", color: "#ffb3c1", pin: "1234" },
      { name: "Kind 2", role: "child", color: "#b3e5fc", pin: "5678" },
    ];

    const memberIds = {};
    for (const m of members) {
      const result = await client.query(
        "insert into member (household_id, display_name, role, avatar_color) values ($1, $2, $3, $4) returning id",
        [householdId, m.name, m.role, m.color],
      );
      memberIds[m.name] = result.rows[0].id;
      if (m.pin) {
        await client.query(
          "insert into child_credential (member_id, pin_hash) values ($1, $2)",
          [result.rows[0].id, hashPin(m.pin)],
        );
      }
    }

    const templates = [
      {
        title: "Tisch decken",
        points: 1,
        recurrence: "daily",
        pool: false,
        assignee: "Kind 1",
      },
      {
        title: "Spülmaschine ein- oder ausräumen",
        points: 3,
        recurrence: "daily",
        pool: true,
        assignee: null,
      },
      {
        title: "Zimmer aufräumen",
        points: 5,
        recurrence: "weekly",
        pool: false,
        assignee: "Kind 2",
      },
    ];

    const today = new Date();
    const due = (daysFromNow) => {
      const d = new Date(today);
      d.setDate(d.getDate() + daysFromNow);
      return d.toISOString();
    };

    for (const t of templates) {
      const result = await client.query(
        `insert into task_template (household_id, title, point_value, rewarded, recurrence, pool_task)
         values ($1, $2, $3, true, $4, $5) returning id`,
        [householdId, t.title, t.points, t.recurrence, t.pool],
      );
      const occurrence = await client.query(
        "insert into task_occurrence (template_id, due_date) values ($1, $2) returning id",
        [result.rows[0].id, due(0)],
      );
      const assigneeId = t.assignee ? memberIds[t.assignee] : null;
      if (assigneeId) {
        await client.query(
          "insert into task_assignment (occurrence_id, member_id) values ($1, $2)",
          [occurrence.rows[0].id, assigneeId],
        );
      }
    }

    const rewards = [
      { title: "Kinoabend", cost: 20 },
      { title: "1 Stunde Switch-Zeit", cost: 10 },
      { title: "1 Stunde Tablet-Zeit", cost: 8 },
    ];
    for (const r of rewards) {
      await client.query(
        "insert into reward (household_id, title, point_cost) values ($1, $2, $3)",
        [householdId, r.title, r.cost],
      );
    }

    await client.query("commit");
    console.log(
      JSON.stringify({
        event: "seed_complete",
        householdId,
        members: Object.keys(memberIds).length,
        startPins: {
          "Erwachsener A": "1111",
          "Erwachsene B": "2222",
          "Kind 1": "1234",
          "Kind 2": "5678",
        },
      }),
    );
  }
} catch (error) {
  await client.query("rollback");
  console.error(
    JSON.stringify({
      event: "seed_failed",
      error: String(error.message ?? error),
    }),
  );
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
