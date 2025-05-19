import { Temporal } from "@js-temporal/polyfill";
import { WeatherForecastHour } from "../shared/types";
import WeatherEmoji from "./WeatherEmoji";
import "./WeatherForecastTile.css";

function celsiusToFahrenheit(c: number) {
    return Math.round(c * (9.0 / 5.0) + 32.0);
}

export default function WeatherForecastTile({ lat, lon, forecastHour }: { lat: number, lon: number, forecastHour: WeatherForecastHour }) {
    const instant = Temporal.Instant.from(forecastHour.time);
    const time = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainTime();
    const timeString = time.toLocaleString(undefined, { timeStyle: "short", hour12: false });
    return (
        <div className="forecast-hour">
            <div className="forecast-hour-time">{timeString}</div>
            <div className="forecast-hour-emoji">
                <WeatherEmoji lat={lat} lon={lon} current={forecastHour.icon} time={forecastHour.time} />
                {forecastHour.chancePrecipitation >= 5 ? <span className="forecast-hour-emoji-badge">{Math.round(forecastHour.chancePrecipitation / 5) * 5}%</span> : <></>}
            </div>
            <div className="forecast-hour-temp">{celsiusToFahrenheit(forecastHour.temperature)}&deg;</div>
        </div>
    );
}