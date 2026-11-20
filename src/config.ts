import site from "./data/site.json";
export const SITE = site;

export const NAV_ITEMS = [
  { label: "Research", path: "research/" },
  { label: "Publications", path: "publications/" },
  { label: "Experience", path: "experience/" },
] as const;
