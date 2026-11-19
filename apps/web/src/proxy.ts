import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Pages anyone can open without being signed in.
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

// Next 16 "proxy" (formerly middleware): refreshes the session and guards routes.
export async function proxy(request: NextRequest) {
  // Local design review only: show every screen against a fake API, with no login.
  // Never honoured in a production build.
  if (process.env.NODE_ENV !== 'production' && process.env.DESIGN_PREVIEW === '1') {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // A signed-in person has no reason to see the login form. The reset page stays open,
  // because the emailed link signs the person in before they choose a new password.
  if (user && path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
