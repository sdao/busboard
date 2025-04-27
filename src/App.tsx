import { useState, useEffect, useRef } from 'react'
import OLMap from 'ol/Map';
import OLView from 'ol/View';
import { fromLonLat } from 'ol/proj';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import Attribution from 'ol/control/Attribution';
import { MapboxVectorLayer } from 'ol-mapbox-style';
import SunCalc from 'suncalc';
import { BusTimes, DirectionId, ReverseGeocode, RouteId, TransitSystemInfo, StopInstance, UvForecastDay, WeatherConditions, WeatherForecast } from "../shared/types";
import { Temporal } from '@js-temporal/polyfill';
import 'core-js/actual/url';
import 'core-js/actual/url-search-params';
import 'whatwg-fetch'
import './App.css'

function celsiusToFahrenheit(c: number | null) {
  if (c === null) {
    return c;
  }
  return Math.round(c * (9.0 / 5.0) + 32.0);
}

function WeatherEmoji({ current, lat, lon }: { current: WeatherConditions, lat: number, lon: number }) {
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
      const nowDate = new Date();
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

  if (current.ok && !!current.description) {
    return <div className="weather-emoji">{getEmoji(current.description)}</div>;
  }
  else {
    return <></>;
  }
}

function WeatherShortDesc({ current }: { current: WeatherConditions }) {
  function getShortDesc(text: string) {
    if (text.includes(" and ")) {
      return text.split(" and ")[0];
    }
    return text;
  }

  if (current.ok && !!current.description) {
    return <div>{getShortDesc(current.description)}</div>;
  }
  else {
    return <></>;
  }
}

function WeatherHighLowTemp({ forecast }: { forecast: WeatherForecast }) {
  if (forecast.ok) {
    return <div><span className='temperature-high'>{celsiusToFahrenheit(forecast.highTemperature)}&deg;</span> / <span className='temperature-low'>{celsiusToFahrenheit(forecast.lowTemperature)}&deg;</span></div>;
  }
  else {
    return <></>;
  }
}

function WeatherUvDescription({ uvForecast }: { uvForecast: UvForecastDay }) {
  function getUvDesc()
  {
    const now = Temporal.Now.zonedDateTimeISO();
    const plainNow = now.toPlainDateTime();
    const plainToday = plainNow.toPlainDate();

    const forecasts = uvForecast.forecasts.filter(f => Temporal.PlainDateTime.compare(plainToday, Temporal.PlainDate.from(f.time)) >= 0);
    if (forecasts.length === 0) {
      return null;
    }

    const maxUvToday = Math.max(...forecasts.map(f => f.uvIndex));
    const currentHourIndex = forecasts.findIndex(f => Temporal.PlainDateTime.compare(plainNow, Temporal.PlainDateTime.from(f.time)) <= 0);
    if (currentHourIndex === -1) {
      // Not sure what the current UV is; show the high today if it's moderate or stronger
      if (maxUvToday >= 3) {
        return `UV High ${maxUvToday}`;
      }
    }
    else {
      // Only show UV if it's moderate now or later in the day
      const maxUvRestOfDay = Math.max(...forecasts.slice(currentHourIndex).map(f => f.uvIndex));
      if (maxUvRestOfDay >= 3) {
        const currentHourUv = forecasts[currentHourIndex];
        return `UV ${currentHourUv.uvIndex} / High ${maxUvToday}`;
      }
    }

    return null;
  }

  const uvDesc = getUvDesc();
  if (uvDesc) {
    return <div>{uvDesc}</div>;
  }
  else {
    return <></>;
  }
}

function WeatherDisplay({ current, forecast, uvForecast, lat, lon }: { current: WeatherConditions, forecast: WeatherForecast, uvForecast: UvForecastDay, lat: number, lon: number }) {
  return (
    <>
      <WeatherEmoji current={current} lat={lat} lon={lon} />
      <div className="weather-description">
        <WeatherShortDesc current={current} />
        <WeatherHighLowTemp forecast={forecast} />
        <WeatherUvDescription uvForecast={uvForecast} />
      </div>
      {current.ok ? <div>{celsiusToFahrenheit(current.temperature)}&deg;F</div> : <div></div>}
    </>
  );
}

