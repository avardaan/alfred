const BELOW_TWENTY = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

export type TemperatureUnit = "fahrenheit" | "celsius";

const UNIT_LABEL: Record<TemperatureUnit, string> = {
  fahrenheit: "Fahrenheit",
  celsius: "Celsius",
};

export function parseTemperatureUnit(value: unknown): TemperatureUnit {
  if (typeof value !== "string") {
    return "fahrenheit";
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "celsius" ||
    normalized === "centigrade" ||
    normalized === "metric"
  ) {
    return "celsius";
  }

  return "fahrenheit";
}

function speakAbsoluteInteger(n: number): string {
  if (n <= 19) {
    return BELOW_TWENTY[n]!;
  }

  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return ones === 0 ? TENS[tens]! : `${TENS[tens]}-${BELOW_TWENTY[ones]}`;
  }

  if (n === 100) {
    return "one hundred";
  }

  if (n <= 120) {
    const remainder = n - 100;
    const tail =
      remainder <= 19
        ? BELOW_TWENTY[remainder]
        : `${TENS[Math.floor(remainder / 10)]}${
            remainder % 10 === 0 ? "" : `-${BELOW_TWENTY[remainder % 10]}`
          }`;
    return tail === "zero" ? "one hundred" : `one hundred ${tail}`;
  }

  return String(n);
}

/** Spell out integer temps so TTS does not garble digits or unit symbols. */
function speakTemperature(value: string, unit: TemperatureUnit): string {
  const label = UNIT_LABEL[unit];
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) {
    return `${value} degrees ${label}`;
  }

  if (rounded < 0) {
    return `minus ${speakAbsoluteInteger(Math.abs(rounded))} degrees ${label}`;
  }

  return `${speakAbsoluteInteger(rounded)} degrees ${label}`;
}

type WttrCurrentCondition = {
  temp_F?: string;
  temp_C?: string;
  weatherDesc?: Array<{ value?: string }>;
};

type WttrResponse = {
  current_condition?: WttrCurrentCondition[];
  nearest_area?: Array<{ areaName?: Array<{ value?: string }> }>;
};

export async function getWeather(
  location: string,
  unit: TemperatureUnit = "fahrenheit",
): Promise<string> {
  const query = location.trim();
  if (!query) {
    return "I need a city or location to check the weather.";
  }

  const url = `https://wttr.in/${encodeURIComponent(query)}?format=j1`;

  const response = await fetch(url, {
    headers: { "User-Agent": "Alfred/1.0" },
  });

  if (!response.ok) {
    return `I could not find weather for ${query}.`;
  }

  const data = (await response.json()) as WttrResponse;
  const current = data.current_condition?.[0];
  if (!current) {
    return `I could not find weather for ${query}.`;
  }

  const place = data.nearest_area?.[0]?.areaName?.[0]?.value ?? query;
  const description = current.weatherDesc?.[0]?.value ?? "unknown conditions";
  const tempF = current.temp_F;
  const tempC = current.temp_C;
  const conditions = `${place}: ${description.toLowerCase()}.`;

  if (tempF && tempC) {
    return `${conditions} Fahrenheit: ${speakTemperature(tempF, "fahrenheit")}. Celsius: ${speakTemperature(tempC, "celsius")}.`;
  }

  if (tempF) {
    return `${conditions} Fahrenheit: ${speakTemperature(tempF, "fahrenheit")}.`;
  }

  if (tempC) {
    return `${conditions} Celsius: ${speakTemperature(tempC, "celsius")}.`;
  }

  return conditions;
}
