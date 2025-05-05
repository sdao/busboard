import { useMemo } from "react";
import SunCalc from "suncalc";

import { WeatherConditions } from "../shared/types";
import "./WeatherEmoji.css"
import { useTime } from "./hooks";

export default function WeatherEmoji({ current, lat, lon }: { current: WeatherConditions, lat: number, lon: number }) {
  const now = useTime(60 * 1000);

  const emoji = useMemo(() => {
    if (current.description.length === 0) {
      return null;
    }

    const lowerText = current.description.toLowerCase();
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
      const nowDate = new Date(now.epochMilliseconds);
      const sunPosition = SunCalc.getPosition(nowDate, lat, lon);
      if (sunPosition.altitude > 0) {
        return '🌞';
      }
      else {
        return '🌛';
      }
    }
  }, [current.description, lat, lon, now.epochMilliseconds]);

  if (emoji !== null) {
    return <div className="weather-emoji">{emoji}</div>;
  }
  else {
    return <></>;
  }
}
