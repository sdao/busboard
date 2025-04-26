import { useState, useEffect, useRef } from 'react'
import OLMap from 'ol/Map';
import OLView from 'ol/View';
import { fromLonLat } from 'ol/proj';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import { MapboxVectorLayer } from 'ol-mapbox-style';
import SunCalc from 'suncalc';
import { BusTimes, DirectionId, RouteId, RouteNames, StopInstance, UvForecastDay, WeatherConditions, WeatherForecast } from "../shared/types";
import { Temporal } from '@js-temporal/polyfill';
import 'core-js/actual/url';
import 'core-js/actual/url-search-params';
import 'whatwg-fetch'
import './App.css'

function WeatherDisplay({ current, forecast, uvForecast, lat, lon }: { current: WeatherConditions, forecast: WeatherForecast, uvForecast: UvForecastDay, lat: number, lon: number }) {
  const now = Temporal.Now.zonedDateTimeISO();

  function toFahrenheit(c: number | null) {
    if (c === null) {
      return c;
    }
    return Math.round(c * (9.0 / 5.0) + 32.0);
  }

  function getEmoji(text: string) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes("snow") || lowerText.includes("blizzard"))
    {
      return '❄️';
    }
    else if (lowerText.includes("thunderstorm"))
    {
      return '⚡';
    }
    else if (lowerText.includes("tropical storm") || lowerText.includes("hurricane"))
    {
      return '🌀';
    }
    else if (lowerText.includes("rain") || lowerText.includes("drizzle") || lowerText.includes("ice") || lowerText.includes("showers"))
    {
      return '☔';
    }
    else if (lowerText.includes("tornado") || lowerText.includes("dust") || lowerText.includes("sand"))
    {
      return '🌪️';
    }
    else if (lowerText.includes("mostly cloudy"))
    {
      return '🌥️';
    }
    else if (lowerText.includes("partly cloudy"))
    {
      return '⛅';
    }
    else if (lowerText.includes("cloud"))
    {
      return '🌤️';
    }
    else if (lowerText.includes("windy") || lowerText.includes("breezy"))
    {
      return '🍃';
    }
    else if (lowerText.includes("overcast") || lowerText.includes("haze") || lowerText.includes("smoke") || lowerText.includes("fog") || lowerText.includes("mist"))
    {
      return '🌫️';
    }
    else
    {
      const nowDate = new Date(now.epochMilliseconds);
      const times = SunCalc.getTimes(nowDate, lat, lon);
      if (nowDate > times.sunrise && nowDate < times.sunset)
      {
        return '🌞';
      }
      else
      {
        return '🌛';
      }
    }
  }

  function getShortDesc(text: string) {
    if (text.includes(" and ")) {
      return text.split(" and ")[0];
    }
    return text;
  }

  function getUvDesc()
  {
    const maxUvValue = Math.max(...uvForecast.forecasts.map(f => f.uvIndex));

    // Only show UV if it's high today
    if (maxUvValue >= 3)
    {
      const plainNow = now.toPlainDateTime();
      const currentHourUv = uvForecast.forecasts.find(f => Temporal.PlainDateTime.compare(plainNow, Temporal.PlainDateTime.from(f.time)) <= 0);
      if (currentHourUv)
      {
        return `UV ${currentHourUv.uvIndex} / High ${maxUvValue}`;
      }
      else
      {
        return `UV High ${maxUvValue}`;
      }
    }

    return null;
  }

  if (!current.ok && !forecast.ok && !uvForecast.ok) {
    return (
      <>
      </>
    )
  }
  else {
    const hasCurrentDesc = current.ok && !!current.description;

    const uvMessage = getUvDesc();

    const scrollItems = (hasCurrentDesc ? 1 : 0) + (forecast.ok ? 1 : 0) + (uvMessage ? 1 : 0);
    let scrollClass = "weather-description";
    if (scrollItems == 2)
    {
      scrollClass = "weather-description weather-description-scroll-2";
    }
    else if (scrollItems == 3)
    {
      scrollClass = "weather-description weather-description-scroll-3";
    }

    return (
      <>
        {!hasCurrentDesc ? <></> : <div className="weather-emoji">{getEmoji(current.description)}</div>}
        <div className={scrollClass}>
          {!hasCurrentDesc ? <></> : <div>{getShortDesc(current.description)}</div>}
          {!forecast.ok ? <></> : <div><span className='temperature-high'>{toFahrenheit(forecast.highTemperature)}&deg;</span> / <span className='temperature-low'>{toFahrenheit(forecast.lowTemperature)}&deg;</span></div>}
          {!uvMessage ? <></> : <div>{uvMessage}</div> }
        </div>
        {!current.ok ? <div></div> : <div>{toFahrenheit(current.temperature)}&deg;F</div>}
      </>
    )
  }
}

