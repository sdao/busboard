import { useMemo } from "react";
import { WeatherConditions } from "../shared/types";

export default function WeatherShortDesc({ current }: { current: WeatherConditions }) {
  const description = useMemo(() => {
    const phenomenon = current.phenomena.at(0);
    if (phenomenon !== undefined) {
      // Special cases
      if (phenomenon.intensity == "heavy" && phenomenon.type == "funnel_cloud") {
        return "Tornado";
      }

      const parts: string[] = [];

      // Intensity (light/heavy)
      switch (phenomenon.intensity) {
        case "light":
          parts.push("Light");
          break;
        case "heavy":
          parts.push("Heavy");
          break;
        case null:
          break;
        default:
          phenomenon.intensity satisfies never;
      }

      // Modifiers that go before the weather type
      switch (phenomenon.modifier) {
        case "shallow":
          parts.push("Shallow");  // Fog
          break;
        case "partial":
          parts.push("Partial");  // Fog
          break;
        case "patches":
          parts.push("Patchy");   // Fog
          break;
        case "low_drifting":
          parts.push("Drifting"); // Dust, Sand, Snow
          break;
        case "blowing":
          parts.push("Blowing");  // Dust, Sand, Snow
          break;
        case "freezing":
          parts.push("Freezing"); // Fog, Drizzle, Rain
          break;
        case "showers":
        case null:
          break;
        default:
          phenomenon.modifier satisfies never;
      }

      // Weather type
      switch (phenomenon.type) {
        case "drizzle":
          parts.push("Drizzle");
          break;
        case "rain":
          parts.push("Rain");
          break;
        case "spray":
          parts.push("Spray");
          break;
        case "fog_mist":
          parts.push("Mist");
          break;
        case "fog":
          parts.push("Fog");
          break;
        case "smoke":
          parts.push("Smoke");
          break;
        case "haze":
          parts.push("Haze");
          break;
        case "funnel_cloud":
          parts.push("Funnel Cloud");
          break;
        case "dust":
        case "dust_storm":
        case "dust_whirls":
          parts.push("Dust");
          break;
        case "sand":
        case "sand_storm":
          parts.push("Sand");
          break;
        case "snow":
        case "snow_grains":
        case "snow_pellets":
          parts.push("Snow");
          break;
        case "hail":
          parts.push("Hail");
          break;
        case "ice_crystals":
        case "ice_pellets":
          parts.push("Ice");
          break;
        case "squalls":
          parts.push("Squalls");
          break;
        case "thunderstorms":
          parts.push("Thunderstorms");
          break;
        case "volcanic_ash":
          parts.push("Volcanic Ash");
          break;
        case "unknown":
          parts.push("Precipitation");
          break;
        default:
          phenomenon.type satisfies never;
      }

      // Modifiers that go after the weather type
      switch (phenomenon.modifier) {
        case "shallow":
        case "partial":
        case "patches":
        case "low_drifting":
        case "blowing":
        case "freezing":
          break;
        case "showers": // Rain, Snow, Ice, Hail
          parts.push("Showers");
          break;
        case null:
          break;
        default:
          phenomenon.modifier satisfies never;
      }

      return parts.join(" ");
    }

    switch (current.skyCoverage) {
      case "SKC":
      case "CLR":
        break;
      case "FEW":
        return "Mostly Clear";
      case "SCT":
        return "Partly Cloudy";
      case "BKN":
        return "Mostly Cloudy";
      case "OVC":
        return "Overcast";
      case "VV":
        return "Low Visibility";
      default:
        current.skyCoverage satisfies never;
    }

    return "Clear";
  }, [current.phenomena, current.skyCoverage]);

  return <div>{description}</div>;
}
