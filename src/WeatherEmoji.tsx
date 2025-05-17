import { useMemo } from "react";
import SunCalc from "suncalc";

import { WeatherConditions } from "../shared/types";
import { useTime } from "./hooks";
import cloud_color_svg from "/emoji/cloud_color.svg?url";
import droplet_color_svg from "/emoji/droplet_color.svg?url";
import first_quarter_moon_face_color_svg from "/emoji/first_quarter_moon_face_color.svg?url";
import fog_color_svg from "/emoji/fog_color.svg?url";
import high_voltage_color_svg from "/emoji/high_voltage_color.svg?url";
import leaf_fluttering_in_wind_color_svg from "/emoji/leaf_fluttering_in_wind_color.svg?url";
import snowflake_color_svg from "/emoji/snowflake_color.svg?url";
import snowman_color_svg from "/emoji/snowman_color.svg?url";
import sun_behind_cloud_color_svg from "/emoji/sun_behind_cloud_color.svg?url";
import sun_behind_large_cloud_color_svg from "/emoji/sun_behind_large_cloud_color.svg?url";
import sun_behind_small_cloud_color_svg from "/emoji/sun_behind_small_cloud_color.svg?url";
import sun_with_face_color_svg from "/emoji/sun_with_face_color.svg?url";
import tornado_color_svg from "/emoji/tornado_color.svg?url";
import umbrella_with_rain_drops_color_svg from "/emoji/umbrella_with_rain_drops_color.svg?url";
import volcano_color_svg from "/emoji/volcano_color.svg?url";
import moon_behind_cloud_color_svg from "/emoji_custom/moon_behind_cloud_color.svg?url";
import moon_behind_large_cloud_color_svg from "/emoji_custom/moon_behind_large_cloud_color.svg?url";
import moon_behind_small_cloud_color_svg from "/emoji_custom/moon_behind_small_cloud_color.svg?url";
import "./WeatherEmoji.css"

export default function WeatherEmoji({ current, lat, lon }: { current: WeatherConditions, lat: number, lon: number }) {
  const now = useTime(60 * 1000);

  const emoji = useMemo(() => {
    const nowDate = new Date(now.epochMilliseconds);
    const sunPosition = SunCalc.getPosition(nowDate, lat, lon);
    const isDaytime = sunPosition.altitude > 0;

    const phenomenon = current.phenomena.at(0);
    if (phenomenon !== undefined) {
      switch (phenomenon.type) {
        case "drizzle":
        case "rain":
        case "spray":
          return umbrella_with_rain_drops_color_svg; // ☔
        case "fog_mist":
        case "fog":
        case "smoke":
        case "haze":
          return fog_color_svg; // 🌫️
        case "funnel_cloud":
        case "dust":
        case "dust_storm":
        case "dust_whirls":
        case "sand":
        case "sand_storm":
          return tornado_color_svg; // 🌪️
        case "snow":
        case "snow_grains":
        case "snow_pellets":
          return snowman_color_svg; // ☃️
        case "hail":
        case "ice_crystals":
        case "ice_pellets":
          return snowflake_color_svg; // ❄️
        case "squalls":
          return leaf_fluttering_in_wind_color_svg; // 🍃
        case "thunderstorms":
          return high_voltage_color_svg; // ⚡
        case "volcanic_ash":
          return volcano_color_svg; // 🌋
        case "unknown":
          return droplet_color_svg; //💧
        default:
          phenomenon.type satisfies never;
      }
    }

    switch (current.skyCoverage) {
      case "SKC": // Clear
      case "CLR": // Clear
        break;
      case "FEW": // Mostly Clear
        return isDaytime
          ? sun_behind_small_cloud_color_svg // ⛅
          : moon_behind_small_cloud_color_svg; // custom
      case "SCT": // Partly Cloudy
        return isDaytime
          ? sun_behind_cloud_color_svg // ⛅
          : moon_behind_cloud_color_svg; // custom
      case "BKN": // Mostly Cloudy
        return isDaytime
          ? sun_behind_large_cloud_color_svg // 🌥️
          : moon_behind_large_cloud_color_svg; // custom
      case "OVC": // Overcast
      case "VV":  // Low Visibility
        return cloud_color_svg; // ☁️
      default:
        current.skyCoverage satisfies never;
    }

    return isDaytime
      ? sun_with_face_color_svg // 🌞
      : first_quarter_moon_face_color_svg; // 🌛
  }, [current.phenomena, current.skyCoverage, lat, lon, now.epochMilliseconds]);

  return <div className="weather-emoji"><img src={emoji} /></div>;
}
