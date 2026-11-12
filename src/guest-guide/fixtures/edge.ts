import type { GuideModel } from "../model";
import { yaleFixture } from "./yale";

/** Edge fixtures, each one change away from the Yale fixture so a failure names its cause. */
const from = (slug: string, change: (m: GuideModel) => void): GuideModel => {
  const m = structuredClone(yaleFixture);
  m.slug = slug;
  change(m);
  return m;
};

/** No usable photograph: the type cover on the arrival field. */
export const noPhotoFixture = from("no-photo", (m) => {
  m.photos = [];
  m.look.plates = {};
  for (const s of m.sections) for (const i of s.items) delete i.photo;
  m.look.cover = {
    kind: "type",
    title: ["135", "Yale Avenue"],
    source: "house name and address",
    checked: "2026-10-23",
  };
});

/** The fleet's longest name, 33 characters. */
export const longNameFixture = from("long-name", (m) => {
  m.name = "616 Bonfoy Main House and Cottage";
});

/** A 63-character Wi-Fi password, the WPA maximum. */
export const longPasswordFixture = from("long-password", (m) => {
  if (m.wifi.kind === "printed")
    m.wifi.password.value = "Fx7kQ2mN9pL4vR8sT1wY6zB3cD5eG0hJ2kM4nP6qR8sT1vW3xZ5aC7eG9iK1mOq";
});

/** The Wi-Fi arrives in a message: the cover prints that live line and no Copy button. */
export const wifiInMessageFixture = from("wifi-in-message", (m) => {
  m.wifi = {
    kind: "in-message",
    line: {
      value:
        "Your gate code, the wifi password and a smart lock code arrive in your arrival message.",
      source: "resident guide, fixture",
      checked: "2026-10-23",
    },
  };
});

/** Facts not on record: printed only as their own live line, or not at all. */
export const unknownsFixture = from("unknowns", (m) => {
  m.checkOut = {
    unknown: true,
    reason: "Checkout time not on record",
    source: "fixture",
    checked: "2026-10-23",
  };
  m.parking = {
    unknown: true,
    reason: "Parking confirmed per stay",
    liveLine: "Filled in before arrival",
    source: "fixture",
    checked: "2026-10-23",
  };
  m.wifi = {
    kind: "unknown",
    fact: {
      unknown: true,
      reason: "Password read from the environment, unset",
      liveLine: "Not confirmed yet. Ask us before you arrive.",
      source: "fixture",
      checked: "2026-10-23",
    },
  };
});
