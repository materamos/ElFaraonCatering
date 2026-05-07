import postgres from "postgres";
import type {
  MenuCatalogSectionData,
  MenuDailyMenuData,
  MenuItemsSectionData,
  MenuProfileData,
  MenuProfileServiceSettings,
} from "../types/menu";
import { getSafeMenuImagePath } from "./menuImage";
import { createSnapshot, loadRows } from "./menuSupabaseSnapshot.mjs";

interface MenuProfileRecord {
  id: string;
  data: MenuProfileData;
}

interface MenuContentSnapshot {
  profiles: MenuProfileRecord[];
  catalogSections: MenuCatalogSectionData[];
  dailyMenu: MenuDailyMenuData;
  profileServiceSettings: MenuProfileServiceSettings[];
  grillSection: MenuItemsSectionData;
}

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

    return createSnapshot(rows, {
      transformImage: getSafeMenuImagePath,
    }) as MenuContentSnapshot;
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
