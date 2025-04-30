import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { Temporal } from "@js-temporal/polyfill";
import { BusInstance, BusTimes, DirectionId, DirectionInstance, RouteId, RouteInstance, StopId, StopInstance } from "./types";

export default class BusTimesBuilder {
    readonly times: Map<StopId, Map<RouteId, Map<DirectionId, { hasLeftTerminus: boolean, seconds: number }[]>>>;
    readonly stopIds: ReadonlyArray<StopId>;
    readonly feedTimestamp: number;

    currentRouteId: RouteId = "";
    currentDirectionId: DirectionId = 0;
    currentTripHasLeftTerminus: boolean = true;

    constructor(stopIds: StopId[], feedTimestamp: number) {
        this.times = new Map();
        this.stopIds = stopIds;
        this.feedTimestamp = feedTimestamp;

        for (const stopId of stopIds) {
            this.times.set(stopId, new Map());
        }
    }

    getTimesArray(stopId: StopId, routeId: RouteId, directionId: DirectionId): { hasLeftTerminus: boolean, seconds: number }[] {
        let stop = this.times.get(stopId);
        if (stop === undefined) {
            stop = new Map();
            this.times.set(stopId, stop);
        }

        let route = stop.get(routeId);
        if (route === undefined) {
            route = new Map();
            stop.set(routeId, route);
        }

        let direction = route.get(directionId);
        if (direction === undefined) {
            direction = [];
            route.set(directionId, direction);
        }

        return direction;
    }

    beginTrip(routeId: RouteId, directionId: DirectionId) {
        this.currentRouteId = routeId;
        this.currentDirectionId = directionId;
        this.currentTripHasLeftTerminus = true;
    }

    addStop(stopId: StopId, scheduleRelationship: string | GtfsRealtimeBindings.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship, stopSequence?: number, arrivalTimestamp?: number, departureTimestamp?: number): boolean {
        // Check if this is the initial terminus stop (must be the first stop!)
        if (this.currentTripHasLeftTerminus &&
            stopSequence === 1 &&
            departureTimestamp !== undefined) {
            // Check if the bus had not left the terminus yet when the feed was generated
            if (departureTimestamp > this.feedTimestamp) {
                // If so, then mark that the bus is still at the terminus
                this.currentTripHasLeftTerminus = false;
            }
        }

        // Now check if this stop is on the list of stops for which to get bus times
        if (this.stopIds.includes(stopId) &&
            arrivalTimestamp !== undefined) {
            if (scheduleRelationship === "SCHEDULED" || scheduleRelationship === GtfsRealtimeBindings.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED) {
                this.getTimesArray(stopId, this.currentRouteId, this.currentDirectionId).push({ hasLeftTerminus: this.currentTripHasLeftTerminus, seconds: arrivalTimestamp });
            }

            // This stop cannot occur again in this tripUpdate.stopTimeUpdate
            return true;
        }

        return false;
    }

    build(): BusTimes {
        const busTimes: BusTimes = { stops: [] };
        for (const [stopId, routes] of this.times) {
            const stopInstance: StopInstance = { stopId, routes: [] };
            busTimes.stops.push(stopInstance);

            for (const [routeId, directions] of routes) {
                const routeInstance: RouteInstance = { routeId, directions: [] };
                stopInstance.routes.push(routeInstance);

                for (const [directionId, times] of directions) {
                    const nextInstances: BusInstance[] = times.sort((a, b) => a.seconds - b.seconds).slice(0, 5).map(arrival => ({ hasLeftTerminus: arrival.hasLeftTerminus, time: Temporal.Instant.fromEpochMilliseconds(arrival.seconds * 1000.0).toString() }));
                    const directionInstance: DirectionInstance = { directionId, nextInstances };
                    routeInstance.directions.push(directionInstance);
                }
            }
        }

        return busTimes;
    }

