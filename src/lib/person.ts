import { getEntry } from "astro:content";

export async function getPublicPerson() {
  const person = await getEntry("people", "hao-liu");
  if (!person) {
    throw new Error("Required people entry 'hao-liu' was not found.");
  }
  return person.data;
}

export function displayName(person: Awaited<ReturnType<typeof getPublicPerson>>) {
  return `${person.name}, ${person.degree}`;
}

export function primaryOrganization(
  person: Awaited<ReturnType<typeof getPublicPerson>>,
) {
  return person.organizations.at(-1) ?? person.organizations.join(" · ");
}
