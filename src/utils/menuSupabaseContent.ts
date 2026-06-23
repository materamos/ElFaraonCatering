import postgres from "postgres";
import type {
  MenuContentSnapshot,
} from "../types/menu";
import { getSafeMenuImagePaths } from "./menuImagePath.mjs";
import { createSnapshot, loadRows } from "./menuSupabaseSnapshot.mjs";

export const loadSupabaseMenuContentSnapshot = async (): Promise<MenuContentSnapshot> => {
  const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");
  const databaseUrl = getPrivateEnvironmentValue(privateDatabaseUrlEnvName);

  if (!databaseUrl) {
    throw new Error(
      "Private Supabase database URL is required for build-time menu content.",
    );
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    const rows = await loadRows(sql);
    const snapshot = createSnapshot(rows, {
      transformImages: getSafeMenuImagePaths,
    });

    assertMenuContentSnapshot(snapshot);

    return snapshot;
  } finally {
    await sql.end();
  }
};

export const loadSupabaseMenuPublicationContentHash = async (): Promise<string> => {
  const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");
  const databaseUrl = getPrivateEnvironmentValue(privateDatabaseUrlEnvName);

  if (!databaseUrl) {
    throw new Error(
      "Private Supabase database URL is required for build-time publication state.",
    );
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    const rows = await sql`
      select app_private.get_menu_publication_content_hash() as menu_content_hash
    `;
    const hash = rows[0]?.menu_content_hash;

    if (typeof hash !== "string" || !/^[a-f0-9]{32}$/.test(hash)) {
      throw new Error("Build-time menu content hash is invalid.");
    }

    return hash;
  } finally {
    await sql.end();
  }
};

const getPrivateEnvironmentValue = (name: string): string | undefined =>
  (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[name];

function assertMenuContentSnapshot(value: unknown): asserts value is MenuContentSnapshot {
  if (!isRecord(value)) {
    throw new Error("Supabase menu snapshot must be an object.");
  }

  if (
    !Array.isArray(value.profiles) ||
    !Array.isArray(value.catalogSections) ||
    !isRecord(value.dailyMenu) ||
    !Array.isArray(value.dailyMenu.items) ||
    !Array.isArray(value.profileServiceSettings) ||
    !isRecord(value.grillSection) ||
    !Array.isArray(value.grillSection.items)
  ) {
    throw new Error("Supabase menu snapshot has an invalid shape.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
