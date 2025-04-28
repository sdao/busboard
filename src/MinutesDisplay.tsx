import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useState } from "react";
import "./MinutesDisplay.css";

export default function MinutesDisplay({ hasLeftTerminus, targetTime }: { hasLeftTerminus: boolean, targetTime: Temporal.Instant }) {
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