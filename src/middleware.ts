import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login endpoints through without auth
  if (pathname === "/dashboard/login" || pathname === "/api/dashboard/login") {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("sbb_dashboard_auth");
  const secret = process.env.AUTH_SECRET;

  if (secret && authCookie?.value !== secret) {
    // API routes: return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Page routes: redirect to login
    return NextResponse.redirect(new URL("/dashboard/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/dashboard/:path*"],
};
