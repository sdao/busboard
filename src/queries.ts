import { queryOptions } from '@tanstack/react-query';
import { ApiError, BusTimes, ReverseGeocode, TransitSystemInfo, UvForecastDay, WeatherConditions, WeatherForecast } from '../shared/types';

async function formatApiError(response: Response): Promise<string> {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        try {
            const apiError = await response.json() as ApiError;
            return `<${response.url}> responded with status ${apiError.status}: ${apiError.error}`;
        }
        catch {
            // Ignore
        }
    }

    return `<${response.url}> responded with status ${response.status}`;
}

export function getReverseGeocodeQuery(lat: number, lon: number) {
    return queryOptions({
        queryKey: ["reverseGeocode", lat, lon],
        queryFn: async () => {
            console.log(`Fetching reverse geocode for ${lat}, ${lon}...`);

            const response = await fetch(`/geo?lat=${lat}&lon=${lon}`);
            if (!response.ok) {
                throw new Error(await formatApiError(response));
            }

            const result = await response.json() as ReverseGeocode;
            console.info(`Received reverse geocode: ${result.zip},${result.weatherStation},${result.weatherTile.wfo},${result.weatherTile.x},${result.weatherTile.y}`);
            return result;
        },
        retry: true
    });
}

export function getTransitInfoQuery(lat: number, lon: number) {
    return queryOptions({
        queryKey: ["transitInfo", lat, lon],
        queryFn: async () => {
            console.log(`Fetching transit info for ${lat}, ${lon}...`);

            const response = await fetch(`/transitinfo?lat=${lat}&lon=${lon}`);
            if (!response.ok) {
                throw new Error(await formatApiError(response));
            }

            const result = await response.json() as TransitSystemInfo;
            console.info(`Received transit info: ${result.routes.length} routes; ${result.closestStops} closest stops`);
            return result;
        },
        retry: true
    });
}

export function getBusTimesQuery(transitInfo?: TransitSystemInfo) {
    return queryOptions({
        queryKey: ["busTimes", transitInfo?.closestStops],
        queryFn: async () => {
            if (transitInfo !== undefined && transitInfo.closestStops.length !== 0) {
                console.log(`Fetching bus times for ${transitInfo.closestStops}...`);

                const stopIds = transitInfo.closestStops.join(",");
                const response = await fetch(`/bustimes?stops=${stopIds}`);
                if (!response.ok) {
                    throw new Error(await formatApiError(response));
                }

                const result = await response.json() as BusTimes;
                console.info(`Received bus times: ${result.stops.length} stops`);
                return result;
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
        queryKey: ["weatherCurrent", reverseGeocode?.weatherStation],
        queryFn: async () => {
            if (reverseGeocode !== undefined) {
                console.log(`Fetching current weather for ${reverseGeocode.weatherStation}...`);

                const response = await fetch(`/weather?station=${reverseGeocode.weatherStation}`);
                if (!response.ok) {
                    throw new Error(await formatApiError(response));
                }

                const result = await response.json() as WeatherConditions;
                console.info(`Received current weather: ${result.description}, ${result.temperature}`);
                return result;
            }

            return { description: "", temperature: 0 };
        },
        enabled: reverseGeocode !== undefined,
        refetchInterval: 15 * 60 * 1000
    });
}

export function getWeatherForecastQuery(reverseGeocode?: ReverseGeocode) {
    return queryOptions({
        queryKey: ["weatherForecast", reverseGeocode?.weatherTile],
        queryFn: async () => {
            if (reverseGeocode !== undefined) {
                const weatherTile = reverseGeocode.weatherTile;
                console.log(`Fetching weather forecast for ${weatherTile.wfo},${weatherTile.x},${weatherTile.y}...`);

                const response = await fetch(`/forecast?wfo=${weatherTile.wfo}&x=${weatherTile.x}&y=${weatherTile.y}`);
                if (!response.ok) {
                    throw new Error(await formatApiError(response));
                }

                const result = await response.json() as WeatherForecast;
                console.info(`Received weather forecast: high ${result.highTemperature}, low ${result.lowTemperature}, precip ${result.chancePrecipitation}`);
                return result;
            }

            return { highTemperature: 0, lowTemperature: 0, chancePrecipitation: 0 };
        },
        enabled: reverseGeocode !== undefined,
        refetchInterval: 15 * 60 * 1000
    });
}

export function getUvForecastQuery(reverseGeocode?: ReverseGeocode) {
    return queryOptions({
        queryKey: ["uvForecast", reverseGeocode?.zip],
        queryFn: async () => {
            if (reverseGeocode !== undefined) {
                console.log(`Fetching UV for ${reverseGeocode.zip}...`);

                const response = await fetch(`/uv?zip=${reverseGeocode.zip}`);
                if (!response.ok) {
                    throw new Error(await formatApiError(response));
                }

                const result = await response.json() as UvForecastDay;
                console.info(`Received UV: ${result.forecasts.length} time segments`);
                return result;
            }

            return { forecasts: [] };
        },
        enabled: reverseGeocode !== undefined,
        refetchInterval: 60 * 60 * 1000
    });
}