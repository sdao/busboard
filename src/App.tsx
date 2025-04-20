import { useState, useEffect } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import cloudflareLogo from './assets/Cloudflare_Logo.svg'
import './App.css'

type WeatherData = { description: string, temperature: number };
type RouteNamesEntry = { routeId: string, directions: { directionId: number, name: string }[] };
type BusTimesEntry = { stopId: string, routes: { routeId: string, directions: { directionId: number, nextTimes: { hasLeftTerminus: boolean, time: number }[] }[] }[] };

function Weather({ weather, low, high } : { weather: null | { description: string, temperature: number }, low: null | number, high: null | number})
{
  function ctof(c: number | null)
  {
    if (c === null)
    {
      return c;
    }
    return Math.round(c * (9.0/5.0) + 32.0);
  }
  function shortdesc(text: string)
  {
    if (text.includes(" and "))
    {
      return text.split(" and ")[0];
    }
    return text;
  }
  if (weather === null)
  {
    return (
      <>
      </>
    )
  }
  else
  {
    return (
      <header>
        <div className="weatherDesc">
        <div>{shortdesc(weather.description)}</div>
        <div><span className='hitemp'>{ctof(high)}&deg;</span> / <span className='lotemp'>{ctof(low)}&deg;</span></div>
        </div>
        <div>{ctof(weather.temperature)}&deg;F</div>
      </header>
    )
  }
}

function MinutesDisplay({ hasLeftTerminus, minutes } : { hasLeftTerminus: boolean, minutes: number})
{
  const classes = [];
  if (hasLeftTerminus)
  {
    classes.push("hasLeftTerminus");
  }
  else
  {
    classes.push("hasNotLeftTerminus");
  }

  if (minutes <= 3)
  {
    classes.push("imminent");
  }
  else if (minutes <= 5)
  {
    classes.push("verySoon");
  }
  else if (minutes <= 7)
  {
    classes.push("soon");
  }
  return <span className={classes.join(" ")}>{minutes}</span>
}

function BusTime({ routeId, directionId, nextTimes, routeNames } : { routeId: string, directionId: number, nextTimes: { hasLeftTerminus: boolean, time: number }[], routeNames: RouteNamesEntry[] })
{
  const [_, setCount] = useState(0);
  
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCount((val) => val + 1);
    }, 5 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  var name = `Route ${routeId}`;
  const entry = routeNames.find((entry) => entry.routeId == routeId);
  if (entry !== undefined)
  {
    const dir = entry.directions.find((dir) => dir.directionId == directionId);
    if (dir !== undefined)
    {
      name = dir.name;
    }
  }

  // const dirCode = directionId === 1 ? "N" : "S";

  const nowSeconds = Date.now() / 1000.0;
  const minutesUntil = nextTimes.map((timeEntry) => ({ hasLeftTerminus: timeEntry.hasLeftTerminus, time: Math.floor((timeEntry.time - nowSeconds) / 60.0) })).filter((timeEntry) => timeEntry.time >= 0.0).sort((a, b) => a.time - b.time).slice(0, 2);

  const countdowns = [];
  for (var i = 0; i < minutesUntil.length; ++i)
  {
    if (i !== 0)
    {
      countdowns.push(<span>,&nbsp;</span>);
    }
    countdowns.push(<MinutesDisplay hasLeftTerminus={minutesUntil[i].hasLeftTerminus} minutes={minutesUntil[i].time} />);
  }

  const className = String(routeId).length > 2 ? "route route3" : "route";

  return (
    <article>
        <div><em className={className}><span>{routeId}</span></em></div>
        <div>{name}</div>
        <div>{countdowns} <div className="subtitle">minutes</div></div>
    </article>
  )
}

