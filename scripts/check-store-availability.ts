import assert from "node:assert/strict";
import {
  isSedeOpenAt,
  pickupScheduleError,
  type HorariosMap,
} from "../src/lib/store-availability.ts";

const horarios: HorariosMap = {
  lun: [{ abre: "12:00", cierra: "22:00" }],
  vie: [{ abre: "20:00", cierra: "02:00" }],
};

assert.equal(
  isSedeOpenAt(horarios, "America/Bogota", new Date("2026-08-10T18:00:00Z")),
  true,
);
assert.equal(
  isSedeOpenAt(horarios, "America/Bogota", new Date("2026-08-11T04:00:00Z")),
  false,
);
assert.equal(
  isSedeOpenAt(horarios, "America/Bogota", new Date("2026-08-08T06:00:00Z")),
  true,
);
assert.equal(
  pickupScheduleError(
    "2026-08-10T18:00:00Z",
    horarios,
    "America/Bogota",
    new Date("2026-08-10T17:00:00Z"),
  ),
  null,
);
assert.match(
  pickupScheduleError(
    "2026-08-11T04:00:00Z",
    horarios,
    "America/Bogota",
    new Date("2026-08-10T17:00:00Z"),
  ) ?? "",
  /cerrada/,
);
