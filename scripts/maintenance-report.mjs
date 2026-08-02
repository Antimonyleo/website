import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const maxAgeDays = 180;
const millisecondsPerDay = 86_400_000;
const notices = [];

function notice(category, message) {
  notices.push({ category, message });
}

function checkDate(label, value, today) {
  const checked = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(checked.getTime())) {
    notice("provenance", `${label} has an invalid sourceCheckedAt value: ${value}`);
    return;
  }

  const ageDays = Math.floor((today.getTime() - checked.getTime()) / millisecondsPerDay);
  if (ageDays > maxAgeDays) {
    notice(
      "provenance",
      `${label} was last checked ${ageDays} days ago (${value}; review after ${maxAgeDays} days).`,
    );
  } else if (ageDays < 0) {
    notice("provenance", `${label} has a future sourceCheckedAt date: ${value}`);
  }
}

async function main() {
  const publicationsPath = path.join(root, "src/data/publications.json");
  const researchPath = path.join(root, "src/data/research.ts");
  const experiencePath = path.join(root, "src/content/experience/hao-liu.md");
  const publications = JSON.parse(await readFile(publicationsPath, "utf8"));
  const researchSource = await readFile(researchPath, "utf8");
  const experienceSource = await readFile(experiencePath, "utf8");
  const today = new Date();

  for (const publication of publications) {
    const checkedAt = publication.provenance?.sourceCheckedAt;
    if (typeof checkedAt === "string") {
      checkDate(`Publication ${publication.id}`, checkedAt, today);
    } else {
      notice("provenance", `Publication ${publication.id} has no sourceCheckedAt date.`);
    }

    if (publication.kind === "preprint" || publication.recordStatus === "preprint-not-peer-reviewed") {
      const status = publication.manuscriptStatus ? `; ${publication.manuscriptStatus}` : "";
      notice(
        "preprint",
        `${publication.title} (${publication.year}${status}) — confirm whether its public status has changed.`,
      );
    }
  }

  const experienceDate = experienceSource.match(/sourceCheckedAt:\s*["']?(\d{4}-\d{2}-\d{2})/u)?.[1];
  if (experienceDate) {
    checkDate("Experience record", experienceDate, today);
  } else {
    notice("provenance", "Experience record has no sourceCheckedAt date.");
  }

  const imageReferences = [...researchSource.matchAll(/\bsrc:\s*["']([^"']+)["']/gu)].map(
    (match) => match[1],
  );

  if (imageReferences.length === 0) {
    notice("image", "No local research-image references were found in src/data/research.ts.");
  }

  for (const reference of imageReferences) {
    if (/^(?:https?:)?\/\//u.test(reference) || reference.startsWith("data:")) continue;
    const relativeReference = reference.replace(/^\/+/, "");
    const publicRoot = path.join(root, "public");
    const resolvedPath = path.resolve(publicRoot, relativeReference);
    if (!resolvedPath.startsWith(`${publicRoot}${path.sep}`)) {
      notice("image", `Research image points outside public/: ${reference}`);
      continue;
    }
    try {
      await access(resolvedPath);
    } catch {
      notice("image", `Missing local research image: public/${relativeReference}`);
    }
  }

  console.log("Website maintenance report");
  console.log(`Checked ${publications.length} publication records and ${imageReferences.length} research images.`);
  console.log(`Provenance reminder threshold: ${maxAgeDays} days.`);

  if (notices.length === 0) {
    console.log("\nNo maintenance reminders.");
  } else {
    for (const category of ["provenance", "preprint", "image"]) {
      const categoryNotices = notices.filter((item) => item.category === category);
      if (categoryNotices.length === 0) continue;
      console.log(`\n${category[0].toUpperCase()}${category.slice(1)} (${categoryNotices.length})`);
      for (const item of categoryNotices) console.log(`- ${item.message}`);
    }
  }

  console.log("\nAdvisory only: maintenance reminders do not fail this command.");
}

main().catch((error) => {
  console.error(`Maintenance report could not run: ${error.message}`);
  process.exitCode = 1;
});
