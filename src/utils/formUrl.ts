export interface NormalizedFormResult {
  embedUrl: string;
  originalUrl: string;
  isValid: boolean;
  isShortLink: boolean;
  warning?: string;
}

/**
 * Normalizes a Google Form link so it renders cleanly inside the CBT iframe.
 * Converts standard /viewform or /edit links into ?embedded=true URLs.
 */
export function normalizeGoogleFormUrl(rawUrl: string): NormalizedFormResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      embedUrl: '',
      originalUrl: '',
      isValid: false,
      isShortLink: false,
    };
  }

  let parsed: URL;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    return {
      embedUrl: '',
      originalUrl: trimmed,
      isValid: false,
      isShortLink: false,
      warning: 'Format URL tidak valid. Pastikan link dimulai dengan https://docs.google.com/forms/...',
    };
  }

  if (parsed.hostname === 'forms.gle') {
    return {
      embedUrl: parsed.toString(),
      originalUrl: parsed.toString(),
      isValid: true,
      isShortLink: true,
      warning:
        'Link pendek forms.gle terdeteksi. Beberapa Chromebook/browser memblokir redirect forms.gle di dalam frame. Sebaiknya buka link tersebut dulu lalu salin link panjang docs.google.com/forms/d/e/.../viewform.',
    };
  }

  const isGoogleForms =
    parsed.hostname.includes('docs.google.com') && parsed.pathname.includes('/forms');

  if (!isGoogleForms) {
    return {
      embedUrl: parsed.toString(),
      originalUrl: parsed.toString(),
      isValid: true,
      isShortLink: false,
      warning:
        'URL ini bukan domain standar Google Form (docs.google.com/forms). Pastikan halaman mengizinkan embed iframe.',
    };
  }

  // Replace /edit or /prefill with /viewform if teacher accidentally copied the editor/prefill URL
  if (/\/(edit|prefill)\/?$/.test(parsed.pathname)) {
    parsed.pathname = parsed.pathname.replace(/\/(edit|prefill)\/?$/, '/viewform');
  }

  // Ensure embedded=true is set
  parsed.searchParams.set('embedded', 'true');

  return {
    embedUrl: parsed.toString(),
    originalUrl: trimmed,
    isValid: true,
    isShortLink: false,
  };
}
