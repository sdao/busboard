import { useMemo } from "react";
import SunCalc from "suncalc";
import { Temporal } from "@js-temporal/polyfill";
import { UvForecastDay } from "../shared/types";
import { useTime } from "./hooks";

export default function WeatherUvDescription({ uvForecast, lat, lon }: { uvForecast: UvForecastDay, lat: number, lon: number }) {
  const now = useTime(60 * 1000);

  // 1-2: low - green
  // 3-5: moderate - yellow
  // 6-7: moderate - orange
  // 8-10: very high - red
  // 11+: very high - purple
  const { maxUvToday, uvIndex } = useMemo(() => {
    // Only show UV forecast during the daytime
    const nowDate = new Date(now.epochMilliseconds);
    const sunPosition = SunCalc.getPosition(nowDate, lat, lon);
    if (sunPosition.altitude <= 0) {
      return {};
    }

    const plainNow = now.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDateTime();
    const plainToday = plainNow.toPlainDate();

    const forecasts = uvForecast.forecasts.filter(f => Temporal.PlainDateTime.compare(plainToday, Temporal.PlainDate.from(f.time)) >= 0);
    if (forecasts.length === 0) {
      return {};
    }

    // Only show UV if the high today is moderate or stronger
    const maxUvToday = Math.max(...forecasts.map(f => f.uvIndex));
    if (maxUvToday >= 3) {
      const currentHourUv = forecasts.find(f => Temporal.PlainDateTime.compare(plainNow, Temporal.PlainDateTime.from(f.time)) <= 0);
      if (currentHourUv === undefined) {
        return { maxUvToday };
      }
      else {
        return { maxUvToday, uvIndex: currentHourUv.uvIndex };
      }
    }

    return {};
  }, [lat, lon, now, uvForecast]);

  if (maxUvToday === undefined) {
    return <></>;
  }
  else if (uvIndex === undefined) {
    return <span><span className="weather-display-label">UV High</span> {maxUvToday}</span>;
  }
  else {
    let indicatorClassName = "weather-indicator ";
    if (uvIndex <= 2) {
      indicatorClassName += "weather-indicator-good";
    }
    else if (uvIndex <= 5) {
      indicatorClassName += "weather-indicator-low";
    }
    else if (uvIndex <= 7) {
      indicatorClassName += "weather-indicator-moderate";
    }
    else if (uvIndex <= 10) {
      indicatorClassName += "weather-indicator-high";
    }
    else {
      indicatorClassName += "weather-indicator-very-high";
    }
    return <span><span className="weather-display-label">UV</span> {uvIndex}&thinsp;/&thinsp;{maxUvToday}<span className={indicatorClassName}></span></span>;
  }
}