export type RouteId = string;
export type StopId = string;
export type DirectionId = number;

export type StopInstance = { hasLeftTerminus: boolean, time: string };
export type BusTimes = { ok: boolean, stops: { stopId: StopId, routes: { routeId: RouteId, directions: { directionId: DirectionId, nextInstances: StopInstance[] }[] }[] }[] };
export type RouteNames = { ok: boolean, routes: { routeId: RouteId, directions: { directionId: DirectionId, name: string }[] }[] };
export type WeatherConditions = { ok: boolean, description: string, temperature: number };
export type WeatherForecast = { ok: boolean, highTemperature: number, lowTemperature: number, chancePrecipitation: number };
export type UvForecastHour = { uvIndex: number, time: string };
export type UvForecastDay = { ok: boolean, forecasts: UvForecastHour[] }