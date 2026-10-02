import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// /go/<token> is an access link: it must be reachable while signed OUT (that is its whole
// point). The route itself verifies the token hash, expiry and revocation before signing in.
const PUBLIC_PATHS = ["/login", "/go/"];
// tab / home-screen icons must load on the login page too (Next serves them at these paths, with a ?hash)
const ICON_PATHS = ["/favicon.ico", "/icon.png", "/apple-icon.png"];

/**
 * Next 16 proxy (formerly middleware): refreshes the Supabase session cookie and
 * bounces unauthenticated visitors to /login. Knowing a URL never grants access —
 * every data read/write is re-checked by RLS and the RPCs' role guards.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith("/_next") || ICON_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    const to = request.nextUrl.clone(); to.pathname = "/login"; to.searchParams.set("reason", "unconfigured");
    return NextResponse.redirect(to);
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const to = request.nextUrl.clone(); to.pathname = "/login"; to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"] };
