export type RouteId = string;
export type StopId = string;
export type DirectionId = number;

export type BusInstance = { hasLeftTerminus: boolean, time: string };
export type DirectionInstance =  { directionId: DirectionId, nextInstances: BusInstance[] };
export type RouteInstance = { routeId: RouteId, directions: DirectionInstance[] };
export type StopInstance = { stopId: StopId, routes: RouteInstance[] };
export type BusTimes = { ok: boolean, stops: StopInstance[] };
export type TransitSystemInfo = { ok: boolean, routes: { routeId: RouteId, directions: { directionId: DirectionId, name: string }[] }[], closestStops: StopId[] };
export type WeatherConditions = { ok: boolean, description: string, temperature: number };
export type WeatherForecast = { ok: boolean, highTemperature: number, lowTemperature: number, chancePrecipitation: number };
export type UvForecastHour = { uvIndex: number, time: string };
export type UvForecastDay = { ok: boolean, forecasts: UvForecastHour[] };
export type ReverseGeocode = { ok: boolean, lat: number, lon: number, zip: string | null, weatherTile: { wfo: string, x: number, y:number} | null, weatherStation: string | null };