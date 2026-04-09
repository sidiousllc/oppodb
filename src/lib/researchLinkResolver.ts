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

export interface InternalLink {
  /** The final slug segment (used for matching) */
  slug: string;
  /** The parent slug if this is a subpage link like /andy-ogles/health-care */
  parentSlug: string | null;
  /** All segments of the path */
  segments: string[];
}

export function extractInternalLink(href: string | undefined): InternalLink | null {
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
    // Relative path without leading slash
    // Match slug-like paths: "health-care-backup" or "andy-ogles/health-care-backup"
    const clean = raw.split("#")[0]?.split("?")[0] ?? "";
    if (/^[a-zA-Z0-9][\w-]*(?:\/[\w-]+)*$/.test(clean)) {
      const segments = clean.split("/").filter(Boolean).map(normalizeSlug);
      if (segments.length > 0) {
        return {
          slug: segments[segments.length - 1],
          parentSlug: segments.length > 1 ? segments[0] : null,
          segments,
        };
      }
    }
    return null;
  }

  // Handle absolute paths starting with "/"
  const pathOnly = pathname.split("#")[0]?.split("?")[0] ?? "";
  const normalizedPath = pathOnly.replace(/^\/+/, "").replace(/^en\//i, "");
  const segments = normalizedPath.split("/").filter(Boolean).map(normalizeSlug);
  if (segments.length === 0) return null;

  return {
    slug: segments[segments.length - 1],
    parentSlug: segments.length > 1 ? segments[0] : null,
    segments,
  };
}

/** Legacy API — returns just the slug string for backward compatibility */
export function extractInternalSlug(href: string | undefined): string | null {
  const link = extractInternalLink(href);
  return link?.slug ?? null;
}