function App() {
  // const [count, setCount] = useState(0);
  // const [name, setName] = useState('unknown');

  const [weather, setWeather] = useState<null | WeatherData>(null);
  const [routeNames, setRouteNames] = useState<null | RouteNamesEntry[]>(null);
  const [busTimes, setBusTimes] = useState<null | BusTimesEntry[]>(null);
  const [low, setLow] = useState<null | number>(null);
  const [high, setHigh] = useState<null | number>(null);
  
  // useEffect(() => {
  //   const intervalId = window.setInterval(() => {
  //     setCount((val) => val + 1);
  //   }, 1000);

  //   return () => window.clearInterval(intervalId);
  // }, []);

  useEffect(() => {
    var timeoutId = 0;
    const fetchRouteNames = async () => {
      console.log("Fetching route names...");

      try
      {
        const response = await fetch('/routenames');
        const data = await response.json();
        const { ok, routes } = data;
        if (ok === true) {
          setRouteNames(routes);
          return true;
        }
      }
      catch (e)
      {
      }

      timeoutId = window.setTimeout(() => fetchRouteNames(), 30 * 1000);
      return false;
    };

    fetchRouteNames();
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    var timeoutId = 0;
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const stopIds = searchParams.get("stopids");

    if (stopIds !== null)
    {
      const fetchBusTimes = async () => {
        console.log("Fetching bus times...");

        var nextTimeout = 60 * 1000;
        try
        {
          const response = await fetch(`/bustimes?stops=${stopIds}`);
          const data = await response.json();
          const { ok, stops } = data;
          if (ok === true)
          {
            setBusTimes(stops);

            // If there are no more scheduled buses for the night, throttle updates to every ten minutes
            const isAnyNextTime = () => {
              if (stops !== null)
              {
                for (const stop of (stops as BusTimesEntry[]))
                {
                  for (const route of stop.routes)
                  {
                    for (const dir of route.directions)
                    {
                      if (dir.nextTimes.length !== 0)
                      {
                        return true;
                      }
                    }
                  }
                }
              }
              return false;
            };

            if (!isAnyNextTime())
            {
              nextTimeout = 10 * 60 * 1000;
            }
          }
        }
        catch (e)
        {
        }

        timeoutId = window.setTimeout(() => fetchBusTimes(), nextTimeout);
      };

      fetchBusTimes();
    }

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    var timeoutId = 0;
    const paramsString = window.location.search;
    const searchParams = new URLSearchParams(paramsString);
    const weatherStation = searchParams.get("weather");
    const wfo = searchParams.get("wfo");
    const x = searchParams.get("x");
    const y = searchParams.get("y");

    if (weatherStation !== null && wfo !== null && x !== null && y !== null)
    {
      const fetchWeather = async () => {
        console.log("Fetching weather...");

        try
        {
          const response = await fetch(`/weather?station=${weatherStation}`);
          const data = await response.json();
          const { ok, weather } = data;
          if (ok === true)
          {
            setWeather(weather);
          }
        }
        catch (e)
        {
        }

        try
        {
          const response = await fetch(`/lohi?wfo=${wfo}&x=${x}&y=${y}`);
          const data = await response.json();
          const { ok, low, high } = data;
          if (ok === true)
          {
            setLow(low);
            setHigh(high);
          }
        }
        catch (e)
        {
        }

        timeoutId = window.setTimeout(() => fetchWeather(), 15 * 60 * 1000);
      };

      fetchWeather();
    }

    return () => window.clearTimeout(timeoutId);
  }, []);

  const rows = [];
  if (busTimes !== null && routeNames !== null)
  {
    for (const stop of busTimes)
    {
      for (const route of stop.routes)
      {
        for (const dir of route.directions)
        {
          rows.push(<BusTime routeId={route.routeId} directionId={dir.directionId} nextTimes={dir.nextTimes} routeNames={routeNames} />);
        }
      }
    }
  }
  if (rows.length == 0)
  {
    rows.push(<article><div>Nothing scheduled</div></article>);
  }

  return (
    <>
      {/* <div>
        <a href='https://vite.dev' target='_blank'>
          <img src={viteLogo} className='logo' alt='Vite logo' />
        </a>
        <a href='https://react.dev' target='_blank'>
          <img src={reactLogo} className='logo react' alt='React logo' />
        </a>
        <a href='https://workers.cloudflare.com/' target='_blank'>
          <img src={cloudflareLogo} className='logo cloudflare' alt='Cloudflare logo' />
        </a>
      </div>
      <h1>Vite + React + Cloudflare</h1>
      <div className='card'>
        <button
          onClick={() => setCount((count) => count + 1)}
          aria-label='increment'
        >
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div> */}
      {/* <div className='card'>
        <button
          onClick={() => {
            fetch('/weather?station=KAUS')
              .then((res) => res.json())
              .then((data) => {
                const { ok, weather } = data;
                if (ok === true) {
                  setWeather(weather);
                }
              });
            fetch('/bustimes?stops=3757,2628,4382')
              .then((res) => res.json())
              .then((data) => {
                const { ok, stops } = data;
                if (ok === true) {
                  setBusTimes(stops);
                }
              });
            fetch('/routenames')
              .then((res) => res.json())
              .then((data) => {
                const { ok, routes } = data;
                if (ok === true) {
                  setRouteNames(routes);
                }
              });
          }}
          aria-label='get name'
        >
          Click to Update Data
        </button>
      </div> */}
      
      <Weather weather={weather} high={high} low={low} />
      <main>
        {rows}
      </main>
    </>
  )
}

export default App
