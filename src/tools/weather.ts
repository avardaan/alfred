type WttrCurrentCondition = {
  temp_F?: string;
  temp_C?: string;
  weatherDesc?: Array<{ value?: string }>;
};

type WttrResponse = {
  current_condition?: WttrCurrentCondition[];
  nearest_area?: Array<{ areaName?: Array<{ value?: string }> }>;
};

export async function getWeather(location: string): Promise<string> {
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

  if (tempF && tempC) {
    return `In ${place}, it is ${description.toLowerCase()} and ${tempF} degrees Fahrenheit, ${tempC} degrees Celsius.`;
  }

  return `In ${place}, it is ${description.toLowerCase()}.`;
}
