import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { secret } = (await request.json()) as { secret: string };
  const authSecret = process.env.AUTH_SECRET;

  if (!authSecret) {
    return NextResponse.json({ error: "AUTH_SECRET not configured" }, { status: 500 });
  }
  if (secret !== authSecret) {
    return NextResponse.json({ error: "Invalid passphrase" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("sbb_dashboard_auth", secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return response;
}
