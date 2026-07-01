import { config } from "../config.ts";

export type PlaceResult = {
  name: string;
  phoneNumber: string;
  address: string;
  hours: string | null;
};

/**
 * Search Google Places for a business by name, returning the phone number
 * of the top match. Uses the Places API (New) Text Search endpoint.
 *
 * Returns undefined if no match found or the API key is not configured.
 */
export async function findBusinessPhone(
  query: string,
): Promise<PlaceResult | undefined> {
  const apiKey = config.googlePlacesApiKey;
  if (!apiKey) {
    console.error("[places] GOOGLE_PLACES_API_KEY not set — cannot look up business");
    return undefined;
  }

  const url = "https://places.googleapis.com/v1/places:searchText";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.internationalPhoneNumber,places.formattedAddress,places.currentOpeningHours",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 1,
      languageCode: "en",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[places] API error ${response.status}: ${text}`);
    return undefined;
  }

  const data = (await response.json()) as {
    places?: Array<{
      displayName?: { text?: string };
      internationalPhoneNumber?: string;
      formattedAddress?: string;
      currentOpeningHours?: {
        weekdayDescriptions?: string[];
      };
    }>;
  };

  const place = data.places?.[0];
  if (!place?.internationalPhoneNumber) {
    console.log(`[places] no phone number found for "${query}"`);
    return undefined;
  }

  const hours = place.currentOpeningHours?.weekdayDescriptions?.length
    ? place.currentOpeningHours.weekdayDescriptions.join("; ")
    : null;

  const result: PlaceResult = {
    name: place.displayName?.text ?? query,
    phoneNumber: place.internationalPhoneNumber,
    address: place.formattedAddress ?? "",
    hours,
  };

  console.log(`[places] "${query}" → ${result.name} (${result.phoneNumber})${hours ? ` [hours available]` : ""}`);
  return result;
}
