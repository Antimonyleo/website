import variants from "../data/image-variants.json";
import { withBase } from "./urls";

type VariantEntry = { src: string; width: number };

const manifest = variants as Record<string, VariantEntry[]>;

/**
 * Builds a `srcset` for an image in `public/images/` from the manifest written
 * by `scripts/build-image-variants.mjs`, so a phone does not download a
 * desktop-sized file. Returns undefined when no narrower copy exists, in which
 * case the caller should just render `src`.
 */
export function srcSetFor(src: string): string | undefined {
  const entries = manifest[src];
  if (!entries || entries.length < 2) return undefined;
  return entries
    .map((entry) => `${withBase(entry.src)} ${entry.width}w`)
    .join(", ");
}
