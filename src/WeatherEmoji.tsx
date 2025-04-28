import SunCalc from "suncalc";

import { WeatherConditions } from "../shared/types";
import "./WeatherEmoji.css"

export default function WeatherEmoji({ current, lat, lon }: { current: WeatherConditions, lat: number, lon: number }) {
  function getEmoji(text: string) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("snow") || lowerText.includes("blizzard")) {
      return '❄️';
    }
    else if (lowerText.includes("thunderstorm")) {
      return '⚡';
    }
    else if (lowerText.includes("tropical storm") || lowerText.includes("hurricane")) {
      return '🌀';
    }
    else if (lowerText.includes("rain") || lowerText.includes("drizzle") || lowerText.includes("ice") || lowerText.includes("showers")) {
      return '☔';
    }
    else if (lowerText.includes("tornado") || lowerText.includes("dust") || lowerText.includes("sand")) {
      return '🌪️';
    }
    else if (lowerText.includes("mostly cloudy")) {
      return '🌥️';
    }
    else if (lowerText.includes("partly cloudy")) {
      return '⛅';
    }
    else if (lowerText.includes("cloud")) {
      return '🌤️';
    }
    else if (lowerText.includes("windy") || lowerText.includes("breezy")) {
      return '🍃';
    }
    else if (lowerText.includes("overcast") || lowerText.includes("haze") || lowerText.includes("smoke") || lowerText.includes("fog") || lowerText.includes("mist")) {
      return '🌫️';
    }
    else {
      const nowDate = new Date();
      const times = SunCalc.getTimes(nowDate, lat, lon);
      if (nowDate > times.sunrise && nowDate < times.sunset) {
        return '🌞';
      }
      else {
        return '🌛';
      }
    }
  }

  if (current.description.length !== 0) {
    return <div className="weather-emoji">{getEmoji(current.description)}</div>;
  }
  else {
    return <></>;
  }
}
