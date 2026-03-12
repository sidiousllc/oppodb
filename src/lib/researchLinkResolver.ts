export const INTERNAL_HOSTS = new Set(["research-books.com", "www.research-books.com"]);
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

function normalizeSlug(value: string): string {
  return decodeURIComponent(value)
    .replace(/\.md$/i, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export function extractInternalSlug(href: string | undefined): string | null {
  if (!href) return null;

  const raw = href.trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
    return null;
  }

  let pathname = raw;

  if (ABSOLUTE_URL_REGEX.test(raw)) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }

    if (!INTERNAL_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    pathname = parsed.pathname;
  }

  const pathOnly = pathname.split("#")[0]?.split("?")[0] ?? "";
  const normalizedPath = pathOnly.replace(/^\/+/, "").replace(/^en\//i, "");
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return normalizeSlug(segments[segments.length - 1]);
}