function MinutesDisplay({ hasLeftTerminus, minutes }: { hasLeftTerminus: boolean, minutes: number }) {
  const classes = ["minutes-until"];
  if (hasLeftTerminus) {
    classes.push("has-left-terminus");
  }
  else {
    classes.push("has-not-left-terminus");
  }

  if (minutes <= 3) {
    classes.push("imminent");
  }
  else if (minutes <= 5) {
    classes.push("very-soon");
  }
  else if (minutes <= 7) {
    classes.push("soon");
  }

  return <span className={classes.join(" ")}>{minutes}</span>
}

function BusTimeDisplay({ routeId, directionId, nextInstances, routeNames }: { routeId: RouteId, directionId: DirectionId, nextInstances: StopInstance[], routeNames: RouteNames }) {
  const [, setCount] = useState(0);

  // Force a re-render every 5 seconds to keep the remaining time up-to-date
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCount((val) => val + 1);
    }, 5 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  function abbreviate(n: string)
  {
    // If `n` is all upper-case, convert it to title case
    if (n.toUpperCase() === n)
    {
      const wordRegex = /\b\w+\b/g;
      const matches = n.matchAll(wordRegex);

      let titleCase = "";
      for (const match of matches) {
        const start = match.index;
        const end = start + match[0].length;

        for (let i = titleCase.length; i < start; ++i)
        {
          titleCase += n[i];
        }

        titleCase += n[start].toUpperCase();
        for (let i = start + 1; i < end; ++i)
        {
          titleCase += n[i].toLowerCase();
        }
      }
      
      for (let i = titleCase.length; i < n.length; ++i)
      {
        titleCase += n[i];
      }

      n = titleCase;
    }

    // Abbreviate some common words
    return n.replace(/\bAvenue\b/ig, "Av")
            .replace(/\bBoulevard\b/ig, "Blvd")
            .replace(/\bCenter\b/ig, "Ctr")
            .replace(/\bPark.+Ride\b/ig, "P+R")
            .replace(/\bParkway\b/ig, "Pkwy")
            .replace(/\bPlace\b/ig, "Pl")
            .replace(/\bPlaza\b/ig, "Plz")
            .replace(/\bRoad\b/ig, "Rd")
            .replace(/\bSquare\b/ig, "Sq")
            .replace(/\bStation\b/ig, "Sta")
            .replace(/\bStreet\b/ig, "St")
            .replace(/\bUniversity\b/ig, "Univ")
            ;
  }

  let name = `Route ${routeId}`;
  const route = routeNames.routes.find((route) => route.routeId == routeId);
  if (route !== undefined) {
    const dir = route.directions.find((dir) => dir.directionId == directionId);
    if (dir !== undefined) {
      name = abbreviate(dir.name);
    }
  }

  const routeClassName = String(routeId).length > 2 ? "route route3" : "route";

  const now = Temporal.Now.instant();
  const instances = nextInstances
    .map((instance) => ({ hasLeftTerminus: instance.hasLeftTerminus, instant: Temporal.Instant.from(instance.time) }))
    .filter((instance) => Temporal.Instant.compare(instance.instant, now) >= 0)
    .sort((a, b) => Temporal.Instant.compare(a.instant, b.instant))
    .slice(0, 2);

  const countdownDisplays = [];
  for (let i = 0; i < instances.length; ++i) {
    if (i !== 0) {
      countdownDisplays.push(<span key={i * 2}>,&nbsp;</span>);
    }
    const minutesUntil = Math.floor(now.until(instances[i].instant).total("minutes"));
    countdownDisplays.push(<MinutesDisplay key={i * 2 + 1} hasLeftTerminus={instances[i].hasLeftTerminus} minutes={minutesUntil} />);
  }

  return (
    <article>
      <div><h1 className={routeClassName}><span>{routeId}</span></h1></div>
      <div className="headsign">{name}</div>
      <div>{countdownDisplays.length == 0 ? <span>&mdash;</span> : countdownDisplays}<div className="subtitle">minutes</div></div>
    </article>
  )
}

import versatiles from './assets/versatiles-eclipse.json?url'

