import JSZip from "jszip";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { Temporal } from "@js-temporal/polyfill";
import { DirectionId, RouteId, StopId, BusTimes, TransitSystemInfo, WeatherConditions, WeatherForecast, UvForecastDay, ReverseGeocode, BusInstance, StopInstance, RouteInstance, DirectionInstance } from "../shared/types";

async function getReverseGeocode(lat: number, lon: number, userAgent: string, weatherApiKey: string): Promise<ReverseGeocode> {
  const result: ReverseGeocode = { ok: false, lat, lon, zip: null, weatherTile: null, weatherStation: null };

  {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: {
        "user-agent": userAgent
      }
    });
    const { ok, headers } = response;
    const contentType = headers.get("content-type") || "";
    if (!ok) {
      console.log(`<${response.url}> responded with: ${response.status}`);
    }
    else if (contentType.includes("application/json")) {
      try {
        const payload = await response.json();
        if (typeof payload === "object" && payload !== null &&
          "address" in payload && typeof payload.address === "object" && payload.address !== null &&
          "postcode" in payload.address && typeof payload.address.postcode === "string") {
          result.zip = payload.address.postcode;
        }
      }
      catch (e) {
        console.error(e);
      }
    }
  }

  let observationStationsUri = null;
  {
    const response = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: {
        "user-agent": weatherApiKey
      }
    });
    const { ok, headers } = response;
    const contentType = headers.get("content-type") || "";
    if (!ok) {
      console.log(`<${response.url}> responded with: ${response.status}`);
    }
    else if (contentType.includes("application/geo+json")) {
      try {
        const payload = await response.json();
        if (typeof payload === "object" && payload !== null &&
          "properties" in payload && typeof payload.properties === "object" && payload.properties !== null &&
          "gridId" in payload.properties && typeof payload.properties.gridId === "string" &&
          "gridX" in payload.properties && typeof payload.properties.gridX === "number" &&
          "gridY" in payload.properties && typeof payload.properties.gridY === "number") {
          result.weatherTile = { wfo: payload.properties.gridId, x: payload.properties.gridX, y: payload.properties.gridY };

          if ("observationStations" in payload.properties && typeof payload.properties.observationStations === "string") {
            observationStationsUri = payload.properties.observationStations;
          }
        }
      }
      catch (e) {
        console.error(e);
      }
    }
  }

  console.log(`Fetching observation stations from <${observationStationsUri}>...`);
  if (observationStationsUri) {
    const response = await fetch(observationStationsUri, {
      headers: {
        "user-agent": weatherApiKey
      }
    });
    const { ok, headers } = response;
    const contentType = headers.get("content-type") || "";
    if (!ok) {
      console.log(`<${response.url}> responded with: ${response.status}`);
    }
    else if (contentType.includes("application/geo+json")) {
      try {
        const payload = await response.json();
        if (typeof payload === "object" && payload !== null &&
          "features" in payload && Array.isArray(payload.features) && payload.features.length != 0) {
          const firstFeature = payload.features[0] as unknown;
          if (typeof firstFeature === "object" && firstFeature !== null &&
            "properties" in firstFeature && typeof firstFeature.properties === "object" && firstFeature.properties !== null &&
            "stationIdentifier" in firstFeature.properties && typeof firstFeature.properties.stationIdentifier === "string") {
            result.weatherStation = firstFeature.properties.stationIdentifier;
          }
        }
      }
      catch (e) {
        console.error(e);
      }
    }
  }

  result.ok = !!(result.zip && result.weatherTile && result.weatherStation);
  return result;
}

