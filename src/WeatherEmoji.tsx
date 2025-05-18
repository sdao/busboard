import { useMemo } from "react";
import { Temporal } from "@js-temporal/polyfill";
import SunCalc from "suncalc";

import { NwsIcon, PhenomenonType, SkyCoverage, WeatherConditions } from "../shared/types";
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

function emojiFromNwsIcon(icon: NwsIcon, isDaytime: boolean) {
  switch (icon) {
    case "snow":
    case "rain_snow":
    case "blizzard":
      return snowman_color_svg; // ☃️
    case "rain_sleet":
    case "snow_sleet":
    case "fzra":
    case "rain_fzra":
    case "snow_fzra":
    case "sleet":
      return snowflake_color_svg; // ❄️
    case "rain":
    case "rain_showers":
    case "rain_showers_hi":
    case "hurricane":
    case "tropical_storm":
      return umbrella_with_rain_drops_color_svg; // ☔
    case "tsra":
    case "tsra_sct":
    case "tsra_hi":
      return high_voltage_color_svg; // ⚡
    case "tornado":
    case "dust":
      return tornado_color_svg; // 🌪️
    case "smoke":
    case "haze":
    case "fog":
      return fog_color_svg; // 🌫️
    case "wind_skc":
    case "wind_few":
    case "wind_sct":
    case "wind_bkn":
    case "wind_ovc":
      return leaf_fluttering_in_wind_color_svg; // 🍃
    case "few":
      return isDaytime
        ? sun_behind_small_cloud_color_svg // ⛅
        : moon_behind_small_cloud_color_svg; // custom
    case "sct":
      return isDaytime
        ? sun_behind_cloud_color_svg // ⛅
        : moon_behind_cloud_color_svg; // custom
    case "bkn":
      return isDaytime
        ? sun_behind_large_cloud_color_svg // 🌥️
        : moon_behind_large_cloud_color_svg; // custom
    case "ovc":
      return cloud_color_svg; // ☁️
    case "hot":
    case "cold":
    case "skc":
      break;
    default:
      icon satisfies never;
  }

  return isDaytime
    ? sun_with_face_color_svg // 🌞
    : first_quarter_moon_face_color_svg; // 🌛
}

function emojiFromPhenomenon(phenomenonType: PhenomenonType | null, sky: SkyCoverage, isDaytime: boolean) {
  if (phenomenonType !== null) {
    switch (phenomenonType) {
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
        phenomenonType satisfies never;
    }
  }

  switch (sky) {
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
      sky satisfies never;
  }

  return isDaytime
    ? sun_with_face_color_svg // 🌞
    : first_quarter_moon_face_color_svg; // 🌛
}

export default function WeatherEmoji({ current, lat, lon, time }: { current: WeatherConditions | NwsIcon, lat: number, lon: number, time?: string }) {
  const now = useTime(60 * 1000);
  const displayTime = time === undefined ? now : Temporal.Instant.from(time);

  const emoji = useMemo(() => {
    const nowDate = new Date(displayTime.epochMilliseconds);
    const sunPosition = SunCalc.getPosition(nowDate, lat, lon);
    const isDaytime = sunPosition.altitude > 0;

    if (typeof current === "string") {
      return emojiFromNwsIcon(current, isDaytime);
    }
    else {
      return emojiFromPhenomenon(current.phenomena.at(0)?.type ?? null, current.skyCoverage, isDaytime);
    }
  }, [current, lat, lon, displayTime.epochMilliseconds]);

  return <img className="weather-emoji" src={emoji} />;
}