function RouteIdDisplay({ routeId }: { routeId: RouteId }) {
  const routeClassName = String(routeId).length > 2 ? "route route3" : "route";
  return <h1 className={routeClassName}><span>{routeId}</span></h1>;
}

function RouteNameDisplay({ routeId, directionId, transitInfo }: { routeId: RouteId, directionId: DirectionId, transitInfo: TransitSystemInfo }) {
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
  const route = transitInfo.routes.find((route) => route.routeId == routeId);
  if (route !== undefined) {
    const dir = route.directions.find((dir) => dir.directionId == directionId);
    if (dir !== undefined) {
      name = abbreviate(dir.name);
    }
  }

  return <>{name}</>;
}

function MinutesDisplay({ hasLeftTerminus, targetTime }: { hasLeftTerminus: boolean, targetTime: Temporal.Instant }) {
  const [, setCount] = useState(0);

  // Force a re-render every 5 seconds to keep the remaining time up-to-date
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCount((val) => val + 1);
    }, 5 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const classes = ["minutes-until"];
  if (hasLeftTerminus) {
    classes.push("has-left-terminus");
  }
  else {
    classes.push("has-not-left-terminus");
  }

  const now = Temporal.Now.instant();
  const minutes = Math.floor(now.until(targetTime).total("minutes"));
  if (minutes >= 0) {
    if (minutes <= 3) {
      classes.push("imminent");
    }
    else if (minutes <= 5) {
      classes.push("very-soon");
    }
    else if (minutes <= 7) {
      classes.push("soon");
    }

    return <span className="minutes-display"><span className={classes.join(" ")}>{minutes}</span></span>;
  }
  else {
    return <></>;
  }
}

