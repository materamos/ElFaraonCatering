// Optimizes full-size dish photos to WebP for the build-time menu.
//
// Flow:
// - Reads originals from "assets/source-images/menu/pending/".
// - Writes optimized WebP files to versioned "public/uploads/menu/".
// - Moves each processed original to "assets/source-images/menu/used/".
//
// Photos open in a full-screen modal rather than a thumbnail, so they are
// resized to 1400px on the long side at WebP quality 80 without EXIF metadata.
//
// NAME_MAP defines each output name, item_id, WebP slug, and whether the photo
// is primary or additional.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const sourceImagesDir = path.join(projectRoot, "assets", "source-images", "menu");
const pendingDir = path.join(sourceImagesDir, "pending");
const processedDir = path.join(sourceImagesDir, "used");
const outputDir = path.join(projectRoot, "public", "uploads", "menu");

const MAX_LONG_EDGE = 1400;
const WEBP_QUALITY = 80;
const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

const ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_ROLES = new Set(["primary", "additional"]);

// Lowercase original basename without extension -> image metadata.
const NAME_MAP = {
  "cuarto-pollo": {
    itemId: "cuarto-pollo",
    outputSlug: "cuarto-pollo",
    role: "primary",
  },
  "empanadas-3": {
    itemId: "empanadas",
    outputSlug: "empanadas-3",
    role: "additional",
    orderIndex: 1,
  },
  "empanadas": {
    itemId: "empanadas",
    outputSlug: "empanadas",
    role: "primary",
  },
  "ensalada-completa": {
    itemId: "ensalada-completa",
    outputSlug: "ensalada-completa",
    role: "primary",
  },
  "ensalada-el-faraon": {
    itemId: "ensalada-el-faraon",
    outputSlug: "ensalada-el-faraon",
    role: "primary",
  },
  "ensalada-caesar": {
    itemId: "ensalada-caesar",
    outputSlug: "ensalada-caesar",
    role: "primary",
  },
  "suprema-pollo": {
    itemId: "suprema-pollo",
    outputSlug: "suprema-pollo",
    role: "primary",
  },
  "milanesa-peceto": {
    itemId: "milanesa-peceto",
    outputSlug: "milanesa-peceto",
    role: "primary",
  },
  "omelette": {
    itemId: "omelette-jamon-queso",
    outputSlug: "omelette",
    role: "primary",
  },
  "omelette-2": {
    itemId: "omelette-espinaca-muzzarella",
    outputSlug: "omelette-2",
    role: "primary",
  },
  "pechuga-grill": {
    itemId: "pechuga-grill",
    outputSlug: "pechuga-grill",
    role: "primary",
  },
  "chips-papa": {
    itemId: "chips",
    outputSlug: "chips-papa",
    role: "primary",
  },
  "chips-batata": {
    itemId: "chips",
    outputSlug: "chips-batata",
    role: "additional",
    orderIndex: 1,
  },
  "pure-batata": {
    itemId: "pure",
    outputSlug: "pure-batata",
    role: "additional",
    orderIndex: 1,
  },
  "pure-calabaza": {
    itemId: "pure",
    outputSlug: "pure-calabaza",
    role: "additional",
    orderIndex: 2,
  },
  "pure-papa": {
    itemId: "pure",
    outputSlug: "pure-papa",
    role: "primary",
    replaceExisting: true,
  },
  "tartas": {
    itemId: "tartas",
    outputSlug: "tartas",
    role: "additional",
    orderIndex: 1,
  },
  "tartas-2": {
    itemId: "tartas",
    outputSlug: "tartas-2",
    role: "primary",
  },
  "tartas-3": {
    itemId: "tartas",
    outputSlug: "tartas-3",
    role: "additional",
    orderIndex: 2,
  },
  "tortilla": {
    itemId: "tortilla",
    outputSlug: "tortilla",
    role: "primary",
  },
};

const formatKb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

const getImageKey = (fileName) =>
  path.basename(fileName, path.extname(fileName)).toLowerCase().trim();

const validateImageConfig = (config, key) => {
  const errors = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [`${key}: mapping must be an object.`];
  }

  if (!ITEM_ID_PATTERN.test(config.itemId ?? "")) {
    errors.push(`${key}: itemId must be ASCII kebab-case.`);
  }

  if (!ITEM_ID_PATTERN.test(config.outputSlug ?? "")) {
    errors.push(`${key}: outputSlug must be ASCII kebab-case.`);
  }

  if (!IMAGE_ROLES.has(config.role)) {
    errors.push(`${key}: role must be primary or additional.`);
  }

  if (
    config.role === "additional" &&
    (!Number.isInteger(config.orderIndex) || config.orderIndex < 1)
  ) {
    errors.push(`${key}: additional images must define orderIndex >= 1.`);
  }

  if (config.role === "primary" && config.orderIndex !== undefined) {
    errors.push(`${key}: primary images must not define orderIndex.`);
  }

  if (config.replaceExisting !== undefined && typeof config.replaceExisting !== "boolean") {
    errors.push(`${key}: replaceExisting must be boolean when defined.`);
  }

  return errors;
};

