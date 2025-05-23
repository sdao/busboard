import { queryOptions } from '@tanstack/react-query';
import { hc } from "hono/client";
import { AirQuality, BusTimes, ReverseGeocode, TransitSystemInfo, UvForecastDay, WeatherConditions, WeatherForecast } from '../shared/types';
import type { AppType } from "../worker/index";
import BusTimesBuilder from '../shared/busTimesBuilder';
import TransitSystemInfoBuilder from '../shared/transitSystemInfoBuilder';

const client = hc<AppType>("/");

export function getReverseGeocodeQuery(lat: number, lon: number) {
    return queryOptions({
        queryKey: ["reverseGeocode", lat, lon],
        queryFn: async (): Promise<ReverseGeocode> => {
            console.log(`Fetching reverse geocode for ${lat}, ${lon}...`);

            const response = await client.geo.$get({ query: { lat: String(lat), lon: String(lon) } });
            if (!response.ok) {
                throw new Error(`Error fetching reverse geocode (response status ${response.status} ${response.statusText})`);
            }

            const result: ReverseGeocode = await response.json();
            console.info(`Received reverse geocode: ${result.zip},${result.weatherStation},${result.weatherTile.wfo},${result.weatherTile.x},${result.weatherTile.y}`);
            return result;
        },
        retry: true
    });
}

export function getGtfsStaticQuery(lat: number, lon: number) {
    return queryOptions({
        queryKey: ["gtfsStatic", lat, lon],
        queryFn: async (): Promise<TransitSystemInfo> => {
            console.log(`Fetching GTFS-Static for ${lat}, ${lon}...`);

            const response = await client.gtfs.$get();
            if (!response.ok) {
                throw new Error(`Error fetching GTFS-Static (response status ${response.status} ${response.statusText})`);
            }

            const builder = await TransitSystemInfoBuilder.createFromGtfsZip(lat, lon, await response.arrayBuffer());
            const transitInfo = builder.build();

            console.info(`Received GTFS-Static: ${transitInfo.routes.length} routes; ${transitInfo.closestStops} closest stops`);
            return transitInfo;
        },
        retry: true
    });
}

export function getGtfsRealtimeQuery(transitInfo?: TransitSystemInfo) {
    return queryOptions({
        queryKey: ["gtfsRealtime", transitInfo?.closestStops],
        queryFn: async (): Promise<BusTimes> => {
            if (transitInfo !== undefined && transitInfo.closestStops.length !== 0) {
                console.log(`Fetching GTFS-Realtime for ${transitInfo.closestStops}...`);

                const response = await client.realtime.$get();
                if (!response.ok) {
                    throw new Error(`Error fetching GTFS-Realtime (response status ${response.status} ${response.statusText})`);
                }

                const builder = BusTimesBuilder.createFromProtobuf(transitInfo.closestStops, await response.arrayBuffer());
                const busTimes = builder.build();
                
                console.info(`Received GTFS-Realtime: ${busTimes.stops.length} stops`);
                return busTimes;
            }

            return { stops: [] };
        },
        enabled: transitInfo !== undefined,
        refetchInterval: (query) => {
            if (query.state.data !== undefined) {
                // If there are no more scheduled buses for the night, throttle updates to every ten minutes
                const anyBusesScheduled = (busTimes: BusTimes) => {
                    for (const stop of busTimes.stops) {
                        for (const route of stop.routes) {
                            for (const dir of route.directions) {
                                if (dir.nextInstances.length !== 0) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                };

                if (!anyBusesScheduled(query.state.data)) {
                    return 10 * 60 * 1000;
                }
            }

            return 1 * 60 * 1000;
        }
    });
}

export function getWeatherCurrentQuery(reverseGeocode?: ReverseGeocode) {
    return queryOptions({
        queryKey: ["metar", reverseGeocode?.weatherStation],
        queryFn: async (): Promise<WeatherConditions> => {
            if (reverseGeocode !== undefined) {
                console.log(`Fetching current weather for ${reverseGeocode.weatherStation}...`);

                const response = await client.metar.$get({ query: { station: reverseGeocode.weatherStation } });
                if (!response.ok) {
                    throw new Error(`Error fetching current weather (response status ${response.status} ${response.statusText})`);
                }

                const result: WeatherConditions = await response.json();
                console.info(`Received current weather: ${result.rawMessage}`);
                return result;
            }

            return { rawMessage: "", temperature: 0, phenomena: [], skyCoverage: "SKC" };
        },
        enabled: reverseGeocode !== undefined,
        refetchInterval: 15 * 60 * 1000
    });
}

export function getWeatherForecastQuery(reverseGeocode?: ReverseGeocode) {
    return queryOptions({
        queryKey: ["weatherForecast", reverseGeocode?.weatherTile],
        queryFn: async (): Promise<WeatherForecast> => {
            if (reverseGeocode !== undefined) {
                const weatherTile = reverseGeocode.weatherTile;
                console.log(`Fetching weather forecast for ${weatherTile.wfo},${weatherTile.x},${weatherTile.y}...`);

                const response = await client.forecast.$get({ query: { wfo: weatherTile.wfo, x: String(weatherTile.x), y: String(weatherTile.y) } });
                if (!response.ok) {
                    throw new Error(`Error fetching weather forecast (response status ${response.status} ${response.statusText})`);
                }

                const result: WeatherForecast = await response.json();
                console.info(`Received weather forecast: high ${result.highTemperature}, low ${result.lowTemperature}, ${result.forecasts.length} forecasts`);
                return result;
            }

            return { highTemperature: 0, lowTemperature: 0, forecasts: [] };
        },
        enabled: reverseGeocode !== undefined,
        refetchInterval: 15 * 60 * 1000
    });
}

export function getUvForecastQuery(reverseGeocode?: ReverseGeocode) {
    return queryOptions({
        queryKey: ["uvForecast", reverseGeocode?.zip],
        queryFn: async (): Promise<UvForecastDay> => {
            if (reverseGeocode !== undefined) {
                console.log(`Fetching UV for ${reverseGeocode.zip}...`);

                const response = await client.uv.$get({ query: {  zip: reverseGeocode.zip } });
                if (!response.ok) {
                    throw new Error(`Error fetching UV (response status ${response.status} ${response.statusText})`);
                }

                const result: UvForecastDay = await response.json();
                console.info(`Received UV: ${result.forecasts.length} time segments`);
                return result;
            }

            return { forecasts: [] };
        },
        enabled: reverseGeocode !== undefined,
        refetchInterval: 60 * 60 * 1000
    });
}

export function getAqiQuery(reverseGeocode?: ReverseGeocode) {
    return queryOptions({
        queryKey: ["aqi", reverseGeocode?.zip],
        queryFn: async (): Promise<AirQuality> => {
            if (reverseGeocode !== undefined) {
                console.log(`Fetching AQI for ${reverseGeocode.zip}...`);

                const response = await client.aqi.$get({ query: {  zip: reverseGeocode.zip } });
                if (!response.ok) {
                    throw new Error(`Error fetching AQI (response status ${response.status} ${response.statusText})`);
                }

                const result: AirQuality = await response.json();
                console.info(`Received AQI: ${result.AQI}`);
                return result;
            }

            return { AQI: null };
        },
        enabled: reverseGeocode !== undefined,
        refetchInterval: 15 * 60 * 1000
    });
}