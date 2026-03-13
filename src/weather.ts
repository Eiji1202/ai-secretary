// デフォルトは岐阜県
const DEFAULT_LOCATION = {
  name: "岐阜県",
  latitude: 35.3912,
  longitude: 136.7223,
};

export type Location = {
  name: string;
  latitude: number;
  longitude: number;
};

export async function getWeather(
  location: Location = DEFAULT_LOCATION,
): Promise<string> {
  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    daily:
      "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "Asia/Tokyo",
    forecast_days: "1",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`,
  );
  const data = (await response.json()) as any;

  const weatherCode = data.daily.weathercode[0];
  const tempMax = data.daily.temperature_2m_max[0];
  const tempMin = data.daily.temperature_2m_min[0];
  const precipProb = data.daily.precipitation_probability_max[0];

  const weatherEmoji = getWeatherEmoji(weatherCode);
  const weatherDesc = getWeatherDesc(weatherCode);

  let message = `${weatherEmoji} 今日の天気（${location.name}）\n`;
  message += `天気：${weatherDesc}\n`;
  message += `気温：最高${tempMax}°C / 最低${tempMin}°C\n`;
  message += `降水確率：${precipProb}%`;

  if (precipProb >= 50) {
    message += "\n傘を持っていきましょう！";
  }

  return message;
}

function getWeatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code <= 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌧️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

function getWeatherDesc(code: number): string {
  if (code === 0) return "快晴";
  if (code === 1) return "晴れ";
  if (code === 2) return "晴れ時々曇り";
  if (code === 3) return "曇り";
  if (code <= 48) return "霧";
  if (code <= 57) return "小雨";
  if (code <= 67) return "雨";
  if (code <= 77) return "雪";
  if (code <= 82) return "にわか雨";
  if (code <= 86) return "にわか雪";
  if (code <= 99) return "雷雨";
  return "不明";
}
