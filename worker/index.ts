import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { WeatherConditions, WeatherForecast, UvForecastDay, ReverseGeocode, UvForecastHour, WeatherForecastHour, AirQuality, isNwsIcon } from "../shared/types";
import { decodeMetar } from "../shared/metar";
import { HTTPException } from "hono/http-exception";

async function getReverseGeocode(osmUserAgent: string, nwsUserAgent: string, { lat, lon }: { lat: number, lon: number }): Promise<ReverseGeocode> {
  let zip: string;
  {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: {
        "user-agent": osmUserAgent
      },
      cf: {
        "cacheEverything": true,
        "cacheTtlByStatus": {
          "200-299": 86400 // cache successful responses for 1 day
        }
      }
    });

    const { ok, headers } = response;
    if (!ok) {
      throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
    }

    const contentType = headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new HTTPException(undefined, { message: `<${response.url}> did not respond with JSON content` });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    }
    catch (e) {
      throw new HTTPException(undefined, { message: `Error parsing JSON: ${e}`, cause: e });
    }

    if (typeof payload === "object" && payload !== null &&
      "address" in payload && typeof payload.address === "object" && payload.address !== null &&
      "postcode" in payload.address && typeof payload.address.postcode === "string") {
      zip = payload.address.postcode;
    }
    else {
      throw new HTTPException(undefined, { message: `<${response.url}> response is missing postcode` });
    }
  }

  let weatherTile: { wfo: string, x: number, y: number };
  let observationStationsUri: string;
  {
    const response = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: {
        "user-agent": nwsUserAgent
      },
      cf: {
        "cacheEverything": true
      }
    });

    const { ok, headers } = response;
    if (!ok) {
      throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
    }

    const contentType = headers.get("content-type") || "";
    if (!contentType.includes("application/geo+json")) {
      throw new HTTPException(undefined, { message: `<${response.url}> did not respond with JSON content` });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    }
    catch (e) {
      throw new HTTPException(undefined, { message: `Error parsing JSON: ${e}`, cause: e });
    }

    if (typeof payload === "object" && payload !== null &&
      "properties" in payload && typeof payload.properties === "object" && payload.properties !== null &&
      "gridId" in payload.properties && typeof payload.properties.gridId === "string" &&
      "gridX" in payload.properties && typeof payload.properties.gridX === "number" &&
      "gridY" in payload.properties && typeof payload.properties.gridY === "number") {
      weatherTile = { wfo: payload.properties.gridId, x: payload.properties.gridX, y: payload.properties.gridY };
    }
    else {
      throw new HTTPException(undefined, { message: `<${response.url}> response is missing forecast grid` });
    }

    if ("observationStations" in payload.properties && typeof payload.properties.observationStations === "string") {
      observationStationsUri = payload.properties.observationStations;
    }
    else {
      throw new HTTPException(undefined, { message: `<${response.url}> response is missing observation stations` });
    }
  }

  let weatherStation: string | null = null;
  console.log(`Fetching observation stations from <${observationStationsUri}>...`);
  {
    const response = await fetch(observationStationsUri, {
      headers: {
        "user-agent": nwsUserAgent
      },
      cf: {
        "cacheEverything": true
      }
    });

    const { ok, headers } = response;
    if (!ok) {
      throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
    }

    const contentType = headers.get("content-type") || "";
    if (!contentType.includes("application/geo+json")) {
      throw new HTTPException(undefined, { message: `<${response.url}> did not respond with JSON content` });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    }
    catch (e) {
      throw new HTTPException(undefined, { message: `Error parsing JSON: ${e}`, cause: e });
    }

    if (typeof payload === "object" && payload !== null &&
      "features" in payload && Array.isArray(payload.features) && payload.features.length != 0) {
      const firstFeature = payload.features[0] as unknown;
      if (typeof firstFeature === "object" && firstFeature !== null &&
        "properties" in firstFeature && typeof firstFeature.properties === "object" && firstFeature.properties !== null &&
        "stationIdentifier" in firstFeature.properties && typeof firstFeature.properties.stationIdentifier === "string") {
        weatherStation = firstFeature.properties.stationIdentifier;
      }
    }

    if (weatherStation === null) {
      throw new HTTPException(undefined, { message: `<${response.url}> response is missing station features` });
    }
  }

  let radarStation: string | null = null;
  {
    const response = await fetch("https://opengeo.ncep.noaa.gov/geoserver/nws/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=nws:radar_sites&outputFormat=application/json");
    const { ok, headers } = response;
    if (!ok) {
      throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
    }

    const contentType = headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new HTTPException(undefined, { message: `<${response.url}> did not respond with JSON content` });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    }
    catch (e) {
      throw new HTTPException(undefined, { message: `Error parsing JSON: ${e}`, cause: e });
    }

    const radars: { radarName: string, distance: number }[] = [];
    if (typeof payload === "object" && payload !== null &&
      "features" in payload && Array.isArray(payload.features)) {
      for (const feature of payload.features as unknown[]) {
        if (typeof feature === "object" && feature !== null &&
          "properties" in feature && typeof feature.properties === "object" && feature.properties !== null &&
          "rda_id" in feature.properties && "lon" in feature.properties && "lat" in feature.properties) {
          const { rda_id: radarName, lon: radarLon, lat: radarLat } = feature.properties;
          if (typeof radarName === "string" && typeof radarLon === "number" && typeof radarLat === "number") {
            // This distance measure isn't exactly correct because lon/lat are not the same distance,
            // but this is close enough
            const distance = (radarLon - lon) * (radarLon - lon) + (radarLat - lat) * (radarLat - lat);
            radars.push({ radarName, distance });
          }
        }
      }
    }

    if (radars.length == 0) {
      throw new HTTPException(undefined, { message: `<${response.url}> response is missing radar stations` });
    }

    radarStation = radars.sort((a, b) => a.distance - b.distance)[0].radarName;
  }

  return { lat, lon, zip, weatherTile, weatherStation, radarStation };
}

