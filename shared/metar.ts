import { Phenomenon, PhenomenonType, PhenomenonIntensity, PhenomenonModifier, SkyCoverage, WeatherConditions } from "./types";

// These are standard METAR fields that come before RMK
// Capture groups: [1] entire cloud coverage code
const SKY_COVERAGE_REGEX = / (SKC|CLR|(?:FEW|SCT|BKN|OVC|VV)(?:\d{3})(?:CB)?)/g;
// Capture groups: [1] +|- intensity [2] rest of the phenomenon code(s)
const PHENOMENON_REGEX = / (\+|-)?((?:VC|RE|MI|BC|DR|BL|SH|TS|FZ|PR|DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|DU|SA|HZ|PY|VA|PO|SQ|FC|SS|DS)+)/g;

// This is a non-standard METAR field used in the United States; it comes after RMK
// Capture groups: [1] 0|1 negative indicator [2] temperature in tenths of a degree Celsius [3] dew point
const TEMPERATURE_REGEX = / T([01])([0-9]{3})(?:[0-9]{4})/;

function getSkyCoverage(standardMessage: string): SkyCoverage {
    let maxLevel: SkyCoverage = "SKC";
    let maxLevelIndex = 0;
    const levels = ["SKC", "CLR", "FEW", "SCT", "BKN", "OVC"] as const;
    for (const match of standardMessage.matchAll(SKY_COVERAGE_REGEX)) {
        if (match.length >= 2) {
            // Note: ignores "VV" (vertical visibility) which is not a three-letter code
            const token = match[1].substring(0, 3);
            switch (token) {
                case "SKC":
                case "CLR":
                case "FEW":
                case "SCT":
                case "BKN":
                case "OVC": {
                    const levelIndex = levels.indexOf(token);
                    if (levelIndex > maxLevelIndex) {
                        maxLevel = token;
                        maxLevelIndex = levelIndex;
                    }
                    break;
                }
            }
        }
    }

    return maxLevel;
}

function getPhenomena(standardMessage: string): Phenomenon[] {
    const phenomena: Phenomenon[] = [];
    for (const match of standardMessage.matchAll(PHENOMENON_REGEX)) {
        if (match.length >= 3 && match[2] !== undefined) {
            let intensity: PhenomenonIntensity | null = null;
            switch (match[1]) {
                case "-":
                    intensity = "light";
                    break;
                case "+":
                    intensity = "heavy";
                    break;
            }

            let type: PhenomenonType | null = null;
            let modifier: PhenomenonModifier | null = null;
            for (let i = 0; i < match[2].length; i += 2) {
                const token = match[2].substring(i, i + 2);
                switch (token) {
                    case "VC":
                        break;
                    case "RE":
                        break;
                    case "MI":
                        modifier = "shallow";
                        break;
                    case "BC":
                        modifier = "patches";
                        break;
                    case "DR":
                        modifier = "low_drifting";
                        break;
                    case "BL":
                        modifier = "blowing";
                        break;
                    case "SH":
                        modifier = "showers";
                        break;
                    case "TS":
                        type = "thunderstorms";
                        break;
                    case "FZ":
                        modifier = "freezing";
                        break;
                    case "PR":
                        modifier = "partial";
                        break;
                    case "DZ":
                        type = "drizzle";
                        break;
                    case "RA":
                        type = "rain";
                        break;
                    case "SN":
                        type = "snow";
                        break;
                    case "SG":
                        type = "snow_grains";
                        break;
                    case "IC":
                        type = "ice_crystals";
                        break;
                    case "PL":
                        type = "ice_pellets";
                        break;
                    case "GR":
                        type = "hail";
                        break;
                    case "GS":
                        type = "snow_pellets";
                        break;
                    case "UP":
                        type = "unknown";
                        break;
                    case "BR":
                        type = "fog_mist";
                        break;
                    case "FG":
                        type = "fog";
                        break;
                    case "FU":
                        type = "smoke";
                        break;
                    case "DU":
                        type = "dust";
                        break;
                    case "SA":
                        type = "sand";
                        break;
                    case "HZ":
                        type = "haze";
                        break;
                    case "PY":
                        type = "spray";
                        break;
                    case "VA":
                        type = "volcanic_ash";
                        break;
                    case "PO":
                        type = "dust_whirls";
                        break;
                    case "SQ":
                        type = "squalls";
                        break;
                    case "FC":
                        type = "funnel_cloud";
                        break;
                    case "SS":
                        type = "sand_storm";
                        break;
                    case "DS":
                        type = "dust_storm";
                        break;
                }
            }

            if (type !== null) {
                phenomena.push({ type, intensity, modifier});
            }
        }
    }

    return phenomena;
}

function getTemperatureCelsius(extendedMessage: string): number | null {
    const match = extendedMessage.match(TEMPERATURE_REGEX);
    if (match !== null && match.length >= 3 && match[1] !== undefined && match[2] !== undefined)  {
        const negative = match[1] == "1" ? -1 : 1;
        const absTempC = parseInt(match[2]) / 10.0;
        return negative * absTempC;
    }

    return null;
}

export function decodeMetar(rawMessage: string): WeatherConditions | null {
    const temperature = getTemperatureCelsius(rawMessage);
    if (temperature !== null) {
        const remarksIndex = rawMessage.indexOf(" RMK");
        const standardMessage = remarksIndex >= 0 ? rawMessage.substring(0, remarksIndex) : rawMessage;
        return { rawMessage, temperature, phenomena: getPhenomena(standardMessage), skyCoverage: getSkyCoverage(standardMessage) };
    }

    return null;
}
