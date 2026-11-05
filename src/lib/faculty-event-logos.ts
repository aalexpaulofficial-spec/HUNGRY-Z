import { supabase } from "@/integrations/supabase/client";

const EVENT_LOGO_BUCKET = "faculty-event-logos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getFacultyEventLogoUrls(paths: Array<string | null | undefined>) {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!uniquePaths.length) return {} as Record<string, string>;

  const now = Date.now();
  for (const [path, cached] of signedUrlCache) if (cached.expiresAt <= now) signedUrlCache.delete(path);
  const urls = Object.fromEntries(uniquePaths.flatMap((path) => {
    const cached = signedUrlCache.get(path);
    return cached && cached.expiresAt > now + 2 * 60 * 1000 ? [[path, cached.url]] : [];
  }));
  const missing = uniquePaths.filter((path) => !urls[path]);
  if (!missing.length) return urls;

  const { data, error } = await supabase.storage.from(EVENT_LOGO_BUCKET).createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("Could not load faculty event logos", error.message);
    return urls as Record<string, string>;
  }

  for (const item of data ?? []) {
    if (!item.path || !item.signedUrl) continue;
    signedUrlCache.set(item.path, { url: item.signedUrl, expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000 });
    urls[item.path] = item.signedUrl;
  }
  return urls as Record<string, string>;
}

export function facultyEventLogoObjectPath(userId: string, eventId: string, file: File) {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const extension = extensionByType[file.type];
  if (!extension) throw new Error("Choose a JPG, PNG, WebP, or AVIF image.");
  return `${userId}/${eventId}/${crypto.randomUUID()}.${extension}`;
}

export const FACULTY_EVENT_LOGO_BUCKET = EVENT_LOGO_BUCKET;
export const FACULTY_EVENT_LOGO_MAX_BYTES = 8 * 1024 * 1024;
