import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { WeatherConditions, WeatherForecast, UvForecastDay, ReverseGeocode, UvForecastHour } from "../shared/types";
import { HTTPException } from "hono/http-exception";

async function getReverseGeocode(userAgent: string, weatherApiKey: string, { lat, lon }: { lat: number, lon: number }): Promise<ReverseGeocode> {
  let zip: string;
  {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: {
        "user-agent": userAgent
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
        "user-agent": weatherApiKey
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
        "user-agent": weatherApiKey
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

async function getWeatherCurrent(apiKey: string, { station }: { station: string }): Promise<WeatherConditions> {
  const response = await fetch(`https://api.weather.gov/stations/${station}/observations/latest`, {
    headers: {
      "user-agent": apiKey
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
  const textDescription = "textDescription" in properties && typeof properties.textDescription === "string" ? properties.textDescription : "";

  const parseMetarTemperature = (metar: string) => {
    const components = metar.split(" ");
    const tempDewPoint = components.find(comp => comp.startsWith("T") && comp.length === 9);
    if (tempDewPoint !== undefined) {
      const negative = tempDewPoint[1] == "1" ? -1 : 1;
      return negative * parseInt(tempDewPoint.slice(2, 5)) / 10.0;
    }
    return undefined;
  };

  // Use temperature if explicitly provided; otherwise if the METAR is available, parse from that instead
  if ("temperature" in properties && typeof properties.temperature === "object" && properties.temperature !== null &&
    "value" in properties.temperature && typeof properties.temperature.value === "number") {
    return { description: textDescription, temperature: properties.temperature.value };
  }
  else if ("rawMessage" in properties && typeof properties.rawMessage === "string") {
    const metarTemperature = parseMetarTemperature(properties.rawMessage);
    if (metarTemperature === undefined) {
      throw new HTTPException(undefined, { message: `<${response.url}> response rawMessage (METAR) is missing temperature` });
    }

    return { description: textDescription, temperature: metarTemperature };
  }
  else {
    throw new HTTPException(undefined, { message: `<${response.url}> response is missing temperature or rawMessage` });
  }
}

async function getWeatherForecast(apiKey: string, { wfo, x, y }: { wfo: string, x: number, y: number }): Promise<WeatherForecast> {
  const response = await fetch(`https://api.weather.gov/gridpoints/${wfo}/${x},${y}`, {
    headers: {
      "user-agent": apiKey
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
  if (!("minTemperature" in properties && "maxTemperature" in properties)) {
    throw new HTTPException(undefined, { message: `<${response.url}> response is missing maxTemperature or minTemperature` });
  }

  const { maxTemperature, minTemperature } = properties;

  const findBestValue = (values: unknown[]) => {
    const now = Temporal.Now.zonedDateTimeISO("UTC");
    for (const entry of values) {
      if (typeof entry === "object" && entry !== null && "validTime" in entry && "value" in entry) {
        const { validTime, value } = entry;
        if (typeof validTime === "string" && typeof value === "number") {
          const [timeString, durationString] = validTime.split("/");
          const time = Temporal.Instant.from(timeString).toZonedDateTimeISO("UTC");
          const duration = Temporal.Duration.from(durationString);
          const endTime = time.add(duration);
          if (Temporal.ZonedDateTime.compare(now, endTime) <= 0) {
            return value;
          }
        }
      }
    }
    return undefined;
  };

  let high: undefined | number = undefined;
  if (typeof maxTemperature === "object" && maxTemperature !== null && "values" in maxTemperature) {
    const values = maxTemperature.values;
    if (Array.isArray(values)) {
      high = findBestValue(values);
    }
  }

  let low: undefined | number = undefined;
  if (typeof minTemperature === "object" && minTemperature !== null && "values" in minTemperature) {
    const values = minTemperature.values;
    if (Array.isArray(values)) {
      low = findBestValue(values);
    }
  }

  if (low === undefined || high === undefined) {
    throw new HTTPException(undefined, { message: `<${response.url}> response is missing non-expired elements for maxTemperature or minTemperature` });
  }

  let chancePrecipitation: undefined | number = undefined;
  if ("probabilityOfPrecipitation" in properties && typeof properties.probabilityOfPrecipitation === "object" && properties.probabilityOfPrecipitation !== null &&
    "values" in properties.probabilityOfPrecipitation && Array.isArray(properties.probabilityOfPrecipitation.values)) {
    chancePrecipitation = findBestValue(properties.probabilityOfPrecipitation.values);
  }

  return { highTemperature: high, lowTemperature: low, chancePrecipitation: chancePrecipitation ?? 0.0 };
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

const app = new Hono<{ Bindings: Env }>()
  .get(
    "/weather",
    zValidator(
      "query",
      z.object({
        station: z.string(),
      })
    ),
    async (c) => c.json(await getWeatherCurrent(c.env.WEATHER_API_KEY, c.req.valid("query"))))
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
    async (c) => c.json(await getWeatherForecast(c.env.WEATHER_API_KEY, c.req.valid("query"))))
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
    "/geo",
    zValidator(
      "query",
      z.object({
        lat: z.coerce.number(),
        lon: z.coerce.number(),
      })
    ),
    async (c) => c.json(await getReverseGeocode(c.env.OSM_NOMINATIM_USER_AGENT, c.env.WEATHER_API_KEY, c.req.valid("query"))))
  .get("/realtime", getGtfsRealtime)
  .get("/gtfs", getGtfsStatic)
  ;

export default app;
export type AppType = typeof app;