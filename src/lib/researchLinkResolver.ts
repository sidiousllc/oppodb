const INTERNAL_HOSTS = new Set(["research-books.com", "www.research-books.com"]);
const ABSOLUTE_URL_REGEX = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

export function isInternalHost(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    return INTERNAL_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

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
  } else if (!raw.startsWith("/")) {
    // Relative path without leading slash — treat as internal if it looks like a slug path
    // e.g. "health-care-backup" or "andy-ogles/health-care-backup"
    if (/^[a-zA-Z0-9][\w-]*(?:\/[\w-]+)*$/.test(raw.split("#")[0]?.split("?")[0] ?? "")) {
      const segments = raw.split("#")[0]?.split("?")[0]?.split("/").filter(Boolean) ?? [];
      if (segments.length > 0) {
        return normalizeSlug(segments[segments.length - 1]);
      }
    }
    return null;
  }

  // Handle absolute paths starting with "/" — these are internal wiki-style links
  // e.g. /andy-ogles/health-care-backup or /en/some-page
  const pathOnly = pathname.split("#")[0]?.split("?")[0] ?? "";
  const normalizedPath = pathOnly.replace(/^\/+/, "").replace(/^en\//i, "");
  const segments = normalizedPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return normalizeSlug(segments[segments.length - 1]);
}
