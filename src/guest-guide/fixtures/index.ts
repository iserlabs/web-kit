import type { GuideBrand } from "../brand";
import type { Approval } from "../copy";
import type { GuideModel } from "../model";
import { columbusBrand, sunMountainBrand } from "./brands";
import { columbus52Fixture } from "./columbus-52";
import {
  longNameFixture,
  longPasswordFixture,
  noPhotoFixture,
  unknownsFixture,
  wifiInMessageFixture,
} from "./edge";
import { yaleFixture } from "./yale";

export { columbusBrand, sunMountainBrand } from "./brands";
export { columbus52Fixture } from "./columbus-52";
export * from "./edge";
export { yaleFixture } from "./yale";

/** The day every fixture is validated against. */
export const FIXTURE_TODAY = "2026-11-11";

/** Every section approved for the whole brand: the drafts preview without the "show" switch. */
export const ALL_APPROVED: Approval[] = (
  [
    "template-labels",
    "cover",
    "quick-find",
    "arrival",
    "first-hour",
    "house",
    "good-to-know",
    "rules",
    "checkout",
    "nearby",
    "help",
    "unknowns",
    "door-timing",
  ] as const
).map((section) => ({
  section,
  scope: "brand" as const,
  by: "Jake" as const,
  on: "2026-11-11",
  source: "fixture",
}));

export type Fixture = { id: string; model: GuideModel; brand: GuideBrand };

/** Every fixture the review surface renders. */
export const FIXTURES: Fixture[] = [
  { id: "yale", model: yaleFixture, brand: sunMountainBrand },
  { id: "columbus-52", model: columbus52Fixture, brand: columbusBrand },
  { id: "no-photo", model: noPhotoFixture, brand: sunMountainBrand },
  { id: "long-name", model: longNameFixture, brand: sunMountainBrand },
  { id: "long-password", model: longPasswordFixture, brand: sunMountainBrand },
  { id: "wifi-in-message", model: wifiInMessageFixture, brand: sunMountainBrand },
  { id: "unknowns", model: unknownsFixture, brand: sunMountainBrand },
];
