import postgres from "postgres";
import {
  insertTableOrder,
  loadYamlMenuContent,
  projectStructuralRows,
  structuralTableNames,
} from "./menu-content-data.mjs";

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const isDryRun = !shouldApply || args.has("--dry-run");

if (shouldApply && args.has("--dry-run")) {
  console.error("Use either --apply or --dry-run, not both.");
  process.exit(1);
}

const content = await loadYamlMenuContent();
const projection = projectStructuralRows(content);

printSummary(projection);

if (isDryRun) {
  console.log("Dry run complete. No database changes were made.");
  process.exit(0);
}

const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");
const databaseUrl = process.env[privateDatabaseUrlEnvName];

if (!databaseUrl) {
  console.error("Private Supabase database URL is required for --apply.");
  process.exit(1);
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

try {
  await sql.begin(async (tx) => {
    await truncateStructuralTables(tx);
    await insertStructuralRows(tx, projection.rows);
  });

  console.log("Import applied successfully.");
} finally {
  await sql.end();
}

function printSummary({ counts, warnings }) {
  console.log("Projected structural rows:");

  for (const tableName of insertTableOrder) {
    console.log(`- menu_content.${tableName}: ${counts[tableName]}`);
  }

  if (warnings.length === 0) {
    console.log("Structural warnings: 0");
    return;
  }

  console.log(`Structural warnings: ${warnings.length}`);

  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

async function truncateStructuralTables(tx) {
  const tableList = structuralTableNames
    .map((tableName) => `menu_content.${quoteIdentifier(tableName)}`)
    .join(", ");

  await tx.unsafe(`truncate table ${tableList} restart identity`);
}

async function insertStructuralRows(tx, rows) {
  await insertRows(tx, "menu_profiles", rows.menu_profiles, [
    "id",
    "eyebrow",
    "title",
    "description",
    "info_title",
  ]);

  await insertRows(tx, "menu_profile_facts", rows.menu_profile_facts, [
    "profile_id",
    "fact_id",
    "label",
    "value",
    "link_text",
    "link_href",
    "order_index",
  ]);

  await insertRows(tx, "menu_profile_payments", rows.menu_profile_payments, [
    "profile_id",
    "payment_id",
    "label",
  ]);

  await insertRows(tx, "menu_profile_payment_methods", rows.menu_profile_payment_methods, [
    "profile_id",
    "method",
    "order_index",
  ]);

  await insertRows(tx, "menu_prices", rows.menu_prices, [
    "pricing_key",
    "kind",
    "amount",
    "currency",
  ]);

  await insertRows(tx, "menu_price_variants", rows.menu_price_variants, [
    "pricing_key",
    "variant_id",
    "name",
    "amount",
    "available",
    "order_index",
  ]);

  const sectionRows = await insertRowsReturning(
    tx,
    "menu_sections",
    rows.menu_sections,
    [
      "section_key",
      "section_scope",
      "menu_id",
      "section_id",
      "title",
      "description",
      "note",
      "order_index",
      "content_kind",
    ],
    ["id", "section_key"],
  );
  const sectionIds = createIdMap(sectionRows, "section_key");

  const groupRows = await insertRowsReturning(
    tx,
    "menu_groups",
    rows.menu_groups.map((row) => ({
      ...row,
      section_row_id: requireMappedId(sectionIds, row.section_key),
    })),
    [
      "group_key",
      "section_row_id",
      "group_id",
      "title",
      "description",
      "note",
      "pricing_key",
      "order_index",
    ],
    ["id", "group_key"],
  );
  const groupIds = createIdMap(groupRows, "group_key");

  const itemRows = await insertRowsReturning(
    tx,
    "menu_items",
    rows.menu_items,
    ["item_key", "item_id", "name", "description", "image_path"],
    ["id", "item_key"],
  );
  const itemIds = createIdMap(itemRows, "item_key");

  await insertRows(
    tx,
    "menu_item_options",
    rows.menu_item_options.map((row) => ({
      ...row,
      item_row_id: requireMappedId(itemIds, row.item_key),
    })),
    [
      "item_row_id",
      "option_id",
      "name",
      "description",
      "note",
      "available",
      "order_index",
    ],
  );

  await insertRows(
    tx,
    "menu_section_items",
    rows.menu_section_items.map((row) => ({
      ...row,
      section_row_id: requireMappedId(sectionIds, row.section_key),
      item_row_id: requireMappedId(itemIds, row.item_key),
    })),
    [
      "section_item_key",
      "section_row_id",
      "item_row_id",
      "item_id",
      "order_index",
      "available",
      "note",
      "pricing_key",
    ],
  );

  await insertRows(
    tx,
    "menu_group_items",
    rows.menu_group_items.map((row) => ({
      ...row,
      group_row_id: requireMappedId(groupIds, row.group_key),
      item_row_id: requireMappedId(itemIds, row.item_key),
    })),
    [
      "group_item_key",
      "group_row_id",
      "item_row_id",
      "item_id",
      "order_index",
      "available",
      "note",
      "pricing_key",
    ],
  );

  const overrideRows = await insertRowsReturning(
    tx,
    "menu_overrides",
    rows.menu_overrides,
    ["override_key", "menu_id"],
    ["id", "override_key"],
  );
  const overrideIds = createIdMap(overrideRows, "override_key");

  const overrideSectionRows = await insertRowsReturning(
    tx,
    "menu_override_sections",
    rows.menu_override_sections.map((row) => ({
      ...row,
      override_row_id: requireMappedId(overrideIds, row.override_key),
    })),
    ["override_section_key", "override_row_id", "section_id", "order_index"],
    ["id", "override_section_key"],
  );
  const overrideSectionIds = createIdMap(overrideSectionRows, "override_section_key");

  const overrideGroupRows = await insertRowsReturning(
    tx,
    "menu_override_groups",
    rows.menu_override_groups.map((row) => ({
      ...row,
      override_section_row_id: requireMappedId(
        overrideSectionIds,
        row.override_section_key,
      ),
    })),
    [
      "override_group_key",
      "override_section_row_id",
      "group_id",
      "pricing_key",
      "note",
      "order_index",
    ],
    ["id", "override_group_key"],
  );
  const overrideGroupIds = createIdMap(overrideGroupRows, "override_group_key");

  await insertRows(
    tx,
    "menu_override_section_items",
    rows.menu_override_section_items.map((row) => ({
      ...row,
      override_section_row_id: requireMappedId(
        overrideSectionIds,
        row.override_section_key,
      ),
    })),
    [
      "override_section_item_key",
      "override_section_row_id",
      "item_id",
      "available",
      "pricing_key",
      "note",
      "order_index",
    ],
  );

  await insertRows(
    tx,
    "menu_override_group_items",
    rows.menu_override_group_items.map((row) => ({
      ...row,
      override_group_row_id: requireMappedId(overrideGroupIds, row.override_group_key),
    })),
    [
      "override_group_item_key",
      "override_group_row_id",
      "item_id",
      "available",
      "pricing_key",
      "note",
      "order_index",
    ],
  );
}

async function insertRows(tx, tableName, rows, columns) {
  if (rows.length === 0) {
    return;
  }

  const query = `insert into menu_content.${quoteIdentifier(tableName)} (${columns
    .map(quoteIdentifier)
    .join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")})`;

  for (const row of rows) {
    await tx.unsafe(
      query,
      columns.map((column) => row[column]),
    );
  }
}

async function insertRowsReturning(tx, tableName, rows, columns, returningColumns) {
  if (rows.length === 0) {
    return [];
  }

  const query = `insert into menu_content.${quoteIdentifier(tableName)} (${columns
    .map(quoteIdentifier)
    .join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")}) returning ${returningColumns
    .map(quoteIdentifier)
    .join(", ")}`;
  const insertedRows = [];

  for (const row of rows) {
    insertedRows.push(
      ...(await tx.unsafe(
        query,
        columns.map((column) => row[column]),
      )),
    );
  }

  return insertedRows;
}

function createIdMap(rows, keyColumn) {
  return new Map(rows.map((row) => [row[keyColumn], Number(row.id)]));
}

function requireMappedId(map, key) {
  const value = map.get(key);

  if (!value) {
    throw new Error(`Missing imported row for key: ${key}`);
  }

  return value;
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}
