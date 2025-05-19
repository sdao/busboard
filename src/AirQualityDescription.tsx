import { AirQuality } from "../shared/types";
import LevelIndicator from "./LevelIndicator";

export default function AirQualityDescription({ aqi }: { aqi: AirQuality }) {
    // 0-50: good - green
    // 51-100: moderate - yellow
    // 101-150: unhealthy for sensitive groups - orange
    // 151-200: unhealthy - red
    // 201-300: very unhealthy - purple
    // 301+: hazardous - maroon
    const aqiValue = aqi?.AQI;
    if (aqiValue !== null && aqiValue !== undefined) {
        let level: "good" | "low" | "moderate" | "high" | "very_high";
        if (aqiValue <= 50) {
            level = "good";
        }
        else if (aqiValue <= 100) {
            level = "low";
        }
        else if (aqiValue <= 150) {
            level = "moderate";
        }
        else if (aqiValue <= 200) {
            level = "high";
        }
        else {
            level = "very_high";
        }
        return <span><span className="weather-display-label">AQI</span> {aqiValue}<LevelIndicator level={level} /></span>;
    }

    return <></>;
}