function BusTimeDisplay({ routeId, directionId, nextInstances, transitInfo }: { routeId: RouteId, directionId: DirectionId, nextInstances: StopInstance[], transitInfo: TransitSystemInfo }) {
  return (
    <article>
      <div><RouteIdDisplay routeId={routeId}/></div>
      <div className="headsign"><RouteNameDisplay routeId={routeId} directionId={directionId} transitInfo={transitInfo} /></div>
      <div><div>{nextInstances.map(inst => <MinutesDisplay key={inst.time} hasLeftTerminus={inst.hasLeftTerminus} targetTime={Temporal.Instant.from(inst.time)} />)}</div><div className="subtitle">minutes</div></div>
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
        controls: [new Attribution({collapsible: false})]
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

function AutoHideMouseCursor(props: React.PropsWithChildren) {
  const [showMouseCursor, setShowMouseCursor] = useState(true);
  const lastMouseMove = useRef(Temporal.Now.instant());
  
  // Mousemove/idle effect
  useEffect(() => {
    if (showMouseCursor) {
      const intervalId = window.setInterval(() => {
        const now = Temporal.Now.instant();
        if (now.since(lastMouseMove.current).total("seconds") > 10) {
          setShowMouseCursor(false);
        }
      }, 10 * 1000);

      return () => window.clearInterval(intervalId);
    }

    return () => {};
  }, [showMouseCursor]);

  const handleMouseMove = () => {
    lastMouseMove.current = Temporal.Now.instant();
    setShowMouseCursor(true);
  };

  return <div onMouseMove={handleMouseMove} className={showMouseCursor ? "" : "hide-mouse-cursor"}>{props.children}</div>;
}

class TimeoutToken {
  timeoutId: number = 0;
  isCancelled: boolean = false;

  setTimeout(handler: TimerHandler, timeout: number) {
    this.timeoutId = window.setTimeout(handler, timeout);
  }

  clearTimeout() {
    window.clearTimeout(this.timeoutId);
    this.timeoutId = 0;
    this.isCancelled = true;
  }
}

function tryUntilSuccessful(timeoutSeconds: number, func: () => Promise<boolean>): TimeoutToken {
  const token = new TimeoutToken();
  const doWork = async () => {
    try {
      const ok = await func();
      if (ok) {
        return true;
      }
    }
    catch (e) {
      console.error(e);
    }

    if (!token.isCancelled) {
      token.setTimeout(doWork, timeoutSeconds * 1000);
    }
    return false;
  };

  doWork();
  return token;
}

function tryIndefinitely(defaultTimeoutSeconds: number, func: () => Promise<number | void>): TimeoutToken {
  const token = new TimeoutToken();
  const doWork = async() => {
    let timeoutSeconds = defaultTimeoutSeconds;
    try {
      timeoutSeconds = await func() ?? defaultTimeoutSeconds;
    }
    catch (e) {
      console.error(e);
    }

    if (!token.isCancelled) {
      token.setTimeout(doWork, timeoutSeconds * 1000);
    }
  }

  doWork();
  return token;
}

function App() {
  const [lat, setLat] = useState(30.2649);
  const [lon, setLon] = useState(-97.7472);
  const [zipcode, setZipcode] = useState<string | null>(null);
  const [weatherTile, setWeatherTile] = useState<{ wfo: string, x: number, y: number} | null>(null);
  const [weatherStation, setWeatherStation] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherConditions>({ ok: false, description: "", temperature: 0 });
  const [forecast, setForecast] = useState<WeatherForecast>({ ok: false, highTemperature: 0, lowTemperature: 0, chancePrecipitation: 0 });
  const [uvForecast, setUvForecast] = useState<UvForecastDay>({ ok: false, forecasts: [] });
  const [transitInfo, setTransitInfo] = useState<TransitSystemInfo>({ ok: false, routes: [], closestStops: [] });
  const [busTimes, setBusTimes] = useState<BusTimes>({ ok: false, stops: [] });
  const [isFullscreen, setFullscreen] = useState(false);

  const paramsString = window.location.search;
  const searchParams = new URLSearchParams(paramsString);
  const forceBus = (() =>
  {
    const flag = searchParams.get("bus");
    if (flag == "1" || flag?.toLowerCase() === "true") return true;
    else if (flag == "0" || flag?.toLocaleLowerCase() == "false") return false;
    else return null;
  })();
  const forceRadar = (() =>
  {
    const flag = searchParams.get("radar");
    if (flag == "1" || flag?.toLowerCase() === "true") return true;
    else if (flag == "0" || flag?.toLocaleLowerCase() == "false") return false;
    else return null;
  })();

  // Fetch effects
  useEffect(() => {
    const token = tryUntilSuccessful(30, async () => {
        console.log(`Fetching reverse geocode for ${lat}, ${lon}...`);

        const response = await fetch(`/geo?lat=${lat}&lon=${lon}`);
        if (!response.ok) {
          throw new Error(`<${response.url}> responded with: ${response.status}`);
        }
        
        const data = await response.json() as ReverseGeocode;
        if (!token.isCancelled) {
          console.info(`lat=${data.lat}, lon=${data.lon}`);
          if (data.zip) {
            console.info(`zipcode=${data.zip}`);
            setZipcode(data.zip);
          }
          if (data.weatherTile) {
            console.info(`weatherTile=${data.weatherTile.wfo}, ${data.weatherTile.x}, ${data.weatherTile.y}`);
            setWeatherTile(data.weatherTile);
          }
          if (data.weatherStation) {
            console.info(`weatherStation=${data.weatherStation}`);
            setWeatherStation(data.weatherStation);
          }
        }
        
        return data.ok;
    });

    return () => token.clearTimeout();
  }, [lat, lon]);

  useEffect(() => {
    const token = tryUntilSuccessful(30, async () => {
      console.log(`Fetching route names for ${lat}, ${lon}...`);

      const response = await fetch(`/transitinfo?lat=${lat}&lon=${lon}`);
      if (!response.ok) {
        throw new Error(`<${response.url}> responded with: ${response.status}`);
      }
      
      const data = await response.json() as TransitSystemInfo;
      if (data.ok && !token.isCancelled) {
        console.info(`Closest stops: ${data.closestStops}`);
        setTransitInfo(data);
        return true;
      }

      return false;
    });

    return () => token.clearTimeout();
  }, [lat, lon]);

  useEffect(() => {
    if (transitInfo.closestStops.length !== 0) {
      const token = tryIndefinitely(60, async () => {
        console.log(`Fetching bus times for ${transitInfo.closestStops}...`);

        let nextTimeout = 60;

        const stopIds = transitInfo.closestStops.join(",");
        const response = await fetch(`/bustimes?stops=${stopIds}`);
        if (!response.ok) {
          throw new Error(`<${response.url}> responded with: ${response.status}`);
        }
        
        const data = await response.json() as BusTimes;
        if (data.ok && !token.isCancelled) {
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
            nextTimeout = 10 * 60;
          }
        }

        return nextTimeout;
      });

      return () => token.clearTimeout();
    }

    return () => {};
  }, [transitInfo.closestStops]);

  useEffect(() => {
    const loadCurrent = (weatherStation !== null);
    const loadForecast = (weatherTile !== null);

    if (loadCurrent || loadForecast) {
      const token = tryIndefinitely(15 * 60, async () => {
        console.log(`Fetching weather for ${weatherStation}, ${JSON.stringify(weatherTile)}...`);

        if (loadCurrent) {
          const response = await fetch(`/weather?station=${weatherStation}`);
          if (response.ok) {
            const data = await response.json() as WeatherConditions;
            if (data.ok && !token.isCancelled) {
              console.log("weather current: %s", JSON.stringify(data));
              setWeather(data);
            }
          }
          else {
            console.error(`<${response.url}> responded with: ${response.status}`);
          }
        }

        if (loadForecast) {
          const response = await fetch(`/forecast?wfo=${weatherTile.wfo}&x=${weatherTile.x}&y=${weatherTile.y}`);
          if (response.ok) {
            const data = await response.json() as WeatherForecast;
            if (data.ok && !token.isCancelled) {
              console.log("weather forecast: %s", JSON.stringify(data));
              setForecast(data);
            }
          }
          else {
            console.error(`<${response.url}> responded with: ${response.status}`);
          }
        }
      });

      return () => token.clearTimeout();
    }

    return () => {};
  }, [weatherStation, weatherTile]);

  useEffect(() => {
    if (zipcode) {
      const token = tryIndefinitely(60 * 60, async () => {
        console.log(`Fetching UV for ${zipcode}...`);

        const response = await fetch(`/uv?zip=${zipcode}`);
        if (!response.ok) {
          throw new Error(`<${response.url}> responded with: ${response.status}`);
        }

        const data = await response.json() as UvForecastDay;
        if (data.ok && !token.isCancelled) {
          console.log("UV forecast: %s", JSON.stringify(data));
          setUvForecast(data);
        }
      });

      return () => token.clearTimeout();
    }

    return () => {};
  }, [zipcode]);

  // Fullscreen effect
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

  // Wakelock effect
  useEffect(() => {
    if (isFullscreen) {
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

  // Geolocation effect
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(position => {
      console.log("GEOLCATION SUCCESS!");
      setLat(position.coords.latitude);
      setLon(position.coords.longitude);
    });
  }, []);

  const rows = [];
  if (busTimes.ok) {
    for (const stop of busTimes.stops) {
      for (const route of stop.routes) {
        for (const dir of route.directions) {
          const key = `${stop.stopId}_${route.routeId}_${dir.directionId}`;
          rows.push(<BusTimeDisplay key={key} routeId={route.routeId} directionId={dir.directionId} nextInstances={dir.nextInstances} transitInfo={transitInfo} />);
        }
      }
    }
  }

  const showBus = forceBus ?? (rows.length > 0);
  const showRadarIfChancePrecipitationGreater = 20;
  const showRadar = forceRadar ?? (forecast.chancePrecipitation > showRadarIfChancePrecipitationGreater);

  return (
    <AutoHideMouseCursor>
      <div className={isFullscreen ? "toolbar toolbar-hidden" : "toolbar"}>
        <button onClick={() => document.body.requestFullscreen()}>Enter Fullscreen</button>
      </div>
      <header>
        {showBus || showRadar ? <WeatherDisplay current={weather} forecast={forecast} uvForecast={uvForecast} lat={lat} lon={lon} /> : <></>}
      </header>
      <main>
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
    </AutoHideMouseCursor>
  )
}

export default App
