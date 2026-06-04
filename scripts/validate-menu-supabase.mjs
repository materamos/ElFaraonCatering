import postgres from "postgres";
import { loadSupabaseMenuSnapshot } from "./menu-content-supabase.mjs";

const expectedMenuIds = ["corpo", "teleinde"];
const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");
const databaseUrl = process.env[privateDatabaseUrlEnvName];
const technicalIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uploadsBasePath = "/uploads/";
const allowedMenuImageExtensions = [".avif", ".jpeg", ".jpg", ".png", ".svg", ".webp"];
const menuPlaceholderBasePath = "/uploads/menu-placeholders/";

const expectedDailyItemIds = [
  "menu-del-dia",
  "menu-vegetariano-del-dia",
];

const expectedConstraints = [
  "menu_prices_kind_amount_valid",
  "menu_profile_facts_link_pair_valid",
];

const expectedIndexes = [
  "menu_daily_items_item_id_key",
  "menu_daily_items_order_index_key",
  "menu_profile_service_settings_pkey",
  "menu_price_variants_pricing_key_order_index_key",
  "menu_catalog_sections_section_id_key",
  "menu_catalog_sections_order_index_key",
  "menu_catalog_groups_section_id_group_id_key",
  "menu_catalog_groups_section_id_order_index_key",
  "menu_catalog_items_section_id_group_id_item_id_key",
  "menu_catalog_items_section_id_group_id_order_index_key",
  "menu_catalog_item_images_catalog_item_id_order_index_key",
  "menu_catalog_item_options_catalog_item_id_order_index_key",
  "menu_grill_families_order_index_key",
  "menu_grill_catalog_items_item_id_key",
  "menu_grill_catalog_items_order_index_key",
];

const expectedTables = [
  "menu_profiles",
  "menu_profile_facts",
  "menu_prices",
  "menu_price_variants",
  "menu_daily_items",
  "menu_profile_service_settings",
  "menu_catalog_sections",
  "menu_catalog_groups",
  "menu_catalog_items",
  "menu_catalog_item_images",
  "menu_catalog_item_options",
  "menu_grill_families",
  "menu_grill_catalog_items",
];

const retiredTables = [
  "menu_profile_payments",
  "menu_profile_payment_methods",
];

if (!databaseUrl) {
  console.error("Private Supabase database URL is required for menu validation.");
  process.exit(1);
}

const errors = [];
let snapshot;

try {
  snapshot = await loadSupabaseMenuSnapshot(databaseUrl);
} catch (error) {
  console.error("Menu validation failed while reading Supabase menu content.");
  console.error(sanitizeError(error));
  process.exit(1);
}

validateSnapshot(snapshot, errors);

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

try {
  await validateSchema(sql, errors);
} catch (error) {
  errors.push(`Schema audit query failed: ${sanitizeError(error)}`);
} finally {
  await sql.end();
}

