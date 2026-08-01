import type { NextRequest } from "next/server";
import { clearSessionCookie, requirePermission, revokeSession, validateCsrf } from "@/lib/auth";
import { fail, ok, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    return ok({ user: session.user, csrfToken: session.csrfToken, expiresAt: session.expiresAt });
  } catch (error) {
    return fail(error, request);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    validateCsrf(request, session);
    await revokeSession(session.id);
    await writeAudit({ userId: session.user.id, action: "logout", resourceType: "session", ip: requestIp(request) });
    const response = ok({ loggedOut: true });
    clearSessionCookie(response, request);
    return response;
  } catch (error) {
    return fail(error, request);
  }
}
