export type RouteId = string;
export type StopId = string;
export type DirectionId = number;
export type TripId = string;

export type BusInstance = { tripId: TripId, hasLeftTerminus: boolean, time: string };
export type DirectionInstance = { directionId: DirectionId, nextInstances: BusInstance[] };
export type RouteInstance = { routeId: RouteId, directions: DirectionInstance[] };
export type StopInstance = { stopId: StopId, routes: RouteInstance[] };
export type BusTimes = { stops: StopInstance[] };
export type TransitSystemRoute = { routeId: RouteId, directions: { directionId: DirectionId, name: string }[] };
export type TransitSystemInfo = { routes: TransitSystemRoute[], closestStops: StopId[] };

const PHENOMENON_TYPES = ["fog_mist", "dust_storm", "dust", "drizzle", "funnel_cloud", "fog", "smoke", "hail", "snow_pellets", "haze", "ice_crystals", "ice_pellets", "dust_whirls", "spray", "rain", "sand", "snow_grains", "snow", "squalls", "sand_storm", "thunderstorms", "unknown", "volcanic_ash"] as const;
const PHEONOMENON_INTENSITIES = ["light", "heavy"] as const;
const PHENOMENON_MODIFIERS = ["patches", "blowing", "low_drifting", "freezing", "shallow", "partial", "showers"] as const;
const SKY_COVERAGE_TYPES = ["OVC", "BKN", "SCT", "FEW", "SKC", "CLR", "VV"] as const;
export type PhenomenonType = typeof PHENOMENON_TYPES[number];
export type PhenomenonIntensity = typeof PHEONOMENON_INTENSITIES[number];
export type PhenomenonModifier = typeof PHENOMENON_MODIFIERS[number];
export type Phenomenon = { type: PhenomenonType, intensity: PhenomenonIntensity | null, modifier: PhenomenonModifier | null };
export type SkyCoverage = typeof SKY_COVERAGE_TYPES[number];
export type WeatherConditions = { rawMessage: string, temperature: number, phenomena: Phenomenon[], skyCoverage: SkyCoverage };
export type WeatherForecastHour = { temperature: number, chancePrecipitation: number, description: string, time: string };
export type WeatherForecast = { highTemperature: number, lowTemperature: number, forecasts: WeatherForecastHour[] };

export type UvForecastHour = { uvIndex: number, time: string };
export type UvForecastDay = { forecasts: UvForecastHour[] };

export type ReverseGeocode = { lat: number, lon: number, zip: string, weatherTile: { wfo: string, x: number, y: number }, weatherStation: string, radarStation: string };

export function isPhenomenonType(s: unknown): s is PhenomenonType {
    return Array.isArray(PHENOMENON_TYPES) && PHENOMENON_TYPES.includes(s);
}

export function isPhenomenonIntensity(s: unknown): s is PhenomenonIntensity {
    return Array.isArray(PHEONOMENON_INTENSITIES) && PHEONOMENON_INTENSITIES.includes(s);
}

export function isPhenomenonModifier(s: unknown): s is PhenomenonModifier {
    return Array.isArray(PHENOMENON_MODIFIERS) && PHENOMENON_MODIFIERS.includes(s);
}

export function isSkyCoverage(s: unknown): s is SkyCoverage {
    return Array.isArray(SKY_COVERAGE_TYPES) && SKY_COVERAGE_TYPES.includes(s);
}

export function isPrecipitation(phenomenonType: PhenomenonType): boolean {
    switch (phenomenonType) {
        case "drizzle":
        case "hail":
        case "snow_pellets":
        case "ice_crystals":
        case "ice_pellets":
        case "spray":
        case "rain":
        case "snow_grains":
        case "snow":
        case "thunderstorms":
            return true;
        case "fog_mist":
        case "dust_storm":
        case "dust":
        case "funnel_cloud":
        case "fog":
        case "smoke":
        case "haze":
        case "dust_whirls":
        case "sand":
        case "squalls":
        case "sand_storm":
        case "unknown":
        case "volcanic_ash":
            break;
        default:
            phenomenonType satisfies never;
    }

    return false;
}