import { Temporal } from "@js-temporal/polyfill";
import { UvForecastDay } from "../shared/types";

export default function WeatherUvDescription({ uvForecast }: { uvForecast: UvForecastDay }) {
  function getUvDesc() {
    const now = Temporal.Now.zonedDateTimeISO();
    const plainNow = now.toPlainDateTime();
    const plainToday = plainNow.toPlainDate();

    const forecasts = uvForecast.forecasts.filter(f => Temporal.PlainDateTime.compare(plainToday, Temporal.PlainDate.from(f.time)) >= 0);
    if (forecasts.length === 0) {
      return null;
    }

    const maxUvToday = Math.max(...forecasts.map(f => f.uvIndex));
    const currentHourIndex = forecasts.findIndex(f => Temporal.PlainDateTime.compare(plainNow, Temporal.PlainDateTime.from(f.time)) <= 0);
    if (currentHourIndex === -1) {
      // Not sure what the current UV is; show the high today if it's moderate or stronger
      if (maxUvToday >= 3) {
        return `UV High ${maxUvToday}`;
      }
    }
    else {
      // Only show UV if it's moderate now or later in the day
      const maxUvRestOfDay = Math.max(...forecasts.slice(currentHourIndex).map(f => f.uvIndex));
      if (maxUvRestOfDay >= 3) {
        const currentHourUv = forecasts[currentHourIndex];
        return `UV ${currentHourUv.uvIndex} / High ${maxUvToday}`;
      }
    }

    return null;
  }

  const uvDesc = getUvDesc();
  if (uvDesc) {
    return <div>{uvDesc}</div>;
  }
  else {
    return <></>;
  }
}