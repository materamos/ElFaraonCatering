import postgres from "postgres";
import { loadSupabaseMenuSnapshot } from "./menu-content-supabase.mjs";

const expectedMenuIds = ["corpo", "teleinde"];
const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");
const databaseUrl = process.env[privateDatabaseUrlEnvName];
const technicalIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uploadsBasePath = "/uploads/";
const allowedMenuImageExtensions = [".avif", ".jpeg", ".jpg", ".png", ".svg", ".webp"];

const expectedConstraints = [
  "menu_daily_menu_singleton_valid",
  "menu_prices_kind_amount_valid",
  "menu_sections_scope_menu_id_valid",
  "menu_profile_facts_link_pair_valid",
];

const expectedIndexes = [
  "menu_daily_service_settings_profile_key",
  "menu_grill_items_item_id_key",
  "menu_grill_items_order_index_key",
  "menu_prices_pricing_key_kind_key",
  "menu_price_variants_pricing_key_order_key",
  "menu_sections_context_section_id_key",
  "menu_sections_context_order_key",
  "menu_groups_section_group_id_key",
  "menu_groups_section_order_key",
  "menu_items_id_item_id_key",
  "menu_section_items_section_item_id_key",
  "menu_section_items_section_order_key",
  "menu_group_items_group_item_id_key",
  "menu_group_items_group_order_key",
  "menu_item_options_item_order_key",
  "menu_overrides_menu_id_key",
  "menu_override_sections_override_section_id_key",
  "menu_override_sections_override_order_key",
  "menu_override_groups_section_group_id_key",
  "menu_override_groups_section_order_key",
  "menu_override_section_items_section_item_id_key",
  "menu_override_section_items_section_order_key",
  "menu_override_group_items_group_item_id_key",
  "menu_override_group_items_group_order_key",
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
  const dailyServiceMenuIds = snapshot.dailyServiceSettings.map((entry) => entry.menuId);
  const catalogSectionsById = new Map(
    snapshot.catalogSections.map((section) => [section.sectionId, section]),
  );

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
  assertUnique(
    snapshot.overrides.map((override) => override.menuId),
    "menu override menuId",
    errors,
  );
  assertUnique(dailyServiceMenuIds, "daily service settings entry", errors);

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

  for (const settings of snapshot.dailyServiceSettings) {
    if (!profileIdSet.has(settings.menuId)) {
      errors.push(`Daily service settings references unknown profile: ${settings.menuId}`);
    }

    if (typeof settings.grillEnabled !== "boolean") {
      errors.push(`Daily service settings ${settings.menuId} grillEnabled must be boolean.`);
    }
  }

  for (const menuId of profileIds) {
    if (!dailyServiceMenuIds.includes(menuId)) {
      errors.push(`Missing daily service settings for ${menuId}.`);
    }
  }

  for (const section of snapshot.catalogSections) {
    validateSection(`catalog section ${section.sectionId}`, section, errors);
  }

  for (const override of snapshot.overrides) {
    validateOverride(override, profileIdSet, catalogSectionsById, errors);
  }
}

function validateDailyMenu(dailyMenu, errors) {
  if (!dailyMenu) {
    errors.push("Current daily menu must be defined.");
    return;
  }

  if (!Array.isArray(dailyMenu.items) || dailyMenu.items.length !== 3) {
    errors.push("Current daily menu must define the three daily menu options.");
    return;
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

  if (!profile.payment) {
    errors.push(`Profile ${profile.id} must have payment data.`);
    return;
  }

  validateTechnicalId(profile.payment.id, `profile ${profile.id} payment`, errors);
  validateNonEmptyString(profile.payment.label, `profile ${profile.id} payment label`, errors);

  if (!Array.isArray(profile.payment.methods) || profile.payment.methods.length === 0) {
    errors.push(`Profile ${profile.id} must have at least one payment method.`);
    return;
  }

  for (const method of profile.payment.methods) {
    validateNonEmptyString(method, `profile ${profile.id} payment method`, errors);
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

function validateOverride(override, profileIdSet, catalogSectionsById, errors) {
  validateTechnicalId(override.menuId, `override ${override.menuId}`, errors);

  if (!profileIdSet.has(override.menuId)) {
    errors.push(`Override references unknown profile: ${override.menuId}`);
  }

  if (!Array.isArray(override.sections)) {
    errors.push(`Override ${override.menuId} sections must be an array.`);
    return;
  }

  assertUnique(
    override.sections.map((section) => section.sectionId),
    `override ${override.menuId} section id`,
    errors,
  );

  for (const sectionOverride of override.sections) {
    const section = catalogSectionsById.get(sectionOverride.sectionId);

    validateTechnicalId(
      sectionOverride.sectionId,
      `override ${override.menuId} section ${sectionOverride.sectionId}`,
      errors,
    );

    if (!section) {
      errors.push(
        `Override ${override.menuId} references unknown section: ${sectionOverride.sectionId}`,
      );
      continue;
    }

    if (sectionOverride.items) {
      if (!section.items) {
        errors.push(
          `Override ${override.menuId} cannot override direct items in grouped section: ${section.sectionId}`,
        );
      } else {
        validateOverrideItems(
          `override ${override.menuId} section ${section.sectionId}`,
          sectionOverride.items,
          new Set(section.items.map((item) => item.itemId)),
          errors,
        );
      }
    }

    if (sectionOverride.groups) {
      if (!section.groups) {
        errors.push(
          `Override ${override.menuId} cannot override groups in item section: ${section.sectionId}`,
        );
        continue;
      }

      const groupsById = new Map(section.groups.map((group) => [group.groupId, group]));

      assertUnique(
        sectionOverride.groups.map((group) => group.groupId),
        `override ${override.menuId} section ${section.sectionId} group id`,
        errors,
      );

      for (const groupOverride of sectionOverride.groups) {
        const group = groupsById.get(groupOverride.groupId);

        validateTechnicalId(
          groupOverride.groupId,
          `override ${override.menuId} section ${section.sectionId} group ${groupOverride.groupId}`,
          errors,
        );
        validatePricing(
          groupOverride.pricing,
          `override ${override.menuId} section ${section.sectionId} group ${groupOverride.groupId}`,
          errors,
        );

        if (!group) {
          errors.push(
            `Override ${override.menuId} references unknown group ${groupOverride.groupId} in section ${section.sectionId}`,
          );
          continue;
        }

        validateOverrideItems(
          `override ${override.menuId} section ${section.sectionId} group ${group.groupId}`,
          groupOverride.items ?? [],
          new Set(group.items.map((item) => item.itemId)),
          errors,
        );
      }
    }
  }
}

function validateOverrideItems(scope, items, validItemIds, errors) {
  assertUnique(
    items.map((item) => item.itemId),
    `${scope} item id`,
    errors,
  );

  for (const item of items) {
    validateTechnicalId(item.itemId, `${scope} item ${item.itemId}`, errors);
    validatePricing(item.pricing, `${scope} item ${item.itemId}`, errors);

    if (!validItemIds.has(item.itemId)) {
      errors.push(`${scope} references unknown item: ${item.itemId}`);
    }

    if (item.available !== undefined && typeof item.available !== "boolean") {
      errors.push(`${scope} item ${item.itemId} available must be boolean.`);
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
  }
}

async function validateSchema(sql, errors) {
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

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return databaseUrl ? message.replaceAll(databaseUrl, "[redacted]") : message;
}