async function getGtfsStatic(): Promise<Response> {
  const response = await fetch("https://data.texas.gov/download/r4v4-vz24/application%2Fzip", {
    cf: {
      "cacheEverything": true,
      "cacheTtlByStatus": {
        "200-299": 86400 // cache successful responses for 1 day
      }
    }
  });
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Cache-Control", "max-age=3600");
  return newResponse;
}

async function getGtfsRealtime(): Promise<Response> {
  const response = await fetch("https://data.texas.gov/download/rmk2-acnw/application%2Foctet-stream");
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Cache-Control", "max-age=30");
  return newResponse;
}

async function getMetar({ station }: { station: string }): Promise<WeatherConditions> {
  const response = await fetch(`https://aviationweather.gov/api/data/metar?ids=${station}&format=raw`);
  const { ok, headers } = response;
  if (!ok) {
    throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
  }

  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("text/plain")) {
    throw new HTTPException(undefined, { message: `<${response.url}> did not respond with text content` });
  }

  const metar = await response.text();
  const weatherConditions = decodeMetar(metar);
  if (weatherConditions !== null) {
    return weatherConditions;
  }

  throw new HTTPException(undefined, { message: `<${response.url}> response could not be decoded as a METAR` });
}

const ICON_URL_REGEX = /(?:night|day)\/([a-z_]+)/;

