import { WeatherForecast } from "../shared/types";
import "./WeatherHighLowTemp.css"

function celsiusToFahrenheit(c: number) {
  return Math.round(c * (9.0 / 5.0) + 32.0);
}

export default function WeatherHighLowTemp({ forecast }: { forecast: WeatherForecast }) {
  return <span><span className='temperature-high'>{celsiusToFahrenheit(forecast.highTemperature)}&deg;</span>&thinsp;/&thinsp;<span className='temperature-low'>{celsiusToFahrenheit(forecast.lowTemperature)}&deg;</span></span>;
}