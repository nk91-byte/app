import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled by route handlers themselves)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icon.png (browser icons)
     * - public assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
