import { getSessionUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getSessionUser();
    return ok({ user });
  } catch (e) {
    return handleError(e);
  }
}
