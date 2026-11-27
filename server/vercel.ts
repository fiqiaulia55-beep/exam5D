import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const rawUrl = req.url || '/';
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const forwardedPath = parsed.searchParams.get('__vercel_path');
    if (forwardedPath !== null) {
      parsed.searchParams.delete('__vercel_path');
      const qs = parsed.searchParams.toString();
      const cleanSubPath = forwardedPath.replace(/^\/+/, '');
      req.url = `/api${cleanSubPath ? `/${cleanSubPath}` : ''}${qs ? `?${qs}` : ''}`;
    } else if (parsed.pathname === '/api/index') {
      req.url = `/api/health${parsed.search}`;
    }
  } catch {
    // Keep original req.url if URL parsing fails
  }

  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
