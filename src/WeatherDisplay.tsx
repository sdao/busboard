import { AirQuality, UvForecastDay, WeatherConditions, WeatherForecast } from "../shared/types";
import WeatherEmoji from "./WeatherEmoji";
import WeatherHighLowTemp from "./WeatherHighLowTemp";
import WeatherShortDesc from "./WeatherShortDesc";
import WeatherUvDescription from "./WeatherUvDescription";
import "./WeatherDisplay.css"
import AirQualityDescription from "./AirQualityDescription";

function celsiusToFahrenheit(c: number) {
  return Math.round(c * (9.0 / 5.0) + 32.0);
}

export default function WeatherDisplay({ current, forecast, uvForecast, aqi, lat, lon }: { current: WeatherConditions, forecast?: WeatherForecast, uvForecast?: UvForecastDay, aqi?: AirQuality, lat: number, lon: number }) {
  return (
    <div className="weather-display">
      <div className="weather-display-temp">{celsiusToFahrenheit(current.temperature)}&deg;</div>
      <div className="weather-display-icon">
        <WeatherEmoji current={current} lat={lat} lon={lon} />
      </div>
      <div className="weather-display-description">
        <WeatherShortDesc current={current} showIntensity={false} />
      </div>
      <div className="weather-display-subtitle">
        {forecast !== undefined ? <WeatherHighLowTemp forecast={forecast} /> : <></>}
        <span className="weather-display-subtitle-uv-aqi">
          {uvForecast !== undefined ? <WeatherUvDescription uvForecast={uvForecast} lat={lat} lon={lon} /> : <></>}
          {aqi !== undefined ? <AirQualityDescription aqi={aqi} /> : <></>}
        </span>
      </div>
    </div>
  );
}