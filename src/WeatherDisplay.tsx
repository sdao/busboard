import { UvForecastDay, WeatherConditions, WeatherForecast } from "../shared/types";
import WeatherEmoji from "./WeatherEmoji";
import WeatherHighLowTemp from "./WeatherHighLowTemp";
import WeatherShortDesc from "./WeatherShortDesc";
import WeatherUvDescription from "./WeatherUvDescription";
import "./WeatherDisplay.css"

function celsiusToFahrenheit(c: number) {
  return Math.round(c * (9.0 / 5.0) + 32.0);
}

export default function WeatherDisplay({ current, forecast, uvForecast, lat, lon }: { current: WeatherConditions | null, forecast: WeatherForecast | null, uvForecast: UvForecastDay | null, lat: number, lon: number }) {
  return (
    <>
      {current !== null ? <WeatherEmoji current={current} lat={lat} lon={lon} /> : <></>}
      <div className="weather-description">
        {current !== null ? <WeatherShortDesc current={current} /> : <></>}
        {forecast !== null ? <WeatherHighLowTemp forecast={forecast} /> : <></>}
        {uvForecast !== null ? <WeatherUvDescription uvForecast={uvForecast} lat={lat} lon={lon} /> : <></>}
      </div>
      {current !== null ? <div>{celsiusToFahrenheit(current.temperature)}&deg;F</div> : <div></div>}
    </>
  );
}