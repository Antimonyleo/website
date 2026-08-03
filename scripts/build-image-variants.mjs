#!/usr/bin/env node
/**
 * Generates narrower copies of every wide image under public/images/ and writes
 * a manifest the layout components use to emit `srcset`.
 *
 * Without this the site ships one full-size file to every visitor: the homepage
 * micrograph alone is ~465 KB, eagerly loaded, and a phone rendering it 390 px
 * wide downloads all of it.
 *
 *   node scripts/build-image-variants.mjs          # write variants + manifest
 *   node scripts/build-image-variants.mjs --check  # fail if either is stale
 *
 * Variants are committed rather than generated during the build so the deploy
 * workflow stays a plain `astro build`.
 */
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const imagesDir = join(root, "public", "images");
const manifestPath = join(root, "src", "data", "image-variants.json");

/** Below this an extra request costs more than the bytes it saves. */
const MIN_SOURCE_WIDTH = 800;
const TARGET_WIDTHS = [600, 900];
/**
 * Variants are tagged `.w600.webp`. A plain `-600` suffix is not safe here:
 * publication plates are named after their year, so `foo-2023.webp` would be
 * mistaken for a 2023-pixel-wide variant and skipped.
 */
const VARIANT_PATTERN = /\.w\d{3,4}\.webp$/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && extname(entry.name) === ".webp") yield full;
  }
}

const check = process.argv.includes("--check");
const manifest = {};
const written = [];

for await (const file of walk(imagesDir)) {
  if (VARIANT_PATTERN.test(file)) continue;

  const image = sharp(file);
  const { width } = await image.metadata();
  if (!width || width < MIN_SOURCE_WIDTH) continue;

  // Never upscale, and skip a variant that would be within 15% of the source:
  // the saving does not justify a second file.
  const widths = TARGET_WIDTHS.filter((w) => w <= width * 0.85);
  if (widths.length === 0) continue;

  const key = relative(join(root, "public"), file).split(/[\\/]/).join("/");
  const entries = [];

  for (const target of widths) {
    const out = join(
      dirname(file),
      `${basename(file, ".webp")}.w${target}.webp`,
    );
    if (!existsSync(out) || (await stat(out)).mtimeMs < (await stat(file)).mtimeMs) {
      if (check) {
        console.error(`stale or missing variant: ${relative(root, out)}`);
        process.exitCode = 1;
      } else {
        await image.clone().resize({ width: target }).webp({ quality: 82, effort: 6 }).toFile(out);
        written.push(relative(root, out));
      }
    }
    entries.push({
      src: relative(join(root, "public"), out).split(/[\\/]/).join("/"),
      width: target,
    });
  }

  entries.push({ src: key, width });
  manifest[key] = entries;
}

const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
const current = existsSync(manifestPath) ? await readFile(manifestPath, "utf8") : "";

if (check) {
  if (current !== serialized) {
    console.error(
      `${relative(root, manifestPath)} is out of date; run: npm run images`,
    );
    process.exitCode = 1;
  }
  if (!process.exitCode) console.log("Image variants and manifest are current.");
} else {
  await writeFile(manifestPath, serialized);
  const sources = Object.keys(manifest).length;
  console.log(
    `Wrote ${written.length} variant(s) for ${sources} source image(s); manifest at ${relative(root, manifestPath)}.`,
  );
  for (const w of written) console.log(`  ${w}`);
}