if (errors.length > 0) {
  console.error("Menu validation failed:");

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log(`Menu validation passed for ${expectedMenuIds.join(", ")}.`);

function validateSnapshot(snapshot, errors) {
  const profileIds = snapshot.profiles.map((entry) => entry.data.id);
  const profileIdSet = new Set(profileIds);
  const profileServiceMenuIds = snapshot.profileServiceSettings.map((entry) => entry.menuId);

  assertUnique(profileIds, "menu profile id", errors);
  assertUnique(
    snapshot.catalogSections.map((section) => section.sectionId),
    "catalog section id",
    errors,
  );
  assertUnique(
    snapshot.catalogSections.map((section) => section.order),
    "catalog section order",
    errors,
  );
  assertUnique(profileServiceMenuIds, "profile service settings entry", errors);

  for (const menuId of expectedMenuIds) {
    if (!profileIdSet.has(menuId)) {
      errors.push(`Missing required menu profile: ${menuId}`);
    }
  }

  for (const profile of snapshot.profiles) {
    validateProfile(profile.data, errors);
  }

  validateDailyMenu(snapshot.dailyMenu, errors);
  validateSection("grill service", snapshot.grillSection, errors);
  validateGrillService(snapshot.grillSection, errors);

  for (const settings of snapshot.profileServiceSettings) {
    if (!profileIdSet.has(settings.menuId)) {
      errors.push(`Profile service settings references unknown profile: ${settings.menuId}`);
    }

    if (settings.serviceKind !== "daily-menu" && settings.serviceKind !== "grill") {
      errors.push(`Profile service settings ${settings.menuId} serviceKind must be daily-menu or grill.`);
    }
  }

  for (const menuId of profileIds) {
    if (!profileServiceMenuIds.includes(menuId)) {
      errors.push(`Missing profile service settings for ${menuId}.`);
    }
  }

  for (const section of snapshot.catalogSections) {
    validateSection(`catalog section ${section.sectionId}`, section, errors);
  }
}

function validateDailyMenu(dailyMenu, errors) {
  if (!dailyMenu) {
    errors.push("Current daily menu must be defined.");
    return;
  }

  if (!Array.isArray(dailyMenu.items) || dailyMenu.items.length !== expectedDailyItemIds.length) {
    errors.push("Current daily menu must define the two daily menu options.");
    return;
  }

  const dailyItemIds = dailyMenu.items.map((item) => item.itemId);

  for (const expectedDailyItemId of expectedDailyItemIds) {
    if (!dailyItemIds.includes(expectedDailyItemId)) {
      errors.push(`Current daily menu is missing option: ${expectedDailyItemId}`);
    }
  }

  validateSection(
    "daily menu service",
    {
      sectionId: "menu-del-dia",
      title: "Menu del dia",
      order: 10,
      items: dailyMenu.items,
    },
    errors,
  );
}

function validateProfile(profile, errors) {
  validateTechnicalId(profile.id, `profile ${profile.id}`, errors);
  validateNonEmptyString(profile.eyebrow, `profile ${profile.id} eyebrow`, errors);
  validateNonEmptyString(profile.title, `profile ${profile.id} title`, errors);
  validateNonEmptyString(profile.description, `profile ${profile.id} description`, errors);
  validateNonEmptyString(profile.infoTitle, `profile ${profile.id} infoTitle`, errors);

  if (!Array.isArray(profile.facts) || profile.facts.length === 0) {
    errors.push(`Profile ${profile.id} must have at least one fact.`);
  } else {
    const paymentFact = profile.facts.find((fact) => fact.id === "pagos");

    if (!paymentFact) {
      errors.push(`Profile ${profile.id} must define pagos fact.`);
    }

    assertUnique(
      profile.facts.map((fact) => fact.id),
      `profile ${profile.id} fact id`,
      errors,
    );

    for (const fact of profile.facts) {
      validateTechnicalId(fact.id, `profile ${profile.id} fact ${fact.id}`, errors);
      validateNonEmptyString(fact.label, `profile ${profile.id} fact ${fact.id} label`, errors);
      validateNonEmptyString(fact.value, `profile ${profile.id} fact ${fact.id} value`, errors);

      if (fact.link) {
        validateNonEmptyString(fact.link.text, `profile ${profile.id} fact ${fact.id} link text`, errors);
        validateNonEmptyString(fact.link.href, `profile ${profile.id} fact ${fact.id} link href`, errors);
      }
    }
  }
}

function validateSection(scope, section, errors) {
  validateTechnicalId(section.sectionId, `${scope} sectionId`, errors);
  validateNonEmptyString(section.title, `${scope} title`, errors);
  validateOrder(section.order, `${scope} order`, errors);

  const hasItems = Array.isArray(section.items) && section.items.length > 0;
  const hasGroups = Array.isArray(section.groups) && section.groups.length > 0;

  if (hasItems === hasGroups) {
    errors.push(`${scope} must define either items or groups.`);
    return;
  }

  if (hasItems) {
    assertUnique(
      section.items.map((item) => item.itemId),
      `${scope} item id`,
      errors,
    );

    section.items.forEach((item, index) => {
      validateItem(`${scope} item ${item.itemId}`, item, errors);

      if (!item.pricing) {
        errors.push(`${scope} item ${item.itemId} must define pricing.`);
      }

      validateOrder(index, `${scope} item ${item.itemId} projected order`, errors);
    });
  }

  if (hasGroups) {
    assertUnique(
      section.groups.map((group) => group.groupId),
      `${scope} group id`,
      errors,
    );

    section.groups.forEach((group, groupIndex) => {
      validateTechnicalId(group.groupId, `${scope} group ${group.groupId}`, errors);
      validateNonEmptyString(group.title, `${scope} group ${group.groupId} title`, errors);
      validatePricing(group.pricing, `${scope} group ${group.groupId}`, errors);
      validateOrder(groupIndex, `${scope} group ${group.groupId} projected order`, errors);

      if (!Array.isArray(group.items) || group.items.length === 0) {
        errors.push(`${scope} group ${group.groupId} must have items.`);
        return;
      }

      assertUnique(
        group.items.map((item) => item.itemId),
        `${scope} group ${group.groupId} item id`,
        errors,
      );

      group.items.forEach((item, itemIndex) => {
        validateItem(`${scope} group ${group.groupId} item ${item.itemId}`, item, errors);
        validateOrder(
          itemIndex,
          `${scope} group ${group.groupId} item ${item.itemId} projected order`,
          errors,
        );

        if (!group.pricing && !item.pricing) {
          errors.push(
            `${scope} group ${group.groupId} item ${item.itemId} must define or inherit pricing.`,
          );
        }
      });
    });
  }
}

function validateItem(scope, item, errors) {
  validateTechnicalId(item.itemId, scope, errors);
  validateNonEmptyString(item.name, `${scope} name`, errors);

  if (typeof item.available !== "boolean") {
    errors.push(`${scope} available must be boolean.`);
  }

  validatePricing(item.pricing, scope, errors);

  if (item.image !== undefined && !isSafeMenuImagePath(item.image)) {
    errors.push(`${scope} image must be a local file under /uploads/.`);
  }

  if (isMenuPlaceholderImagePath(item.image)) {
    errors.push(`${scope} image must be a real menu image, not a placeholder.`);
  }

  if (item.images !== undefined) {
    if (!Array.isArray(item.images)) {
      errors.push(`${scope} images must be an array.`);
    } else {
      item.images.forEach((image, index) => {
        if (!isSafeMenuImagePath(image)) {
          errors.push(`${scope} images[${index}] must be a local file under /uploads/.`);
        }

        if (isMenuPlaceholderImagePath(image)) {
          errors.push(`${scope} images[${index}] must be a real menu image, not a placeholder.`);
        }
      });
    }
  }

  if (item.options !== undefined) {
    if (!Array.isArray(item.options)) {
      errors.push(`${scope} options must be an array.`);
      return;
    }

    assertUnique(
      item.options.map((option) => option.id),
      `${scope} option id`,
      errors,
    );

    for (const option of item.options) {
      validateTechnicalId(option.id, `${scope} option ${option.id}`, errors);
      validateNonEmptyString(option.name, `${scope} option ${option.id} name`, errors);

      if (typeof option.available !== "boolean") {
        errors.push(`${scope} option ${option.id} available must be boolean.`);
      }
    }
  }
}

function validateGrillService(section, errors) {
  if (!Array.isArray(section.items) || section.items.length === 0) {
    errors.push("Grill service must render families as direct items.");
    return;
  }

  if (section.groups !== undefined) {
    errors.push("Grill service must not render families as groups.");
    return;
  }

  for (const item of section.items) {
    if (item.pricing?.kind !== "variants") {
      errors.push(`Grill family ${item.itemId} must define variants pricing.`);
      continue;
    }

    for (const variant of item.pricing.variants) {
      if (!variant.availabilityItemId) {
        errors.push(`Grill family ${item.itemId} variant ${variant.id} must define availabilityItemId.`);
        continue;
      }

      validateTechnicalId(
        variant.availabilityItemId,
        `grill family ${item.itemId} variant ${variant.id} availabilityItemId`,
        errors,
      );
    }
  }
}

function validatePricing(pricing, scope, errors) {
  if (!pricing) {
    return;
  }

  if (pricing.kind === "fixed") {
    validateAmount(pricing.price?.amount, `${scope} fixed price`, errors);
    return;
  }

  if (pricing.kind === "included") {
    return;
  }

  if (pricing.kind !== "variants") {
    errors.push(`${scope} has unsupported pricing kind: ${pricing.kind}`);
    return;
  }

  if (!Array.isArray(pricing.variants) || pricing.variants.length === 0) {
    errors.push(`${scope} variants pricing must define variants.`);
    return;
  }

  assertUnique(
    pricing.variants.map((variant) => variant.id),
    `${scope} pricing variant id`,
    errors,
  );

  for (const variant of pricing.variants) {
    validateTechnicalId(variant.id, `${scope} variant ${variant.id}`, errors);
    validateNonEmptyString(variant.name, `${scope} variant ${variant.id} name`, errors);
    validateAmount(variant.price?.amount, `${scope} variant ${variant.id} price`, errors);

    if (typeof variant.available !== "boolean") {
      errors.push(`${scope} variant ${variant.id} available must be boolean.`);
    }

    if (variant.availabilityItemId !== undefined) {
      validateTechnicalId(
        variant.availabilityItemId,
        `${scope} variant ${variant.id} availabilityItemId`,
        errors,
      );
    }
  }
}

async function validateSchema(sql, errors) {
  const tableRows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'menu_content'
      and table_type = 'BASE TABLE'
      and table_name in ${sql(expectedTables)}
  `;
  const presentTables = new Set(tableRows.map((row) => row.table_name));

  for (const tableName of expectedTables) {
    if (!presentTables.has(tableName)) {
      errors.push(`Missing active menu_content table: ${tableName}`);
    }
  }

  const retiredTableRows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'menu_content'
      and table_type = 'BASE TABLE'
      and table_name in ${sql(retiredTables)}
  `;

  for (const row of retiredTableRows) {
    errors.push(`Retired menu_content table is still present: ${row.table_name}`);
  }

  const constraintRows = await sql`
    select conname
    from pg_constraint
    where connamespace = 'menu_content'::regnamespace
      and conname in ${sql(expectedConstraints)}
  `;
  const presentConstraints = new Set(constraintRows.map((row) => row.conname));

  for (const constraintName of expectedConstraints) {
    if (!presentConstraints.has(constraintName)) {
      errors.push(`Missing menu_content constraint: ${constraintName}`);
    }
  }

  const indexRows = await sql`
    select indexname
    from pg_indexes
    where schemaname = 'menu_content'
      and indexname in ${sql(expectedIndexes)}
  `;
  const presentIndexes = new Set(indexRows.map((row) => row.indexname));

  for (const indexName of expectedIndexes) {
    if (!presentIndexes.has(indexName)) {
      errors.push(`Missing menu_content index: ${indexName}`);
    }
  }
}

function validateNonEmptyString(value, label, errors) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string.`);
  }
}

function validateTechnicalId(value, label, errors) {
  if (typeof value !== "string" || !technicalIdPattern.test(value)) {
    errors.push(`${label} must be an ASCII kebab-case technical id.`);
  }
}

function validateOrder(value, label, errors) {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${label} must be a nonnegative integer.`);
  }
}

