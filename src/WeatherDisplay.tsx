import { UvForecastDay, WeatherConditions, WeatherForecast } from "../shared/types";
import WeatherEmoji from "./WeatherEmoji";
import WeatherHighLowTemp from "./WeatherHighLowTemp";
import WeatherShortDesc from "./WeatherShortDesc";
import WeatherUvDescription from "./WeatherUvDescription";
import "./WeatherDisplay.css"

function celsiusToFahrenheit(c: number) {
  return Math.round(c * (9.0 / 5.0) + 32.0);
}

export default function WeatherDisplay({ current, forecast, uvForecast, lat, lon }: { current: WeatherConditions, forecast: WeatherForecast | null, uvForecast: UvForecastDay | null, lat: number, lon: number }) {
  return (
    <div className="weather-display">
      <div className="weather-display-icon-temp">
        <div>{celsiusToFahrenheit(current.temperature)}&deg;</div>
        <WeatherEmoji current={current} lat={lat} lon={lon} />
      </div>
      <div className="weather-display-description">
        <WeatherShortDesc current={current} />
      </div>
      <div className="weather-display-subtitle">
        {forecast !== null ? <WeatherHighLowTemp forecast={forecast} /> : <></>}
        {uvForecast !== null ? <WeatherUvDescription uvForecast={uvForecast} lat={lat} lon={lon} /> : <></>}
      </div>
    </div>
  );
}