async function getWeatherForecast(userAgent: string, { wfo, x, y }: { wfo: string, x: number, y: number }): Promise<WeatherForecast> {
  const response = await fetch(`https://api.weather.gov/gridpoints/${wfo}/${x},${y}/forecast/hourly`, {
    headers: {
      "user-agent": userAgent,
      "feature-flags": "forecast_temperature_qv",
    }
  });

  const { ok, headers } = response;
  if (!ok) {
    throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
  }

  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("application/geo+json")) {
    throw new HTTPException(undefined, { message: `<${response.url}> did not respond with JSON content` });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  }
  catch (e) {
    throw new HTTPException(undefined, { message: `Error parsing JSON: ${e}`, cause: e });
  }

  if (typeof payload !== "object" || payload === null || !("properties" in payload) || typeof payload.properties !== "object" || payload.properties === null) {
    throw new HTTPException(undefined, { message: `<${response.url}> response is missing properties` });
  }

  const properties = payload.properties;
  if (!("periods" in properties && Array.isArray(properties.periods))) {
    throw new HTTPException(undefined, { message: `<${response.url}> response is missing periods property` });
  }

  const forecasts: WeatherForecastHour[] = [];
  for (const period of properties.periods as unknown[]) {
    if (typeof period === "object" && period !== null &&
      "startTime" in period && typeof period.startTime === "string" &&
      "temperature" in period && typeof period.temperature === "object" && period.temperature !== null &&
      "value" in period.temperature && typeof period.temperature.value === "number" &&
      "probabilityOfPrecipitation" in period && typeof period.probabilityOfPrecipitation === "object" && period.probabilityOfPrecipitation !== null &&
      "value" in period.probabilityOfPrecipitation && typeof period.probabilityOfPrecipitation.value === "number" &&
      "shortForecast" in period && typeof period.shortForecast === "string" &&
      "icon" in period && typeof period.icon === "string") {
      const iconMatch = period.icon.match(ICON_URL_REGEX);
      const icon = iconMatch !== null && iconMatch.length >= 2 && isNwsIcon(iconMatch[1]) ? iconMatch[1] : "skc";
      forecasts.push({
        temperature: period.temperature.value,
        chancePrecipitation: period.probabilityOfPrecipitation.value,
        description: period.shortForecast,
        icon,
        time: period.startTime
      })
    }

    // Maximum one day forward
    if (forecasts.length === 24) {
      break;
    }
  }

  if (forecasts.length === 0) {
    throw new HTTPException(undefined, { message: `<${response.url}> response has empty periods array` });
  }

  // Iterate through forecast periods until we hit 6 AM and 6 PM.
  // Find the high and low temperature within that range.
  // e.g., at 5 AM returns the high and low between 5 AM-6 PM.
  //       at 6 AM returns the high and low between 6 AM-6 AM the next day.
  //       at 8 PM returns the high and low between 8 PM-6 PM the next day.
  let high = forecasts[0].temperature;
  let low = forecasts[0].temperature;
  let sixes = 0;
  for (let i = 1; i < forecasts.length; ++i) {
    const forecast = forecasts[i];
    const time = Temporal.PlainDateTime.from(forecast.time);
    if (time.hour === 6 || time.hour === 18) {
      sixes++;
    }

    high = Math.max(high, forecast.temperature);
    low = Math.min(low, forecast.temperature);

    if (sixes === 2) {
      console.info(`Calculated low/high temp using next ${i} periods`);
      break;
    }
  }

  return { highTemperature: high, lowTemperature: low, forecasts };
}

