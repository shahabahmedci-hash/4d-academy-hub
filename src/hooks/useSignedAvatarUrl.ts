import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Given an avatar_url from profiles, returns a usable image URL.
 * - If it's a full HTTP URL (old public URL), returns it as-is (may break if bucket is private).
 * - If it's a storage file path, generates a signed URL.
 * - Returns null if no avatar_url is provided.
 */
export function useSignedAvatarUrl(avatarUrl: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl) {
      setSignedUrl(null);
      return;
    }

    // If it's already a full URL (old public URL or external), use as-is
    if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
      // Try to extract the file path from old public URLs and generate a signed URL
      const match = avatarUrl.match(/\/storage\/v1\/object\/public\/avatars\/(.+?)(\?|$)/);
      if (match) {
        const filePath = decodeURIComponent(match[1]);
        supabase.storage
          .from("avatars")
          .createSignedUrl(filePath, 3600)
          .then(({ data, error }) => {
            if (!error && data?.signedUrl) {
              setSignedUrl(data.signedUrl);
            } else {
              setSignedUrl(null);
            }
          });
      } else {
        // External URL, use as-is
        setSignedUrl(avatarUrl);
      }
      return;
    }

    // It's a file path, generate signed URL
    supabase.storage
      .from("avatars")
      .createSignedUrl(avatarUrl, 3600)
      .then(({ data, error }) => {
        if (!error && data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        } else {
          setSignedUrl(null);
        }
      });
  }, [avatarUrl]);

  return signedUrl;
}
