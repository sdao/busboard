import { Temporal } from "@js-temporal/polyfill";
import { UseQueryResult } from "@tanstack/react-query";
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

export function useQueryResultLog(queryResult: UseQueryResult) {
    useEffect(() => {
        if (queryResult.failureReason !== null) {
            console.error(queryResult.failureReason);
        }
    }, [queryResult.failureReason]);
}