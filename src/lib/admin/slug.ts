// Shared by admin forms (live preview) and actions (the real value).

/** "Banana Ice – IGET Bar 3500" -> "banana-ice-iget-bar-3500" */
export function slugify(input: string, max = 120) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
