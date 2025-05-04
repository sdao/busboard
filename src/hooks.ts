import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useState } from "react";

export function useTime(refreshMilliseconds: number) {
    const [time, setTime] = useState(() => Temporal.Now.instant());

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setTime(Temporal.Now.instant());
        }, refreshMilliseconds);

        return () => window.clearInterval(intervalId);
    }, [refreshMilliseconds]);

    return time;
}
