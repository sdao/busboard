import JSZip from "jszip";
import { Temporal, Intl, toTemporalInstant } from '@js-temporal/polyfill';

async function getBusTimes(stops: string[])
{
  const response = await fetch("https://data.texas.gov/download/mqtr-wwpy/text%2Fplain");
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/octet-stream"))
  {
    try
    {
      const jsonString = new TextDecoder("utf-8").decode(await response.arrayBuffer());
      const payload = JSON.parse(jsonString);

      const arrivals: Map<string, Map<string, Map<number, { hasLeftTerminus: boolean, time: number }[]>>> = new Map();
      for (const stopId of stops)
      {
        arrivals.set(stopId, new Map());
      }

      function getTimesArray(stopId: string, routeId: string, directionId: number): { hasLeftTerminus: boolean, time: number }[] | undefined
      {
        const arrivalsStop = arrivals.get(stopId);
        if (arrivalsStop === undefined)
        {
          return undefined;
        }

        var arrivalsRoute = arrivalsStop.get(routeId);
        if (arrivalsRoute === undefined)
        {
          arrivalsRoute = new Map();
          arrivalsStop.set(routeId, arrivalsRoute);
        }

        var arrivalsDirection = arrivalsRoute.get(directionId);
        if (arrivalsDirection === undefined)
        {
          arrivalsDirection = [];
          arrivalsRoute.set(directionId, arrivalsDirection);
        }

        return arrivalsDirection;
      }

      for (const entity of payload.entity)
      {
        const { trip, stopTimeUpdate } = entity.tripUpdate;
        if (trip !== undefined && stopTimeUpdate !== undefined)
        {
          const { routeId, directionId } = trip;

          var anyStopSequences = false;
          var hasTerminusStopSequence = false;
          for (const update of stopTimeUpdate)
          {
            const { stopSequence } = update;
            if (stopSequence !== undefined)
            {
              anyStopSequences = true;
              if (stopSequence === 1)
              {
                hasTerminusStopSequence = true;
              }
            }

            if (anyStopSequences && hasTerminusStopSequence)
            {
              break;
            }
          }

          for (const update of stopTimeUpdate)
          {
            const { arrival, stopId, scheduleRelationship } = update;
            if (scheduleRelationship === "SCHEDULED")
            {
              const timesArray = getTimesArray(stopId, routeId, directionId);
              if (timesArray !== undefined)
              {
                const time = parseInt(arrival.time);
                timesArray.push({ hasLeftTerminus: !anyStopSequences || !hasTerminusStopSequence, time });
              }
            }
          }
        }
      }

      const niceStops = Array.from(arrivals, ([stopId, routes]) => {
        const niceRoutes = Array.from(routes, ([routeId, directions]) => {
          const niceDirections = Array.from(directions, ([directionId, times]) => {
            const nextTimes = times.sort((a, b) => a.time - b.time).slice(0, 5);
            return { directionId, nextTimes };
          });
          return { routeId, directions: niceDirections };
        });
        return { stopId, routes: niceRoutes };
      });

      return { ok: true, stops: niceStops };
    }
    catch (e)
    {
    }  
  }

  return { ok: false, stops: null };
}

