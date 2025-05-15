import { useMemo } from "react";
import SunCalc from "suncalc";

import { WeatherConditions } from "../shared/types";
import { useTime } from "./hooks";
import cloud_color_svg from "/emoji/cloud_color.svg?url";
import cyclone_color_svg from "/emoji/cyclone_color.svg?url";
import first_quarter_moon_face_color_svg from "/emoji/first_quarter_moon_face_color.svg?url";
import fog_color_svg from "/emoji/fog_color.svg?url";
import high_voltage_color_svg from "/emoji/high_voltage_color.svg?url";
import leaf_fluttering_in_wind_color_svg from "/emoji/leaf_fluttering_in_wind_color.svg?url";
import snowflake_color_svg from "/emoji/snowflake_color.svg?url";
import sun_behind_cloud_color_svg from "/emoji/sun_behind_cloud_color.svg?url";
import sun_behind_large_cloud_color_svg from "/emoji/sun_behind_large_cloud_color.svg?url";
import sun_behind_small_cloud_color_svg from "/emoji/sun_behind_small_cloud_color.svg?url";
import sun_with_face_color_svg from "/emoji/sun_with_face_color.svg?url";
import tornado_color_svg from "/emoji/tornado_color.svg?url";
import umbrella_with_rain_drops_color_svg from "/emoji/umbrella_with_rain_drops_color.svg?url";
import moon_behind_cloud_color_svg from "/emoji_custom/moon_behind_cloud_color.svg?url";
import moon_behind_large_cloud_color_svg from "/emoji_custom/moon_behind_large_cloud_color.svg?url";
import moon_behind_small_cloud_color_svg from "/emoji_custom/moon_behind_small_cloud_color.svg?url";
import "./WeatherEmoji.css"

export default function WeatherEmoji({ current, lat, lon }: { current: WeatherConditions, lat: number, lon: number }) {
  const now = useTime(60 * 1000);

  const emoji = useMemo(() => {
    if (current.description.length === 0) {
      return null;
    }

    const nowDate = new Date(now.epochMilliseconds);
    const sunPosition = SunCalc.getPosition(nowDate, lat, lon);
    const isDaytime = sunPosition.altitude > 0;

    const lowerText = current.description.toLowerCase();
    if (lowerText.includes("snow") || lowerText.includes("blizzard")) {
      return snowflake_color_svg; // ❄️
    }
    else if (lowerText.includes("thunder")) {
      return high_voltage_color_svg; // ⚡
    }
    else if (lowerText.includes("tropical storm") || lowerText.includes("hurricane")) {
      return cyclone_color_svg; // 🌀
    }
    else if (lowerText.includes("rain") || lowerText.includes("drizzle") || lowerText.includes("ice") || lowerText.includes("showers")) {
      return umbrella_with_rain_drops_color_svg; // ☔
    }
    else if (lowerText.includes("tornado") || lowerText.includes("dust") || lowerText.includes("sand")) {
      return tornado_color_svg; // 🌪️
    }
    else if (lowerText.includes("overcast")) {
      return cloud_color_svg; // ☁️
    }
    else if (lowerText.includes("mostly cloudy")) {
      return isDaytime
        ? sun_behind_large_cloud_color_svg // 🌥️
        : moon_behind_large_cloud_color_svg; // custom
    }
    else if (lowerText.includes("partly cloudy")) {
      return isDaytime
        ? sun_behind_cloud_color_svg // ⛅
        : moon_behind_cloud_color_svg; // custom
    }
    else if (lowerText.includes("cloud")) {
      return isDaytime
        ? sun_behind_small_cloud_color_svg // 🌤️
        : moon_behind_small_cloud_color_svg; // custom
    }
    else if (lowerText.includes("windy") || lowerText.includes("breezy")) {
      return leaf_fluttering_in_wind_color_svg; // 🍃
    }
    else if (lowerText.includes("haze") || lowerText.includes("smoke") || lowerText.includes("fog") || lowerText.includes("mist")) {
      return fog_color_svg; // 🌫️
    }
    else {
      return isDaytime
        ? sun_with_face_color_svg // 🌞
        : first_quarter_moon_face_color_svg; // 🌛
    }
  }, [current.description, lat, lon, now.epochMilliseconds]);

  if (emoji !== null) {
    return <div className="weather-emoji"><img src={emoji} /></div>;
  }
  else {
    return <></>;
  }
}
