import { AirQuality } from "../shared/types";

export default function AirQualityDescription({ aqi }: { aqi: AirQuality }) {
    // 0-50: good - green
    // 51-100: moderate - yellow
    // 101-150: unhealthy for sensitive groups - orange
    // 151-200: unhealthy - red
    // 201-300: very unhealthy - purple
    // 301+: hazardous - maroon
    const aqiValue = aqi?.AQI;
    if (aqiValue !== null && aqiValue !== undefined) {
        let indicatorClassName = "weather-indicator ";
        if (aqiValue <= 50) {
            indicatorClassName += "weather-indicator-good";
        }
        else if (aqiValue <= 100) {
            indicatorClassName += "weather-indicator-low";
        }
        else if (aqiValue <= 150) {
            indicatorClassName += "weather-indicator-moderate";
        }
        else if (aqiValue <= 200) {
            indicatorClassName += "weather-indicator-high";
        }
        else {
            indicatorClassName += "weather-indicator-very-high";
        }
        return <span><span className="weather-display-label">AQI</span> {aqiValue}<span className={indicatorClassName}></span></span>;
    }

    return <></>;
}