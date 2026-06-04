// Optimiza fotos full de platos a webp para el menu build-time.
//
// Flujo:
// - Lee originales desde "Imagenes full/Pendientes/".
// - Escribe webp optimizados en "public/uploads/menu/" (versionados en git).
// - Mueve cada original ya procesado a "Imagenes full/" (fuera de Pendientes; carpeta ignorada por git).
//
// Las fotos se ven en un modal a pantalla, no como thumbnail: se redimensionan
// a 1400px de lado largo, webp calidad 80, sin metadata EXIF.
//
// El nombre de salida se alinea al item_id del menu via NAME_MAP. Los archivos
// sin mapeo se procesan igual con un slug derivado del nombre y avisan por consola
// para que el item_id se defina a mano en la migracion SQL.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pendingDir = path.join(projectRoot, "Imagenes full", "Pendientes");
const processedDir = path.join(projectRoot, "Imagenes full");
const outputDir = path.join(projectRoot, "public", "uploads", "menu");

const MAX_LONG_EDGE = 1400;
const WEBP_QUALITY = 80;
const SOURCE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

// basename del original (sin extension, en minusculas) -> item_id del menu
const NAME_MAP = {
  "1_4 de pollo c guarnicion": "cuarto-pollo",
  "mila peceto c guarnicion": "milanesa-peceto",
  "omelet con guarnicion": "omelette",
  "pechuga de pollo c guarnicion": "pechuga-grill",
  "pure de batata": "pure-papa",
  "tortilla c guarnicion": "tortilla",
};

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatKb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

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

  const results = [];

  for (const fileName of sources) {
    const baseName = path.basename(fileName, path.extname(fileName));
    const key = baseName.toLowerCase().trim();
    const mapped = NAME_MAP[key];
    const slug = mapped ?? slugify(baseName);

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
      slug,
      mapped: Boolean(mapped),
      sourceBytes,
      outputBytes,
      outputRel: path.relative(projectRoot, outputPath).replace(/\\/g, "/"),
    });
  }

  console.log(`Procesadas ${results.length} imagen(es):\n`);
  for (const r of results) {
    const tag = r.mapped ? "" : "  [SIN MAPEO: revisar item_id en la migracion]";
    console.log(
      `- ${r.fileName} -> /uploads/menu/${r.slug}.webp  (${formatKb(r.sourceBytes)} -> ${formatKb(r.outputBytes)})${tag}`,
    );
  }
  console.log("\nOriginales movidos a 'Imagenes full/' (fuera de Pendientes).");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
