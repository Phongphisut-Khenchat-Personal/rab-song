import { MoveStopButton, StopForm, VehicleForm } from "@/components/owner-forms";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { periodLabel, type RunPeriod } from "@/lib/labels";
import { listRoutes } from "@/server/roster";

const days = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default async function RoutesPage() {
  const actor = await requirePageActor(["OWNER"]);
  const routes = await listRoutes(actor);
  const vehicles = new Map(routes.map((route) => [route.vehicleId, route]));
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <h1>เส้นทางและรถ</h1>
        {[...vehicles.values()].map((route) => (
          <section className="card stack" key={route.vehicleId}>
            <h2>{route.vehicleLabel}</h2>
            <VehicleForm vehicle={{ id: route.vehicleId, plateNumber: route.vehiclePlate, label: route.vehicleLabel, capacity: route.capacity }} />
          </section>
        ))}
        {routes.map((route) => (
          <section className="card stack" key={route.id}>
            <h2>{route.name}</h2>
            <div className="muted">{route.schoolName} · {route.driverName}</div>
            <ul className="list">
              {route.stops.map((stop, index) => (
                <li key={stop.id}>
                  {stop.sequence}. {stop.name} · {stop.address}
                  <div className="link-row">
                    <MoveStopButton routeId={route.id} stopId={stop.id} direction={-1} label="เลื่อนขึ้น" disabled={index === 0} />
                    <MoveStopButton routeId={route.id} stopId={stop.id} direction={1} label="เลื่อนลง" disabled={index === route.stops.length - 1} />
                  </div>
                </li>
              ))}
            </ul>
            <StopForm routeId={route.id} />
            <div>
              {route.schedules.map((schedule) => (
                <div key={schedule.id}>{days[schedule.dayOfWeek]} {periodLabel(schedule.period as RunPeriod)} {schedule.plannedStartTime}</div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
