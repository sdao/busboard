import { useMemo } from "react";
import SunCalc from "suncalc";
import { Temporal } from "@js-temporal/polyfill";
import { UvForecastDay } from "../shared/types";
import { useTime } from "./hooks";

export default function WeatherUvDescription({ uvForecast, lat, lon }: { uvForecast: UvForecastDay, lat: number, lon: number }) {
  const now = useTime(60 * 1000);

  const uvDesc = useMemo(() => {
    // Only show UV forecast during the daytime
    const nowDate = new Date(now.epochMilliseconds);
    const sunPosition = SunCalc.getPosition(nowDate, lat, lon);
    if (sunPosition.altitude <= 0) {
      return null;
    }

    const plainNow = now.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDateTime();
    const plainToday = plainNow.toPlainDate();

    const forecasts = uvForecast.forecasts.filter(f => Temporal.PlainDateTime.compare(plainToday, Temporal.PlainDate.from(f.time)) >= 0);
    if (forecasts.length === 0) {
      return null;
    }

    // Only show UV if the high today is moderate or stronger
    const maxUvToday = Math.max(...forecasts.map(f => f.uvIndex));
    if (maxUvToday >= 3) {
      const currentHourUv = forecasts.find(f => Temporal.PlainDateTime.compare(plainNow, Temporal.PlainDateTime.from(f.time)) <= 0);
      if (currentHourUv === undefined) {
        return `UV High ${maxUvToday}`;
      }
      else {
        return `UV ${currentHourUv.uvIndex} / High ${maxUvToday}`;
      }
    }

    return null;
  }, [lat, lon, now, uvForecast.forecasts]);

  if (uvDesc !== null) {
    return <div>{uvDesc}</div>;
  }
  else {
    return <></>;
  }
}