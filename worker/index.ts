import JSZip from "jszip";
import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { DirectionId, RouteId, StopId, BusTimes, TransitSystemInfo, WeatherConditions, WeatherForecast, UvForecastDay, ReverseGeocode, ApiError, UvForecastHour, StopInstance, RouteInstance, BusInstance, DirectionInstance, TransitSystemRoute } from "../shared/types";
import { HTTPException } from "hono/http-exception";

async function getReverseGeocode(userAgent: string, weatherApiKey: string, { lat, lon }: { lat: number, lon: number }): Promise<ReverseGeocode> {
  let zip: string;
  {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: {
        "user-agent": userAgent
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

  return { lat, lon, zip, weatherTile, weatherStation };
}

async function getBusTimes({ stops }: { stops: string }): Promise<BusTimes> {
  const stopsList = stops.split(",");

  const response = await fetch("https://data.texas.gov/download/mqtr-wwpy/text%2Fplain");

  const { ok, headers } = response;
  if (!ok) {
    throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
  }

  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("application/octet-stream")) {
    throw new HTTPException(undefined, { message: `<${response.url}> did not respond with octet-stream content` });
  }

  let payload: unknown;
  try {
    const jsonString = new TextDecoder("utf-8").decode(await response.arrayBuffer());
    payload = JSON.parse(jsonString) as unknown;
  }
  catch (e) {
    throw new HTTPException(undefined, { message: `Error parsing JSON: ${e}`, cause: e });
  }

  if (typeof payload !== "object" || payload === null) {
    throw new HTTPException(undefined, { message: `<${response.url}> response is missing JSON root object` });
  }

  if (!("header" in payload) || typeof payload.header !== "object" || payload.header === null ||
    !("timestamp" in payload.header) || typeof payload.header.timestamp !== "string") {
    throw new HTTPException(undefined, { message: `<${response.url}> response is missing header or header.timestamp` });
  }

  const feedTimestamp = parseInt(payload.header.timestamp);

  if (!("entity" in payload) || !Array.isArray(payload.entity)) {
    throw new HTTPException(undefined, { message: `<${response.url}> response is missing entity` });
  }

  const arrivals: Map<StopId, Map<RouteId, Map<DirectionId, { hasLeftTerminus: boolean, seconds: number }[]>>> = new Map();
  for (const stopId of stopsList) {
    arrivals.set(stopId, new Map());
  }

  function getBusInstancesArray(stopId: StopId, routeId: RouteId, directionId: DirectionId): { hasLeftTerminus: boolean, seconds: number }[] {
    let arrivalsStop = arrivals.get(stopId);
    if (arrivalsStop === undefined) {
      arrivalsStop = new Map();
      arrivals.set(stopId, new Map());
    }

    let arrivalsRoute = arrivalsStop.get(routeId);
    if (arrivalsRoute === undefined) {
      arrivalsRoute = new Map();
      arrivalsStop.set(routeId, arrivalsRoute);
    }

    let arrivalsDirection = arrivalsRoute.get(directionId);
    if (arrivalsDirection === undefined) {
      arrivalsDirection = [];
      arrivalsRoute.set(directionId, arrivalsDirection);
    }

    return arrivalsDirection;
  }

  for (const entity of payload.entity as unknown[]) {
    if (typeof entity === "object" && entity !== null &&
      "tripUpdate" in entity && typeof entity.tripUpdate === "object" && entity.tripUpdate !== null &&
      "trip" in entity.tripUpdate && typeof entity.tripUpdate.trip === "object" && entity.tripUpdate.trip !== null &&
      "stopTimeUpdate" in entity.tripUpdate && Array.isArray(entity.tripUpdate.stopTimeUpdate)) {
      const { trip, stopTimeUpdate } = entity.tripUpdate;
      if ("routeId" in trip && typeof trip.routeId === "string" &&
        "directionId" in trip && typeof trip.directionId === "number") {
        const { routeId, directionId } = trip;
        {
          let hasLeftTerminus = true;
          for (const update of stopTimeUpdate as unknown[]) {
            if (typeof update === "object" && update !== null) {
              // Check if this is the initial terminus stop (must be the first stop!)
              if (hasLeftTerminus &&
                "stopSequence" in update && update.stopSequence === 1 &&
                "departure" in update && typeof update.departure === "object" && update.departure !== null &&
                "time" in update.departure && typeof update.departure.time === "string") {
                // Check if the bus had not left the terminus yet when the feed was generated
                const departureTimestamp = parseInt(update.departure.time);
                if (departureTimestamp > feedTimestamp) {
                  // If so, then mark that the bus is still at the terminus
                  hasLeftTerminus = false;
                }
              }

              // Now check if this stop is on the list of stops for which to get bus times
              if ("stopId" in update && typeof update.stopId === "string" &&
                stopsList.includes(update.stopId) &&
                "scheduleRelationship" in update &&
                "arrival" in update && typeof update.arrival === "object" && update.arrival !== null &&
                "time" in update.arrival && typeof update.arrival.time === "string") {
                if (update.scheduleRelationship === "SCHEDULED") {
                  getBusInstancesArray(update.stopId, routeId, directionId).push({ hasLeftTerminus, seconds: parseInt(update.arrival.time) });
                }

                // This stop cannot occur again in this tripUpdate.stopTimeUpdate
                break;
              }
            }
          }
        }
      }
    }
  }

  const busTimes: BusTimes = { stops: [] };
  for (const [stopId, routes] of arrivals) {
    const niceStop: StopInstance = { stopId, routes: [] };
    busTimes.stops.push(niceStop);

    for (const [routeId, directions] of routes) {
      const niceRoute: RouteInstance = { routeId, directions: [] };
      niceStop.routes.push(niceRoute);

      for (const [directionId, times] of directions) {
        const nextInstances: BusInstance[] = times.sort((a, b) => a.seconds - b.seconds).slice(0, 5).map(arrival => ({ hasLeftTerminus: arrival.hasLeftTerminus, time: Temporal.Instant.fromEpochMilliseconds(arrival.seconds * 1000.0).toString() }));
        const niceDirection: DirectionInstance = { directionId, nextInstances };
        niceRoute.directions.push(niceDirection);
      }
    }
  }

  return busTimes;
}

async function getTransitInfo({ lat, lon }: { lat: number, lon: number }): Promise<TransitSystemInfo> {
  const response = await fetch("https://data.texas.gov/download/r4v4-vz24/application%2Fzip");

  const { ok, headers } = response;
  if (!ok) {
    throw new HTTPException(undefined, { message: `<${response.url}> responded with: ${response.status}` });
  }

  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("application/octet-stream")) {
    throw new HTTPException(undefined, { message: `<${response.url}> did not respond with octet-stream content` });
  }

  let zipPayload: JSZip;
  try {
    const zip = new JSZip();
    const zipData = await response.arrayBuffer();
    zipPayload = await zip.loadAsync(zipData);
  }
  catch (e) {
    throw new HTTPException(undefined, { message: `Error reading ZIP archive: ${e}`, cause: e });
  }

  const transitInfo: TransitSystemInfo = { routes: [], closestStops: [] };

  const tripsFile = zipPayload.file("trips.txt");
  if (tripsFile === null) {
    throw new HTTPException(undefined, { message: `<${response.url}> is missing trips.txt` });
  }

  let tripsCsv: string;
  try {
    tripsCsv = await tripsFile.async("string");
  }
  catch (e) {
    throw new HTTPException(undefined, { message: `Error reading trips.txt: ${e}`, cause: e });
  }

  const tripsCsvLines = tripsCsv.split("\n");
  if (tripsCsvLines.length <= 1) {
    throw new HTTPException(undefined, { message: `<${response.url}> trips.txt is malformed` });
  }

  {
    const headerFields = tripsCsvLines[0].trim().split(",");
    const routeIdIndex = headerFields.indexOf("route_id");
    const directionIdIndex = headerFields.indexOf("direction_id");
    const tripShortNameIndex = headerFields.indexOf("trip_short_name");

    const routeNames: Map<string, Map<number, string>> = new Map();
    for (let i = 1; i < tripsCsvLines.length; ++i) {
      const line = tripsCsvLines[i];
      const fields = line.trim().split(",");
      const routeId = fields[routeIdIndex];
      const directionId = parseInt(fields[directionIdIndex]);
      const tripShortName = fields[tripShortNameIndex];

      let directions = routeNames.get(routeId);
      if (directions === undefined) {
        directions = new Map();
        routeNames.set(routeId, directions);
      }

      directions.set(directionId, tripShortName);
    }

    for (const [routeId, directions] of routeNames) {
      const niceRoute: TransitSystemRoute = { routeId, directions: [] };
      transitInfo.routes.push(niceRoute);

      for (const [directionId, name] of directions) {
        const niceDirection = { directionId, name };
        niceRoute.directions.push(niceDirection);
      }
    }
  }

  const stopsFiles = zipPayload.file("stops.txt");
  if (stopsFiles === null) {
    throw new HTTPException(undefined, { message: `<${response.url}> is missing stops.txt` });
  }

  let stopsCsv: string;
  try {
    stopsCsv = await stopsFiles.async("string");
  }
  catch (e) {
    throw new HTTPException(undefined, { message: `Error reading stops.txt: ${e}`, cause: e });
  }

  const stopsCsvLines = stopsCsv.split("\n");
  if (stopsCsvLines.length <= 1) {
    throw new HTTPException(undefined, { message: `<${response.url}> stops.txt is malformed` });
  }

  {
    const headerFields = stopsCsvLines[0].trim().split(",");
    const stopIdIndex = headerFields.indexOf("stop_id");
    const stopLatIndex = headerFields.indexOf("stop_lat");
    const stopLonIndex = headerFields.indexOf("stop_lon");

    const maxClosestStops = 2;
    const closestStops: { stopId: StopId, angle: number }[] = [];
    for (let i = 1; i < stopsCsvLines.length; ++i) {
      const line = stopsCsvLines[i];
      const fields = line.trim().split(",");
      const stopId = fields[stopIdIndex];
      const stopLat = parseFloat(fields[stopLatIndex]);
      const stopLon = parseFloat(fields[stopLonIndex]);

      function rad(degrees: number) {
        return degrees * (Math.PI / 180);
      }

      function hav(angle: number) {
        return (1.0 - Math.cos(angle)) / 2.0;
      }

      function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
        const dlat = lat1 - lat2;
        const dlon = lon1 - lon2;
        return hav(dlat) + (Math.cos(lat1) * Math.cos(lat2) * hav(dlon));
      }

      const angle = haversine(rad(lat), rad(lon), rad(stopLat), rad(stopLon));
      const insertIndex = closestStops.findIndex(elem => angle < elem.angle);
      if (insertIndex == -1 && closestStops.length < maxClosestStops) {
        closestStops.push({ stopId, angle });
      }
      else if (insertIndex >= 0 && insertIndex < closestStops.length) {
        closestStops.splice(insertIndex, 0, { stopId, angle });
        if (closestStops.length > maxClosestStops) {
          closestStops.length = maxClosestStops;
        }
      }
    }

    transitInfo.closestStops = closestStops.map(elem => elem.stopId);
  }

  return transitInfo;
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
  const response = await fetch(`https://data.epa.gov/efservice/getEnvirofactsUVHOURLY/ZIP/${zip}/JSON`);

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

interface Env {
  WEATHER_API_KEY: string;
  OSM_NOMINATIM_USER_AGENT: string;
}

const app = new Hono<{ Bindings: Env }>()
  .onError((err, c) => {
    console.error(err);
    if (err instanceof HTTPException) {
      const apiError: ApiError = { status: err.status, error: err.message };
      return c.json(apiError, err.status);
    }
    else {
      const apiError: ApiError = { status: 500, error: err.message };
      return c.json(apiError, 500);
    }
  })
  .get(
    "/bustimes",
    zValidator(
      "query",
      z.object({
        stops: z.string(),
      })
    ),
    async (c) => c.json(await getBusTimes(c.req.valid("query"))))
  .get(
    "/transitinfo",
    zValidator(
      "query",
      z.object({
        lat: z.number(),
        lon: z.number(),
      })
    ),
    async (c) => c.json(await getTransitInfo(c.req.valid("query"))))
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
        x: z.number().int(),
        y: z.number().int(),
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
        lat: z.number(),
        lon: z.number(),
      })
    ),
    async (c) => c.json(await getReverseGeocode(c.env.OSM_NOMINATIM_USER_AGENT, c.env.WEATHER_API_KEY, c.req.valid("query"))))
  ;

export default app;
export type AppType = typeof app;