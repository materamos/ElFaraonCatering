import postgres from "postgres";
import {
  createSnapshot,
  loadRows,
} from "../src/utils/menuSupabaseSnapshot.mjs";
import { loadLocalEnv } from "./load-local-env.mjs";

const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");

loadLocalEnv();

export const loadSupabaseMenuSnapshot = async (
  databaseUrl = process.env[privateDatabaseUrlEnvName],
) => {
  if (!databaseUrl) {
    throw new Error("Private Supabase database URL is required to read menu content.");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    return createSnapshot(await loadRows(sql));
  } finally {
    await sql.end();
  }
};