function RadarMapComponent({ lat, lon } : { lat: number, lon: number }) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const olMapRef = useRef<OLMap>(null);

  // Insert map
  useEffect(() => {
    const node = mapDivRef.current;
    if (node) {
      const map = new OLMap({
        target: node,
        layers: [
          new MapboxVectorLayer({
            styleUrl: versatiles
          }),
          new ImageLayer({
            source: new ImageWMS({
              url: 'https://nowcoast.noaa.gov/geoserver/ows?service=wms',
              params: { 'LAYERS': 'weather_radar:conus_base_reflectivity_mosaic' },
              ratio: 1,
              serverType: 'geoserver',
            }),
          }),
        ],
        view: new OLView({
          center: fromLonLat([lon, lat]),
          zoom: 10
        }),
        controls: []
      });

      map.updateSize();

      olMapRef.current = map;
      return () => map.setTarget(undefined);
    }
    return () => { };
  }, [lat, lon]);

  // Process map div resize
  useEffect(() => {
    const node = mapDivRef.current;
    if (node) {
      const observer = new ResizeObserver(() => {
        const currentMap = olMapRef.current;
        if (currentMap) {
          currentMap.updateSize();
        }
      });

      observer.observe(node);
      return () => observer.unobserve(node);
    }

    return () => { };
  }, []);

  // Periodically refresh map
  useEffect(() => {
    const intervalId = window.setInterval(() => {      
      const currentMap = olMapRef.current;
      if (currentMap)
      {
        currentMap.getAllLayers().forEach((layer) => {
          layer.getSource()?.refresh();
        });
      }
    }, 10 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return <div ref={mapDivRef} style={{ width: '100%', minHeight: '400px' }}></div>;
};

function App() {
  const [weather, setWeather] = useState<WeatherConditions>({ ok: false, description: "", temperature: 0 });
  const [forecast, setForecast] = useState<WeatherForecast>({ ok: false, highTemperature: 0, lowTemperature: 0, chancePrecipitation: 0 });
  const [uvForecast, setUvForecast] = useState<UvForecastDay>({ ok: false, forecasts: [] });
  const [routeNames, setRouteNames] = useState<RouteNames>({ ok: false, routes: [] });
  const [busTimes, setBusTimes] = useState<BusTimes>({ ok: false, stops: [] });
  const [isFullscreen, setFullscreen] = useState(false);
  const [showMouseCursor, setShowMouseCursor] = useState(true);
  const lastMouseMove = useRef(Temporal.Now.instant());

  useEffect(() => {
    let timeoutId = 0;
    const fetchRouteNames = async () => {
      console.log("Fetching route names...");

      try {
        const response = await fetch('/routenames');
        if (!response.ok) {
          throw new Error(`<${response.url}> responded with: ${response.status}`);
        }
        
        const data = await response.json() as RouteNames;
        if (data.ok) {
          setRouteNames(data);
          return true;
        }
      }
      catch (e) {
        console.error(e);
      }

      timeoutId = window.setTimeout(() => fetchRouteNames(), 30 * 1000);
      return false;
    };

    fetchRouteNames();
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let timeoutId = 0;
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const stopIds = searchParams.get("stopids");

    if (stopIds !== null) {
      const fetchBusTimes = async () => {
        console.log("Fetching bus times...");

        let nextTimeout = 60 * 1000;
        try {
          const response = await fetch(`/bustimes?stops=${stopIds}`);
          if (!response.ok) {
            throw new Error(`<${response.url}> responded with: ${response.status}`);
          }
          
          const data = await response.json() as BusTimes;
          if (data.ok) {
            setBusTimes(data);

            // If there are no more scheduled buses for the night, throttle updates to every ten minutes
            const anyBusesScheduled = () => {
              for (const stop of data.stops) {
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

            if (!anyBusesScheduled()) {
              nextTimeout = 10 * 60 * 1000;
            }
          }
        }
        catch (e) {
          console.error(e);
        }

        timeoutId = window.setTimeout(() => fetchBusTimes(), nextTimeout);
      };

      fetchBusTimes();
    }

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let timeoutId = 0;
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const wstation = searchParams.get("wstation");
    const wfo = searchParams.get("wfo");
    const x = searchParams.get("x");
    const y = searchParams.get("y");

    const loadCurrent = (wstation != null);
    const loadForecast = (wfo !== null && x !== null && y !== null);

    if (loadCurrent || loadForecast) {
      const fetchWeather = async () => {
        console.log("Fetching weather...");

        if (loadCurrent) {
          try {
            const response = await fetch(`/weather?station=${wstation}`);
            if (!response.ok) {
              throw new Error(`<${response.url}> responded with: ${response.status}`);
            }

            const data = await response.json() as WeatherConditions;
            if (data.ok) {
              setWeather(data);
              console.log("weather current: %s", JSON.stringify(data));
            }
          }
          catch (e) {
            console.error(e);
          }
        }

        if (loadForecast) {
          try {
            const response = await fetch(`/forecast?wfo=${wfo}&x=${x}&y=${y}`);
            if (!response.ok) {
              throw new Error(`<${response.url}> responded with: ${response.status}`);
            }

            const data = await response.json() as WeatherForecast;
            if (data.ok) {
              setForecast(data);
              console.log("weather forecast: %s", JSON.stringify(data));
            }
          }
          catch (e) {
            console.error(e);
          }
        }

        timeoutId = window.setTimeout(() => fetchWeather(), 15 * 60 * 1000);
      };

      fetchWeather();
    }

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    let timeoutId = 0;
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const zipcode = searchParams.get("zip");
    if (zipcode != null) {
      const fetchUv = async () => {
        console.log("Fetching UV...");

        try {
          const response = await fetch(`/uv?zip=${zipcode}`);
          if (!response.ok) {
            throw new Error(`<${response.url}> responded with: ${response.status}`);
          }

          const data = await response.json() as UvForecastDay;
          if (data.ok) {
            setUvForecast(data);
            console.log("UV forecast: %s", JSON.stringify(data));
          }
        }
        catch (e) {
          console.error(e);
        }

        timeoutId = window.setTimeout(() => fetchUv(), 60 * 60 * 1000);
      };

      fetchUv();
    }

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (showMouseCursor) {
        const now = Temporal.Now.instant();
        if (now.since(lastMouseMove.current).total("seconds") > 10) {
          setShowMouseCursor(false);
        }
      }
    }, 10 * 1000);

    return () => window.clearInterval(intervalId);
  }, [showMouseCursor]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        setFullscreen(true);
      }
      else {
        setFullscreen(false);
      }
    };
          
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (isFullscreen)
    {
      let wakeLockPromise = null;
      try {
        wakeLockPromise = navigator.wakeLock.request("screen");
      } catch (e) {
        console.error(e);
      }

      if (wakeLockPromise !== null)
      {
        return () => wakeLockPromise.then(wakeLock => wakeLock.release(), reason => console.error(reason));
      }
    }

    return () => {};
  }, [isFullscreen]);

  const rows = [];
  if (busTimes.ok && routeNames !== null) {
    for (const stop of busTimes.stops) {
      for (const route of stop.routes) {
        for (const dir of route.directions) {
          const key = `${stop.stopId}_${route.routeId}_${dir.directionId}`;
          rows.push(<BusTimeDisplay key={key} routeId={route.routeId} directionId={dir.directionId} nextInstances={dir.nextInstances} routeNames={routeNames} />);
        }
      }
    }
  }

  const handleMouseMove = () => {
    lastMouseMove.current = Temporal.Now.instant();
    setShowMouseCursor(true);
  };

  const forceBus = (() =>
  {
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const flag = searchParams.get("force");
    if (flag == "1" || flag?.toLowerCase() === "true") return true;
    else if (flag == "0" || flag?.toLocaleLowerCase() == "false") return false;
    else return null;
  })();
  const showBus = forceBus ?? (rows.length > 0);

  const forceRadar = (() =>
  {
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const flag = searchParams.get("radar");
    if (flag == "1" || flag?.toLowerCase() === "true") return true;
    else if (flag == "0" || flag?.toLocaleLowerCase() == "false") return false;
    else return null;
  })();
  const showRadarIfChancePrecipitationGreater = 20;
  const showRadar = forceRadar ?? (forecast.chancePrecipitation > showRadarIfChancePrecipitationGreater);

  const lat = (() => {
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const flag = searchParams.get("lat");
    return flag ? parseFloat(flag) : null;
  })() ?? 30.2649153;
  const lon = (() => {
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const flag = searchParams.get("lon");
    return flag ? parseFloat(flag) : null;
  })() ?? -97.7501975;

  let layoutClass = "";
  let headerClass = "";
  if (showRadar && showBus)
  {
    layoutClass = "compressed-layout";
  }
  else if (!showRadar && !showBus)
  {
    layoutClass = "hidden-layout";
    headerClass = "hidden-header";
  }

  const enterFullscreen = () => {
    document.body.requestFullscreen();
  };

  return (
    <div onMouseMove={handleMouseMove} className={showMouseCursor ? "" : "hide-mouse-cursor"}>
      <div className={isFullscreen ? "toolbar toolbar-hidden" : "toolbar"}>
        <button onClick={enterFullscreen}>Enter Fullscreen</button>
      </div>
      <header className={headerClass}>
        <WeatherDisplay current={weather} forecast={forecast} uvForecast={uvForecast} lat={lat} lon={lon} />
      </header>
      <main className={layoutClass}>
        {showBus
          ? <section>
              {rows.length == 0 ? <article><div>Nothing scheduled</div></article> : rows}
            </section>
          : <></>}
        {showRadar
          ? <section className='radar'>
              <article><RadarMapComponent lat={lat} lon={lon} /></article>
            </section>
          : <></>}
      </main>
    </div>
  )
}

export default App