function validateAmount(value, label, errors) {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${label} must be a nonnegative integer amount.`);
  }
}

function assertUnique(values, label, errors) {
  const seenValues = new Set();

  for (const value of values) {
    if (seenValues.has(value)) {
      errors.push(`Duplicate ${label}: ${String(value)}`);
    }

    seenValues.add(value);
  }
}

function isSafeMenuImagePath(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();

  if (
    !trimmedValue.startsWith(uploadsBasePath) ||
    trimmedValue.startsWith("//") ||
    trimmedValue.includes("\\") ||
    trimmedValue.includes("?") ||
    trimmedValue.includes("#")
  ) {
    return false;
  }

  const relativePath = trimmedValue.slice(uploadsBasePath.length);

  if (!relativePath) {
    return false;
  }

  const pathSegments = relativePath.split("/");

  if (
    pathSegments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    return false;
  }

  const lowerCasePath = trimmedValue.toLowerCase();

  return allowedMenuImageExtensions.some((extension) => lowerCasePath.endsWith(extension));
}

function isMenuPlaceholderImagePath(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();

  return isSafeMenuImagePath(trimmedValue) && trimmedValue.startsWith(menuPlaceholderBasePath);
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return databaseUrl ? message.replaceAll(databaseUrl, "[redacted]") : message;
}
