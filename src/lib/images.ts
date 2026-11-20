import variants from "../data/image-variants.json";
import { withBase } from "./urls";
import sharp from "sharp";
import { resolve, sep } from "node:path";

type VariantEntry = { src: string; width: number };

const manifest = variants as Record<string, VariantEntry[]>;

/**
 * Builds a `srcset` for an image in `public/images/` from the manifest written
 * by `scripts/build-image-variants.mjs`, so a phone does not download a
 * desktop-sized file. Returns undefined when no narrower copy exists, in which
 * case the caller should just render `src`.
 */
export function srcSetFor(src: string): string | undefined {
  const entries = manifest[src.replace(/^\/+/, "")];
  if (!entries || entries.length < 2) return undefined;
  return entries
    .map((entry) => `${withBase(entry.src)} ${entry.width}w`)
    .join(", ");
}

const dimensions = new Map<string, Promise<{ width: number; height: number }>>();
export async function imageAttributes(src: string) {
  const key = src.replace(/^\/+/, "");
  const root = resolve("public/images");
  const path = resolve("public", key);
  if (!path.startsWith(root + sep)) throw new Error("Choose an image inside the public image library");
  if (!dimensions.has(key)) dimensions.set(key, sharp(path).metadata().then(({ width, height, orientation }) => {
    if (!width || !height) throw new Error(`Cannot read dimensions for ${key}`);
    return orientation && orientation >= 5 ? { width: height, height: width } : { width, height };
  }));
  const size = await dimensions.get(key)!;
  const entries = manifest[key];
  const display = entries?.at(-1)?.src ?? key;
  return { src: withBase(display), srcset: srcSetFor(key), ...size };
}
