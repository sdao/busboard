import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import cloudflareLogo from './assets/Cloudflare_Logo.svg'
import './App.css'

type WeatherData = { description: string, temperature: number };
type RouteNamesEntry = { routeId: string, directions: { directionId: number, name: string }[] };
type BusTimesEntry = { stopId: string, routes: { routeId: string, directions: { directionId: number, nextTimes: number[] }[] }[] };

function Weather({ weather } : { weather: null | { description: string, temperature: number }})
{
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
        <h2>{weather.description}</h2>
        <h3>{Math.round(weather.temperature * (9.0/5.0) + 32.0)}&deg;F</h3>
      </header>
    )
  }
}

function MinutesDisplay({ minutes } : { minutes: number})
{
  if (minutes <= 10)
  {
    return <span className="imminent">{minutes}</span>
  }
  else if (minutes <= 15)
  {
    return <span className="verySoon">{minutes}</span>
  }
  else if (minutes <= 20)
  {
    return <span className="soon">{minutes}</span>
  }
  else
  {
    return <span>{minutes}</span>
  }
}

function BusTime({ routeId, directionId, nextTimes, routeNames } : { routeId: string, directionId: number, nextTimes: number[], routeNames: RouteNamesEntry[] })
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
  const minutesUntil = nextTimes.map((seconds) => Math.floor((seconds - nowSeconds) / 60.0)).filter((minutes) => minutes >= 0.0).sort((a, b) => a - b).slice(0, 2);

  const countdowns = [];
  for (var i = 0; i < minutesUntil.length; ++i)
  {
    if (i !== 0)
    {
      countdowns.push(<span>,&nbsp;</span>);
    }
    countdowns.push(<MinutesDisplay minutes={minutesUntil[i]} />);
  }

  const className = String(routeId).length > 2 ? "route route3" : "route";

  return (
    <article>
        <h1><em className={className}><span>{routeId}</span></em></h1>
        <h2>{name}</h2>
        <h3>{countdowns} <div className="subtitle">minutes</div></h3>
    </article>
  )
}

function App() {
  // const [count, setCount] = useState(0);
  // const [name, setName] = useState('unknown');

  const [weather, setWeather] = useState<null | WeatherData>(null);
  const [routeNames, setRouteNames] = useState<null | RouteNamesEntry[]>(null);
  const [busTimes, setBusTimes] = useState<null | BusTimesEntry[]>(null);
  
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

    if (weatherStation !== null)
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
    rows.push(<article><h2>Nothing scheduled</h2></article>);
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
      
      <Weather weather={weather} />
      <main>
        {rows}
      </main>
    </>
  )
}

export default App
