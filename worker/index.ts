import JSZip from "jszip";

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

      const arrivals: Map<string, Map<string, Map<number, number[]>>> = new Map();
      for (const stopId of stops)
      {
        arrivals.set(stopId, new Map());
      }

      function getTimesArray(stopId: string, routeId: string, directionId: number): number[] | undefined
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
          for (const update of stopTimeUpdate)
          {
            const { arrival, stopId, scheduleRelationship } = update;
            if (scheduleRelationship === "SCHEDULED")
            {
              const timesArray = getTimesArray(stopId, routeId, directionId);
              if (timesArray !== undefined)
              {
                const time = parseInt(arrival.time);
                timesArray.push(time);
              }
            }
          }
        }
      }

      const niceStops = Array.from(arrivals, ([stopId, routes]) => {
        const niceRoutes = Array.from(routes, ([routeId, directions]) => {
          const niceDirections = Array.from(directions, ([directionId, times]) => {
            const nextTimes = times.sort((a, b) => a - b).slice(0, 5);
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

export default {
  async fetch(request, env) {
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
		return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
