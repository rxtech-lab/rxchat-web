import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { guestRegex, isDevelopmentEnvironment } from './lib/constants';
import createMiddleware from 'next-intl/middleware';
import { routing } from './lib/i18n/routing';

// Create i18n middleware
const handleI18nRouting = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/workflow')) {
    return NextResponse.next();
  }

  // Handle i18n routing first
  const i18nResponse = handleI18nRouting(request);

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  // Get pathname without locale prefix for auth checks
  const pathnameWithoutLocale = pathname.replace(
    /^\/(en|zh-CN|zh-TW)(\/|$)/,
    '/',
  );

  // if no token and not in login route, redirect to login
  if (
    !token &&
    !pathnameWithoutLocale.startsWith('/login') &&
    !pathnameWithoutLocale.startsWith('/register')
  ) {
    // Extract locale from pathname
    const localeMatch = pathname.match(/^\/(en|zh-CN|zh-TW)/);
    const locale = localeMatch ? localeMatch[1] : '';
    const loginPath = locale ? `/${locale}/login` : '/login';
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  const isGuest = guestRegex.test(token?.email ?? '');

  if (
    token &&
    !isGuest &&
    ['/login', '/register'].includes(pathnameWithoutLocale)
  ) {
    // Extract locale from pathname
    const localeMatch = pathname.match(/^\/(en|zh-CN|zh-TW)/);
    const locale = localeMatch ? localeMatch[1] : '';
    const homePath = locale ? `/${locale}` : '/';
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  return i18nResponse;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // However, match all pathnames within `/api`, except for the ones containing a dot
    '/api/(.*)',
  ],
};