async function getUvForecastDay({ zip }: { zip: string }): Promise<UvForecastDay> {
  const response = await fetch(`https://data.epa.gov/efservice/getEnvirofactsUVHOURLY/ZIP/${zip}/JSON`, {
    cf: {
      "cacheEverything": true,
      "cacheTtlByStatus": {
        "200-299": 3600 // cache successful responses for 1 hour
      }
    }
  });

  const { ok, headers } = response;
  if (!ok) {
    throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
  }

  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new HTTPException(undefined, { message: `<${response.url}> did not respond with JSON content` });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  }
  catch (e) {
    throw new HTTPException(undefined, { message: `Error parsing JSON: ${e}`, cause: e });
  }

  if (!Array.isArray(payload)) {
    throw new HTTPException(undefined, { message: `<${response.url}> response JSON is not an array as expected` });
  }

  const forecasts: UvForecastHour[] = [];
  for (const element of payload as unknown[]) {
    if (typeof element === "object" && element !== null &&
      "DATE_TIME" in element && typeof element["DATE_TIME"] === "string" &&
      "UV_VALUE" in element && typeof element["UV_VALUE"] === "number") {
      const parseTime = (d: string) => {
        const components = d.split(" "); // Apr/26/2025 06 AM
        if (components.length === 3) {
          const dateComponents = components[0].split("/"); // Apr/26/2025
          if (dateComponents.length === 3) {
            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            const month = months.indexOf(dateComponents[0].toUpperCase()) + 1;
            const day = parseInt(dateComponents[1]);
            const year = parseInt(dateComponents[2]);
            if (month >= 1 && month <= 12) {
              const hour12 = parseInt(components[1]) % 12;
              const pm = (components[2].toUpperCase() == "PM");
              const hour24 = pm ? hour12 + 12 : hour12;

              return Temporal.PlainDateTime.from({ year, month, day, hour: hour24 });
            }
          }
        }

        return undefined;
      };

      const time = parseTime(element.DATE_TIME);
      if (time !== undefined) {
        forecasts.push({ uvIndex: element.UV_VALUE, time: time.toString() });
      }
    }
  }

  return { forecasts };
}

async function getAqi(airNowApiKey: string, { zip }: { zip: string }): Promise<AirQuality> {
  const response = await fetch(`https://www.airnowapi.org/aq/observation/zipCode/current/?format=application/json&zipCode=${zip}&distance=25&API_KEY=${airNowApiKey}`,
    {
      cf: {
        "cacheEverything": true,
        "cacheTtlByStatus": {
          "200-299": 1800 // cache successful responses for 30 minutes
        }
      }
    });

  const { ok, headers } = response;
  if (!ok) {
    throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
  }

  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new HTTPException(undefined, { message: `<${response.url}> did not respond with JSON content` });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  }
  catch (e) {
    throw new HTTPException(undefined, { message: `Error parsing JSON: ${e}`, cause: e });
  }

  if (!Array.isArray(payload)) {
    throw new HTTPException(undefined, { message: `<${response.url}> response JSON is not an array as expected` });
  }

  let maxAqi = -1;
  for (const report of payload as unknown[]) {
    if (typeof report === "object" && report !== null &&
      "AQI" in report && typeof report.AQI === "number") {
        maxAqi = Math.max(maxAqi, report.AQI);
      }
  }

  return { AQI: maxAqi >= 0 ? maxAqi : null };
}

const app = new Hono<{ Bindings: Env }>()
  .get(
    "/metar",
    zValidator(
      "query",
      z.object({
        station: z.string(),
      })
    ),
    async (c) => c.json(await getMetar(c.req.valid("query"))))
  .get(
    "/forecast",
    zValidator(
      "query",
      z.object({
        wfo: z.string(),
        x: z.coerce.number().int(),
        y: z.coerce.number().int(),
      })
    ),
    async (c) => c.json(await getWeatherForecast(c.env.NWS_USER_AGENT, c.req.valid("query"))))
  .get(
    "/uv",
    zValidator(
      "query",
      z.object({
        zip: z.string(),
      })
    ),
    async (c) => c.json(await getUvForecastDay(c.req.valid("query"))))
  .get(
    "/aqi",
    zValidator(
      "query",
      z.object({
        zip: z.string(),
      })
    ),
    async (c) => c.json(await getAqi(c.env.AIRNOW_API_KEY, c.req.valid("query"))))
  .get(
    "/geo",
    zValidator(
      "query",
      z.object({
        lat: z.coerce.number(),
        lon: z.coerce.number(),
      })
    ),
    async (c) => {
      c.header("Cache-Control", "max-age=86400")
      return c.json(await getReverseGeocode(c.env.OSM_NOMINATIM_USER_AGENT, c.env.NWS_USER_AGENT, c.req.valid("query")));
    })
  .get("/realtime", getGtfsRealtime)
  .get("/gtfs", getGtfsStatic)
  ;

export default app;
export type AppType = typeof app;