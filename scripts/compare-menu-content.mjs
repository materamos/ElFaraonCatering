import {
  createYamlMenuSnapshot,
  findFirstDifference,
  getMenuProjectionFromSnapshot,
  loadYamlMenuContent,
  menuIdsForComparison,
  normalizeMenuProjection,
} from "./menu-content-data.mjs";
import { loadSupabaseMenuSnapshot } from "./menu-content-supabase.mjs";

const yamlSnapshot = createYamlMenuSnapshot(await loadYamlMenuContent());
const supabaseSnapshot = await loadSupabaseMenuSnapshot();
const differences = [];

for (const menuId of menuIdsForComparison) {
  const yamlProjection = normalizeMenuProjection(
    getMenuProjectionFromSnapshot(yamlSnapshot, menuId),
  );
  const supabaseProjection = normalizeMenuProjection(
    getMenuProjectionFromSnapshot(supabaseSnapshot, menuId),
  );
  const difference = findFirstDifference(yamlProjection, supabaseProjection);

  if (difference) {
    differences.push(`${menuId}: ${difference}`);
  }
}

if (differences.length > 0) {
  console.error("Menu comparison failed:");

  for (const difference of differences) {
    console.error(`- ${difference}`);
  }

  process.exit(1);
}

console.log(`Menu comparison passed for ${menuIdsForComparison.join(", ")}.`);
