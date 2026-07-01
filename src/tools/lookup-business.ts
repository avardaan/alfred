import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { users } from "../db/schema.ts";
import { findBusinessPhone } from "./places.ts";

type LookupBusinessBody = {
  business_name?: string;
  location?: string;
};

export async function handleLookupBusinessTool(req: Request): Promise<Response> {
  let body: LookupBusinessBody;

  try {
    body = (await req.json()) as LookupBusinessBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const businessName = body.business_name?.trim();
  const location = body.location?.trim();
  const userId = req.headers.get("x-user-id") ?? undefined;

  console.log(
    `[tools/lookup_business] business=${businessName} loc=${location ?? "(none)"} user=${userId ?? "none"}`,
  );

  if (!businessName) {
    return Response.json({
      result: "Error: missing business_name.",
    });
  }

  // Resolve location: explicit > user's primaryLocation
  let resolvedLocation = location;
  if (!resolvedLocation && userId) {
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    resolvedLocation = userRows[0]?.primaryLocation ?? undefined;
  }

  const searchQuery = [businessName, resolvedLocation].filter(Boolean).join(", ");

  console.log(`[tools/lookup_business] searching "${searchQuery}"`);
  const place = await findBusinessPhone(searchQuery);

  if (!place) {
    return Response.json({
      result: `No match found for "${businessName}"${resolvedLocation ? ` near ${resolvedLocation}` : ""}. Ask the user for a more specific name or a phone number.`,
    });
  }

  const hoursPart = place.hours
    ? ` Hours: ${place.hours}.`
    : " Hours not listed — call create_task to get them by phone.";

  return Response.json({
    result: `Found: ${place.name} at ${place.address}. Phone: ${place.phoneNumber}.${hoursPart}${place.hours ? " Read the hours to the user directly — no need to call the business." : " Read back the name and address and ask the user to confirm before calling create_task."}`,
  });
}
