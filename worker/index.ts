import JSZip from "jszip";
import { Temporal } from "@js-temporal/polyfill";
import { DirectionId, RouteId, StopId, StopInstance, BusTimes, RouteNames, WeatherConditions, WeatherForecast, UvForecastDay } from "../shared/types";

async function getBusTimes(stops: string[]): Promise<BusTimes> {
  const response = await fetch("https://data.texas.gov/download/mqtr-wwpy/text%2Fplain");
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/octet-stream")) {
    try {
      const jsonString = new TextDecoder("utf-8").decode(await response.arrayBuffer());
      const payload = JSON.parse(jsonString) as unknown;

      if (typeof payload === "object" && payload !== null && "entity" in payload && Array.isArray(payload.entity)) {
        const arrivals: Map<StopId, Map<RouteId, Map<DirectionId, StopInstance[]>>> = new Map();
        for (const stopId of stops) {
          arrivals.set(stopId, new Map());
        }

        function getStopInstancesArray(stopId: StopId, routeId: RouteId, directionId: DirectionId): StopInstance[] | undefined {
          const arrivalsStop = arrivals.get(stopId);
          if (arrivalsStop === undefined) {
            return undefined;
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
          if (typeof entity === "object" && entity !== null && "tripUpdate" in entity &&
              typeof entity.tripUpdate === "object" && entity.tripUpdate !== null && "trip" in entity.tripUpdate && "stopTimeUpdate" in entity.tripUpdate) {
            const { trip, stopTimeUpdate } = entity.tripUpdate;
            if (typeof trip === "object" && trip !== null && "routeId" in trip && "directionId" in trip &&
                Array.isArray(stopTimeUpdate)) {
              const { routeId, directionId } = trip;
              if (typeof routeId === "string" && typeof directionId === "number") {
                let anyStopSequences = false;
                let hasTerminusStopSequence = false;
                for (const update of stopTimeUpdate as unknown[]) {
                  if (typeof update === "object" && update !== null && "stopSequence" in update) {
                    anyStopSequences = true;
                    if (update.stopSequence === 1) {
                      hasTerminusStopSequence = true;
                    }
                  }

                  if (anyStopSequences && hasTerminusStopSequence) {
                    break;
                  }
                }

                for (const update of stopTimeUpdate as unknown[]) {
                  if (typeof update === "object" && update !== null && "arrival" in update && "stopId" in update && "scheduleRelationship" in update) {
                    const { arrival, stopId, scheduleRelationship } = update;
                    if (typeof arrival === "object" && arrival !== null && "time" in arrival && typeof arrival.time === "string" &&
                        typeof stopId === "string" &&
                        scheduleRelationship === "SCHEDULED") {
                      const instances = getStopInstancesArray(stopId, routeId, directionId);
                      if (instances !== undefined) {
                        const time = Temporal.Instant.fromEpochMilliseconds(parseInt(arrival.time) * 1000.0);
                        instances.push({ hasLeftTerminus: !anyStopSequences || !hasTerminusStopSequence, time: time.toString() });
                      }
                    }
                  }
                }
              }
            }
          }
        }

        const niceStops = Array.from(arrivals, ([stopId, routes]) => {
          const niceRoutes = Array.from(routes, ([routeId, directions]) => {
            const niceDirections = Array.from(directions, ([directionId, times]) => {
              const nextInstances = times.sort((a, b) => Temporal.Instant.compare(a.time, b.time)).slice(0, 5);
              return { directionId, nextInstances };
            });
            return { routeId, directions: niceDirections };
          });
          return { stopId, routes: niceRoutes };
        });

        return { ok: true, stops: niceStops };
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  return { ok: false, stops: [] };
}

async function getRouteNames(): Promise<RouteNames> {
  const response = await fetch("https://data.texas.gov/download/r4v4-vz24/application%2Fzip");
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/octet-stream")) {
    try {
      const zip = new JSZip();
      const zipData = await response.arrayBuffer();
      const zipPayload = await zip.loadAsync(zipData);
      const tripsFile = zipPayload.file("trips.txt");
      if (tripsFile !== null) {
        const tripsCsv = await tripsFile.async("string");
        const tripsCsvLines = tripsCsv.split("\n");

        if (tripsCsvLines.length > 1) {
          const headerFields = tripsCsvLines[0].trim().split(",");
          const routeIdIndex = headerFields.indexOf("route_id");
          const directionIdIndex = headerFields.indexOf("direction_id");
          const tripShortNameIndex = headerFields.indexOf("trip_short_name");

          const routeNames: Map<string, Map<number, string>> = new Map();
          for (const line of tripsCsvLines.slice(1)) {
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

          const niceRoutes = Array.from(routeNames, ([routeId, directions]) => {
            const niceDirections = Array.from(directions, ([directionId, name]) => {
              return { directionId, name };
            });
            return { routeId, directions: niceDirections };
          });

          return { ok: true, routes: niceRoutes };
        }
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  return { ok: false, routes: [] };
}

async function getWeatherCurrent(station: string, apiKey: string): Promise<WeatherConditions> {
  const response = await fetch(`https://api.weather.gov/stations/${station}/observations/latest`, {
    headers: {
      "user-agent": apiKey
    }
  });
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/geo+json")) {
    try {
      const payload = await response.json();
      if (typeof payload === "object" && payload !== null && "properties" in payload)
      {
        const properties = payload.properties;
        if (typeof properties === "object" && properties !== null &&
            "textDescription" in properties && typeof properties.textDescription === "string") {
          const parseMetarTemperature = (metar: string) => {
            const components = metar.split(" ");
            const tempDewPoint = components.find(comp => comp.startsWith("T") && comp.length === 9);
            if (tempDewPoint !== undefined)
            {
              const negative = tempDewPoint[1] == "1" ? -1 : 1;
              return negative * parseInt(tempDewPoint.slice(2, 5)) / 10.0;
            }
            return undefined;
          };

          // Use temperature if explicitly provided; otherwise if the METAR is available, parse from that instead
          if ("temperature" in properties && typeof properties.temperature === "object" && properties.temperature !== null &&
              "value" in properties.temperature && typeof properties.temperature.value === "number") {
            return { ok: true, description: properties.textDescription, temperature: properties.temperature.value };
          }
          else if ("rawMessage" in properties && typeof properties.rawMessage === "string") {
            const metarTemperature = parseMetarTemperature(properties.rawMessage);
            if (metarTemperature !== undefined)
            {
              return { ok: true, description: properties.textDescription, temperature: metarTemperature };
            }
          }
        }
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  return { ok: false, description: "", temperature: 0 };
}

async function getWeatherForecast(wfo: string, x: number, y: number, apiKey: string): Promise<WeatherForecast> {
  const response = await fetch(`https://api.weather.gov/gridpoints/${wfo}/${x},${y}`, {
    headers: {
      "user-agent": apiKey
    }
  });
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/geo+json")) {
    try {
      const payload = await response.json();
      if (typeof payload === "object" && payload !== null && "properties" in payload)
      {
        const properties = payload.properties;
        if (typeof properties === "object" && properties !== null && "minTemperature" in properties && "maxTemperature" in properties)
        {
          const { maxTemperature, minTemperature } = properties;

          const findBestValue = (values: unknown[]) =>
          {
            const now = Temporal.Now.instant();
            for (const entry of values) {
              if (typeof entry === "object" && entry !== null && "validTime" in entry && "value" in entry)
              {
                const { validTime, value } = entry;
                if (typeof validTime === "string" && typeof value === "number") {
                  const [timeString, durationString] = validTime.split("/");
                  const time = Temporal.Instant.from(timeString);
                  const duration = Temporal.Duration.from(durationString);
                  const endTime = time.add(duration);
                  if (Temporal.Instant.compare(now, endTime) <= 0) {
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

          if (low !== undefined && high !== undefined) {            
            let chancePrecipitation: undefined | number = undefined;
            if ("probabilityOfPrecipitation" in properties && typeof properties.probabilityOfPrecipitation === "object" && properties.probabilityOfPrecipitation !== null &&
                "values" in properties.probabilityOfPrecipitation && Array.isArray(properties.probabilityOfPrecipitation.values)) {
              chancePrecipitation = findBestValue(properties.probabilityOfPrecipitation.values);
            }

            return { ok: true, highTemperature: high, lowTemperature: low, chancePrecipitation: chancePrecipitation ?? 0.0 };
          }
        }
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  return { ok: false, highTemperature: 0, lowTemperature: 0, chancePrecipitation: 0.0 };
}

async function getUvForecastDay(zip: string): Promise<UvForecastDay> {
  const response = await fetch(`https://data.epa.gov/efservice/getEnvirofactsUVHOURLY/ZIP/${zip}/JSON`);
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      if (Array.isArray(payload))
      {
        const forecastDay: UvForecastDay = { ok: true, forecasts: [] };
        for (const element of payload as unknown[])
        {
          if (typeof element === "object" && element !== null &&
              "DATE_TIME" in element && typeof element["DATE_TIME"] === "string" &&
              "UV_VALUE" in element && typeof element["UV_VALUE"] === "number")
          {
            const parseTime = (d: string) => {
              const components = d.split(" "); // Apr/26/2025 06 AM
              if (components.length === 3)
              {
                const dateComponents = components[0].split("/"); // Apr/26/2025
                if (dateComponents.length === 3)
                {
                  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                  const month = months.indexOf(dateComponents[0].toUpperCase()) + 1;
                  const day = parseInt(dateComponents[1]);
                  const year = parseInt(dateComponents[2]);
                  if (month >= 1 && month <= 12)
                  {
                    const hour12 = parseInt(components[1]);
                    const pm = (components[2].toUpperCase() == "PM");
                    const hour24 = pm ? hour12 + 12 : hour12;

                    return Temporal.PlainDateTime.from({ year, month, day, hour: hour24 });
                  }
                }
              }

              return undefined;
            };

            const time = parseTime(element.DATE_TIME);
            if (time !== undefined)
            {
              forecastDay.forecasts.push({ uvIndex: element.UV_VALUE, time: time.toString() });
            }
          }
        }

        return forecastDay;
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  return { ok: false, forecasts: [] };
}

interface Env {
  WEATHER_API_KEY: string;
}

export default {
  async fetch(request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/bustimes")) {
      const stops = url.searchParams.get("stops");
      if (stops !== null) {
        const stopArray = stops.split(",");
        return Response.json(await getBusTimes(stopArray));
      }
      return new Response(null, { status: 400 });
    }
    else if (url.pathname.startsWith("/routenames")) {
      return Response.json(await getRouteNames());
    }
    else if (url.pathname.startsWith("/weather")) {
      const station = url.searchParams.get("station");
      if (station !== null) {
        return Response.json(await getWeatherCurrent(station, env.WEATHER_API_KEY));
      }
      return new Response(null, { status: 400 });
    }
    else if (url.pathname.startsWith("/forecast")) {
      const wfo = url.searchParams.get("wfo");
      const x = url.searchParams.get("x");
      const y = url.searchParams.get("y");
      if (wfo !== null && x !== null && y !== null) {
        return Response.json(await getWeatherForecast(wfo, parseInt(x), parseInt(y), env.WEATHER_API_KEY));
      }
      return new Response(null, { status: 400 });
    }
    else if (url.pathname.startsWith("/uv")) {
      const zipcode = url.searchParams.get("zip");
      if (zipcode !== null) {
        return Response.json(await getUvForecastDay(zipcode));
      }
      return new Response(null, { status: 400 });
    }
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