async function getRouteNames()
{
  const response = await fetch("https://data.texas.gov/download/r4v4-vz24/application%2Fzip");
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/octet-stream"))
  {
    try
    {
      const zip = new JSZip();
      const zipData = await response.arrayBuffer();
      const zipPayload = await zip.loadAsync(zipData);
      const tripsFile = zipPayload.file("trips.txt");
      if (tripsFile !== null)
      {
        const tripsCsv = await tripsFile.async("string");
        const tripsCsvLines = tripsCsv.split("\n");

        if (tripsCsvLines.length > 1)
        {
          const headerFields = tripsCsvLines[0].trim().split(",");
          const routeIdIndex = headerFields.indexOf("route_id");
          const directionIdIndex = headerFields.indexOf("direction_id");
          const tripShortNameIndex = headerFields.indexOf("trip_short_name");

          const routeNames: Map<string, Map<number, string>> = new Map();
          for (const line of tripsCsvLines.slice(1))
          {
            const fields = line.trim().split(",");
            const routeId = fields[routeIdIndex];
            const directionId = parseInt(fields[directionIdIndex]);
            const tripShortName = fields[tripShortNameIndex];
            
            var directions = routeNames.get(routeId);
            if (directions === undefined)
            {
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
    catch (e)
    {
    }
  }

  return { ok: false, routes: null };
}

async function getWeather(station: string, apiKey: string) {
  const response = await fetch(`https://api.weather.gov/stations/${station}/observations/latest`, {
    headers: {
      "user-agent": apiKey
    }
  });
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/geo+json"))
  {
    try
    {
      const payload = await response.json() as any;
      const { properties } = payload;
      if (properties !== undefined)
      {
        const { textDescription, temperature } = properties;
        if (textDescription !== undefined && temperature !== undefined)
        {
          const { value } = temperature;
          if (value !== undefined)
          {
            return { ok: true, weather: {description: textDescription, temperature: value } };
          }
        }
      }
    }
    catch (e)
    {
    }
  }

  return { ok: false, weather: null };
}

async function getLoHi(wfo: string, x: number, y: number, apiKey: string)
{
  const response = await fetch(`https://api.weather.gov/gridpoints/${wfo}/${x},${y}`, {
    headers: {
      "user-agent": apiKey
    }
  });
  const { headers } = response;
  const contentType = headers.get("content-type") || "";
  if (contentType.includes("application/geo+json"))
  {
    try
    {
      const payload = await response.json() as any;
      const { properties } = payload;
      if (properties !== undefined)
      {
        const { maxTemperature, minTemperature } = properties;
        if (maxTemperature !== undefined && minTemperature !== undefined)
        {
          var low: null | number = null;
          var high: null | number = null;

          {
            const { values } = maxTemperature;
            if (values !== undefined)
            {
              const now = Temporal.Now.instant();
              for (const entry of values)
              {
                const { validTime, value } = entry;
                if (validTime !== undefined && value !== undefined)
                {
                  const [timeString, durationString] = (validTime as string).split("/");
                  const time = Temporal.Instant.from(timeString);
                  const duration = Temporal.Duration.from(durationString);
                  const endTime = time.add(duration);
                  if (Temporal.Instant.compare(now, endTime) <= 0)
                  {
                    high = value;
                    break;
                  }
                }
              }
            }
          }

          {
            const { values } = minTemperature;
            if (values !== undefined)
            {
              const now = Temporal.Now.instant();
              for (const entry of values)
              {
                const { validTime, value } = entry;
                if (validTime !== undefined && value !== undefined)
                {
                  const [timeString, durationString] = (validTime as string).split("/");
                  const time = Temporal.Instant.from(timeString);
                  const duration = Temporal.Duration.from(durationString);
                  const endTime = time.add(duration);
                  if (Temporal.Instant.compare(now, endTime) <= 0)
                  {
                    low = value;
                    break;
                  }
                }
              }
            }
          }

          return { ok: true, low, high };
        }
      }
    }
    catch (e)
    {
    }
  }

  return { ok: false, low: null, high: null };
}

interface Env {
  WEATHER_API_KEY: string;
}

export default {
  async fetch(request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/bustimes")) {
      const stops = url.searchParams.get("stops");
      if (stops !== null)
      {
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
      if (station !== null)
      {
        return Response.json(await getWeather(station, env.WEATHER_API_KEY));
      }
      return new Response(null, { status: 400 });
    }
    else if (url.pathname.startsWith("/lohi")) {
      const wfo = url.searchParams.get("wfo");
      const x = url.searchParams.get("x");
      const y = url.searchParams.get("y");
      if (wfo !== null && x !== null && y !== null)
      {
        return Response.json(await getLoHi(wfo, parseInt(x), parseInt(y), env.WEATHER_API_KEY));
      }
      return new Response(null, { status: 400 });
    }
		return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