const assertValidMappings = async (sources) => {
  const errors = [];
  const pendingOutputSlugs = new Map();
  const imageOrders = new Map();

  for (const [key, config] of Object.entries(NAME_MAP)) {
    errors.push(...validateImageConfig(config, key));
  }

  for (const fileName of sources) {
    const key = getImageKey(fileName);
    const config = NAME_MAP[key];

    if (!config) {
      errors.push(`${fileName}: [SIN MAPEO] falta entrada en NAME_MAP.`);
      continue;
    }

    const outputSlugFiles = pendingOutputSlugs.get(config.outputSlug) ?? [];
    outputSlugFiles.push(fileName);
    pendingOutputSlugs.set(config.outputSlug, outputSlugFiles);

    const orderIndex = config.role === "primary" ? 0 : config.orderIndex;
    const orderKey = `${config.itemId}:${orderIndex}`;
    const orderFiles = imageOrders.get(orderKey) ?? [];
    orderFiles.push(fileName);
    imageOrders.set(orderKey, orderFiles);

    const outputPath = path.join(outputDir, `${config.outputSlug}.webp`);
    const outputExists = await fs
      .access(outputPath)
      .then(() => true)
      .catch((error) => {
        if (error.code === "ENOENT") {
          return false;
        }
        throw error;
      });

    if (outputExists && config.replaceExisting !== true) {
      errors.push(
        `${fileName}: output /uploads/menu/${config.outputSlug}.webp already exists; set replaceExisting: true to replace it intentionally.`,
      );
    }
  }

  for (const [outputSlug, files] of pendingOutputSlugs) {
    if (files.length > 1) {
      errors.push(`outputSlug ${outputSlug} is used by multiple pending files: ${files.join(", ")}.`);
    }
  }

  for (const [orderKey, files] of imageOrders) {
    if (files.length > 1) {
      errors.push(`image order ${orderKey} is used by multiple pending files: ${files.join(", ")}.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`No se pueden procesar las imagenes:\n- ${errors.join("\n- ")}`);
  }
};

const main = async () => {
  let entries;
  try {
    entries = await fs.readdir(pendingDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`No existe ${path.relative(projectRoot, pendingDir)}; nada que procesar.`);
      return;
    }
    throw error;
  }

  const sources = entries
    .filter((entry) => entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (sources.length === 0) {
    console.log("No hay imagenes pendientes para procesar.");
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(processedDir, { recursive: true });
  await assertValidMappings(sources);

  const results = [];

  for (const fileName of sources) {
    const key = getImageKey(fileName);
    const config = NAME_MAP[key];
    const slug = config.outputSlug;

    const sourcePath = path.join(pendingDir, fileName);
    const outputPath = path.join(outputDir, `${slug}.webp`);
    const movedPath = path.join(processedDir, fileName);

    const sourceBytes = (await fs.stat(sourcePath)).size;

    await sharp(sourcePath)
      .rotate() // aplica orientacion EXIF antes de descartar metadata
      .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);

    const outputBytes = (await fs.stat(outputPath)).size;

    await fs.rename(sourcePath, movedPath);

    results.push({
      fileName,
      itemId: config.itemId,
      slug,
      role: config.role,
      orderIndex: config.orderIndex,
      replaced: config.replaceExisting === true,
      sourceBytes,
      outputBytes,
      outputRel: path.relative(projectRoot, outputPath).replace(/\\/g, "/"),
    });
  }

  console.log(`Procesadas ${results.length} imagen(es):\n`);
  for (const r of results) {
    const roleText =
      r.role === "additional"
        ? `additional orderIndex=${r.orderIndex}`
        : "primary orderIndex=0";
    const replaceText = r.replaced ? " reemplazo intencional" : "";
    console.log(
      `- ${r.fileName} -> item_id=${r.itemId} ${roleText} /uploads/menu/${r.slug}.webp  (${formatKb(r.sourceBytes)} -> ${formatKb(r.outputBytes)})${replaceText}`,
    );
  }
  console.log("\nOriginales movidos a 'assets/source-images/menu/used/'.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