async function getBusTimes(stops: string[]): Promise<BusTimes> {
  const response = await fetch("https://data.texas.gov/download/rmk2-acnw/application%2Foctet-stream");
  const { ok, headers } = response;
  const contentType = headers.get("content-type") || "";
  if (!ok) {
    console.log(`<${response.url}> responded with: ${response.status}`);
  }
  else if (contentType.includes("application/octet-stream")) {
    try {
      const buffer = await response.arrayBuffer();
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

      {
        const arrivals: Map<StopId, Map<RouteId, Map<DirectionId, { hasLeftTerminus: boolean, seconds: number }[]>>> = new Map();
        for (const stopId of stops) {
          arrivals.set(stopId, new Map());
        }

        function getBusInstancesArray(stopId: StopId, routeId: RouteId, directionId: DirectionId): { hasLeftTerminus: boolean, seconds: number }[] | undefined {
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

        for (const entity of feed.entity) {
          if (entity.tripUpdate !== null && entity.tripUpdate !== undefined) {
            const { trip, stopTimeUpdate } = entity.tripUpdate;
            if (stopTimeUpdate !== null && stopTimeUpdate !== undefined) {
              const { routeId, directionId } = trip;
              if (routeId !== null && routeId !== undefined && directionId !== null && directionId !== undefined) {
                let anyStopSequences = false;
                let hasTerminusStopSequence = false;
                for (const update of stopTimeUpdate) {
                  if (update.stopSequence !== null && update.stopSequence !== undefined) {
                    anyStopSequences = true;
                    if (update.stopSequence === 1) {
                      hasTerminusStopSequence = true;
                    }
                  }

                  if (anyStopSequences && hasTerminusStopSequence) {
                    break;
                  }
                }

                for (const update of stopTimeUpdate) {
                  if (update.arrival !== null && update.arrival !== undefined && update.stopId !== null && update.stopId !== undefined && update.scheduleRelationship !== null && update.scheduleRelationship !== undefined) {
                    const { arrival, stopId, scheduleRelationship } = update;
                    if (typeof arrival.time === "number" &&
                      scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED) {
                      const instances = getBusInstancesArray(stopId, routeId, directionId);
                      if (instances !== undefined) {
                        instances.push({ hasLeftTerminus: !anyStopSequences || !hasTerminusStopSequence, seconds: arrival.time });
                      }
                    }
                  }
                }
              }
            }
          }
        }

        const busTimes: BusTimes = { ok: true, stops: [] };
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
    }
    catch (e) {
      console.error(e);
    }
  }

  return { ok: false, stops: [] };
}

async function getTransitInfo(lat: number, lon: number): Promise<TransitSystemInfo> {
  const result: TransitSystemInfo = { ok: false, routes: [], closestStops: [] };

  const response = await fetch("https://data.texas.gov/download/r4v4-vz24/application%2Fzip");
  const { ok, headers } = response;
  const contentType = headers.get("content-type") || "";
  if (!ok) {
    console.log(`<${response.url}> responded with: ${response.status}`);
  }
  else if (contentType.includes("application/octet-stream")) {
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

          for (const [routeId, directions] of routeNames) {
            const niceRoute: { routeId: RouteId, directions: { directionId: DirectionId, name: string }[] } = { routeId, directions: [] };
            result.routes.push(niceRoute);

            for (const [directionId, name] of directions) {
              const niceDirection = { directionId, name };
              niceRoute.directions.push(niceDirection);
            }
          }
        }
      }

      const stopsFiles = zipPayload.file("stops.txt");
      if (stopsFiles !== null) {
        const stopsCsv = await stopsFiles.async("string");
        const stopsCsvLines = stopsCsv.split("\n");

        if (stopsCsvLines.length > 1) {
          const headerFields = stopsCsvLines[0].trim().split(",");
          const stopIdIndex = headerFields.indexOf("stop_id");
          const stopLatIndex = headerFields.indexOf("stop_lat");
          const stopLonIndex = headerFields.indexOf("stop_lon");

          const maxClosestStops = 2;
          const closestStops: { stopId: StopId, angle: number }[] = [];
          for (const line of stopsCsvLines.slice(1)) {
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
              const dlat = Math.abs(lat1 - lat2);
              const dlon = Math.abs(lon1 - lon2);
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

          result.closestStops = closestStops.map(elem => elem.stopId);
        }

        result.ok = !!(result.routes && result.closestStops);
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  return result;
}

async function getWeatherCurrent(station: string, apiKey: string): Promise<WeatherConditions> {
  const response = await fetch(`https://api.weather.gov/stations/${station}/observations/latest`, {
    headers: {
      "user-agent": apiKey
    }
  });
  const { ok, headers } = response;
  const contentType = headers.get("content-type") || "";
  if (!ok) {
    console.log(`<${response.url}> responded with: ${response.status}`);
  }
  else if (contentType.includes("application/geo+json")) {
    try {
      const payload = await response.json();
      if (typeof payload === "object" && payload !== null && "properties" in payload) {
        const properties = payload.properties;
        if (typeof properties === "object" && properties !== null &&
          "textDescription" in properties && typeof properties.textDescription === "string") {
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
            return { ok: true, description: properties.textDescription, temperature: properties.temperature.value };
          }
          else if ("rawMessage" in properties && typeof properties.rawMessage === "string") {
            const metarTemperature = parseMetarTemperature(properties.rawMessage);
            if (metarTemperature !== undefined) {
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
  const { ok, headers } = response;
  const contentType = headers.get("content-type") || "";
  if (!ok) {
    console.log(`<${response.url}> responded with: ${response.status}`);
  }
  else if (contentType.includes("application/geo+json")) {
    try {
      const payload = await response.json();
      if (typeof payload === "object" && payload !== null && "properties" in payload) {
        const properties = payload.properties;
        if (typeof properties === "object" && properties !== null && "minTemperature" in properties && "maxTemperature" in properties) {
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
  const { ok, headers } = response;
  const contentType = headers.get("content-type") || "";
  if (!ok) {
    console.log(`<${response.url}> responded with: ${response.status}`);
  }
  else if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      if (Array.isArray(payload)) {
        const forecastDay: UvForecastDay = { ok: true, forecasts: [] };
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
  OSM_NOMINATIM_USER_AGENT: string;
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
    else if (url.pathname.startsWith("/transitinfo")) {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (lat !== null && lon !== null) {
        return Response.json(await getTransitInfo(parseFloat(lat), parseFloat(lon)));
      }
      return new Response(null, { status: 400 });
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
    else if (url.pathname.startsWith("/geo")) {
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      if (lat !== null && lon !== null) {
        return Response.json(await getReverseGeocode(parseFloat(lat), parseFloat(lon), env.OSM_NOMINATIM_USER_AGENT, env.WEATHER_API_KEY));
      }
      return new Response(null, { status: 400 });
    }
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
