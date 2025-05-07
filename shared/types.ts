export type RouteId = string;
export type StopId = string;
export type DirectionId = number;

export type BusInstance = { hasLeftTerminus: boolean, time: string };
export type DirectionInstance =  { directionId: DirectionId, nextInstances: BusInstance[] };
export type RouteInstance = { routeId: RouteId, directions: DirectionInstance[] };
export type StopInstance = { stopId: StopId, routes: RouteInstance[] };
export type BusTimes = { stops: StopInstance[] };
export type TransitSystemRoute = { routeId: RouteId, directions: { directionId: DirectionId, name: string }[] };
export type TransitSystemInfo = { routes: TransitSystemRoute[], closestStops: StopId[] };
export type WeatherConditions = { description: string, temperature: number };
export type WeatherForecast = { highTemperature: number, lowTemperature: number, chancePrecipitation: number };
export type UvForecastHour = { uvIndex: number, time: string };
export type UvForecastDay = { forecasts: UvForecastHour[] };
export type ReverseGeocode = { lat: number, lon: number, zip: string, weatherTile: { wfo: string, x: number, y: number }, weatherStation: string, radarStation: string };