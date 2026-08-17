export function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getHostname(value: string): string {
  const normalized = normalizeUrl(value);

  if (!normalized) {
    return "";
  }

  try {
    return new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isSameOrSubdomain(hostname: string, candidateHostname: string): boolean {
  if (!hostname || !candidateHostname) {
    return false;
  }

  return hostname === candidateHostname || hostname.endsWith(`.${candidateHostname}`);
}