    static createFromJson(stopIds: StopId[], json: unknown): BusTimesBuilder {
        if (typeof json !== "object" || json === null) {
            throw new Error("missing JSON root object");
        }

        if (!("header" in json) || typeof json.header !== "object" || json.header === null ||
            !("timestamp" in json.header) || typeof json.header.timestamp !== "string") {
            throw new Error("missing header or header.timestamp");
        }

        const feedTimestamp = parseInt(json.header.timestamp);

        if (!("entity" in json) || !Array.isArray(json.entity)) {
            throw new Error("missing entity list");
        }

        const builder = new BusTimesBuilder(stopIds, feedTimestamp);

        for (const entity of json.entity as unknown[]) {
            if (typeof entity === "object" && entity !== null &&
                "tripUpdate" in entity && typeof entity.tripUpdate === "object" && entity.tripUpdate !== null &&
                "trip" in entity.tripUpdate && typeof entity.tripUpdate.trip === "object" && entity.tripUpdate.trip !== null &&
                "stopTimeUpdate" in entity.tripUpdate && Array.isArray(entity.tripUpdate.stopTimeUpdate)) {
                const { trip, stopTimeUpdate } = entity.tripUpdate;
                if ("routeId" in trip && typeof trip.routeId === "string" &&
                    "directionId" in trip && typeof trip.directionId === "number") {
                    builder.beginTrip(trip.routeId, trip.directionId);

                    for (const update of stopTimeUpdate as unknown[]) {
                        if (typeof update === "object" && update !== null) {
                            if ("stopId" in update && typeof update.stopId === "string" &&
                                "scheduleRelationship" in update && typeof update.scheduleRelationship === "string") {
                                const { stopId, scheduleRelationship } = update;
                                const stopSequence = "stopSequence" in update && typeof update.stopSequence === "number" ? update.stopSequence : undefined;
                                const arrivalTimestamp = "arrival" in update && typeof update.arrival === "object" && update.arrival !== null &&
                                    "time" in update.arrival && typeof update.arrival.time === "string"
                                    ? parseInt(update.arrival.time) : undefined;
                                const departureTimestamp = "departure" in update && typeof update.departure === "object" && update.departure !== null &&
                                    "time" in update.departure && typeof update.departure.time === "string"
                                    ? parseInt(update.departure.time) : undefined;

                                const halt = builder.addStop(stopId, scheduleRelationship, stopSequence, arrivalTimestamp, departureTimestamp);
                                if (halt) {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        return builder;
    }

    static createFromProtobuf(stopIds: StopId[], buffer: ArrayBuffer): BusTimesBuilder {
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

        if (typeof feed.header.timestamp !== "number") {
            throw new Error("missing header.timestamp");
        }
        
        const builder = new BusTimesBuilder(stopIds, feed.header.timestamp);

        for (const entity of feed.entity) {
            if (entity.tripUpdate !== null && entity.tripUpdate !== undefined) {
                const { trip, stopTimeUpdate } = entity.tripUpdate;
                if (stopTimeUpdate !== null && stopTimeUpdate !== undefined) {
                    const { routeId, directionId } = trip;
                    if (routeId !== null && routeId !== undefined && directionId !== null && directionId !== undefined) {
                        builder.beginTrip(routeId, directionId);
                        
                        for (const update of stopTimeUpdate) {
                            if (update.stopId !== null && update.stopId !== undefined &&
                                update.scheduleRelationship !== null && update.scheduleRelationship !== undefined) {
                                const stopSequence = update.stopSequence ?? undefined;
                                const arrivalTimestamp = typeof update.arrival?.time == "number" ? update.arrival.time : undefined;
                                const departureTimestamp = typeof update.departure?.time == "number" ? update.departure.time : undefined;
                                
                                const halt = builder.addStop(update.stopId, update.scheduleRelationship, stopSequence, arrivalTimestamp, departureTimestamp);
                                if (halt) {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        return builder;
    }
}