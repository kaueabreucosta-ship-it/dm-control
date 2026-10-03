import { NextResponse } from "next/server";
import { verifySessionValue, SESSION_COOKIE_NAME } from "./lib/auth";

export async function middleware(req) {
  const session = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isValid = await verifySessionValue(session);

  if (!isValid && req.nextUrl.pathname.startsWith("/dashboard")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isValid && req.nextUrl.pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
