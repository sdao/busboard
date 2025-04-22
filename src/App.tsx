import { useState, useEffect, useRef } from 'react'
import OLMap from 'ol/Map';
import OLView from 'ol/View';
import { fromLonLat } from 'ol/proj';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import { MapboxVectorLayer } from 'ol-mapbox-style';
import { BusTimes, DirectionId, RouteId, RouteNames, StopInstance, WeatherConditions, WeatherForecast } from "../shared/types";
import { Temporal } from '@js-temporal/polyfill';
import 'core-js/actual/url';
import 'core-js/actual/url-search-params';
import 'whatwg-fetch'
import './App.css'

function WeatherDisplay({ current, forecast }: { current: WeatherConditions, forecast: WeatherForecast }) {
  function toFahrenheit(c: number | null) {
    if (c === null) {
      return c;
    }
    return Math.round(c * (9.0 / 5.0) + 32.0);
  }

  function getShortDesc(text: string) {
    if (text.includes(" and ")) {
      return text.split(" and ")[0];
    }
    return text;
  }

  if (!current.ok && !forecast.ok) {
    return (
      <>
      </>
    )
  }
  else {
    return (
      <header>
        <div className={current.ok && forecast.ok ? "weather-description weather-description-scroll" : "weatherDesc"}>
          {!current.ok ? <></> : <div>{getShortDesc(current.description)}</div>}
          {!forecast.ok ? <></> : <div><span className='temperature-high'>{toFahrenheit(forecast.highTemperature)}&deg;</span> / <span className='temperature-low'>{toFahrenheit(forecast.lowTemperature)}&deg;</span></div>}
        </div>
        {!current.ok ? <div></div> : <div>{toFahrenheit(current.temperature)}&deg;F</div>}
      </header>
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

  let name = `Route ${routeId}`;
  const route = routeNames.routes.find((route) => route.routeId == routeId);
  if (route !== undefined) {
    const dir = route.directions.find((dir) => dir.directionId == directionId);
    if (dir !== undefined) {
      name = dir.name;
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

const RadarMapComponent = () => {
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
          center: fromLonLat([-97.7501975, 30.2649153]),
          zoom: 10
        }),
        controls: []
      });

      map.updateSize();

      olMapRef.current = map;
      return () => map.setTarget(undefined);
    }
    return () => { };
  }, []);

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
  const [routeNames, setRouteNames] = useState<RouteNames>({ ok: false, routes: [] });
  const [busTimes, setBusTimes] = useState<BusTimes>({ ok: false, stops: [] });
  const [showMouseCursor, setShowMouseCursor] = useState(true);
  const lastMouseMove = useRef(Temporal.Now.instant());

  useEffect(() => {
    let timeoutId = 0;
    const fetchRouteNames = async () => {
      console.log("Fetching route names...");

      try {
        const response = await fetch('/routenames');
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

  const showRadarIfChancePrecipitationGreater = -1;

  return (
    <div onMouseMove={handleMouseMove} className={showMouseCursor ? "" : "hide-mouse-cursor"}>
      <WeatherDisplay current={weather} forecast={forecast} />
      <main className={forecast.chancePrecipitation > showRadarIfChancePrecipitationGreater ? "compressed-layout" : ""}>
        <section>
          {rows.length == 0 ? <article><div>Nothing scheduled</div></article> : rows}
        </section>
        {forecast.chancePrecipitation >= showRadarIfChancePrecipitationGreater
          ? <section className='radar'>
            <article><RadarMapComponent /></article>
          </section>
          : <></>}
      </main>
    </div>
  )
}

export default App
