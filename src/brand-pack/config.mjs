import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SHARE_CARD_IDS } from "./share-cards.mjs";
import { isUnfilled, UNFILLED } from "./unfilled.mjs";

export const BRAND_PACK_FILENAME = "brand-pack.config.mjs";

export { isUnfilled, UNFILLED };

const EM_DASH = "\u2014";

const TOKEN_KEYS = [
  "siteUrl",
  "wordmark",
  "tagline",
  "markUrl",
  "markAlt",
  "displayFont",
  "bodyFont",
  "ink",
  "ground",
  "brand",
  "accent",
];

const PERSON_KEYS = ["name", "title", "email", "phone"];

/** Identity helper that gives a consumer's plain object its types. */
export function defineBrandPack(config) {
  return config;
}

export function validateBrandPackConfig(config) {
  const findings = [];
  const err = (code, message) => findings.push({ severity: "error", code, message });

  if (!config || typeof config !== "object") {
    err("brand-pack-invalid", `${BRAND_PACK_FILENAME} does not export a config object`);
    return findings;
  }

  const people = Array.isArray(config.people) ? config.people : [];

  for (const [i, person] of people.entries()) {
    const who =
      typeof person?.name === "string" && person.name.trim() ? person.name : `person ${i + 1}`;
    for (const key of PERSON_KEYS) {
      if (isUnfilled(person?.[key])) {
        err("brand-pack-placeholder", `${who}: "${key}" is unfilled`);
      }
    }
  }

  for (const key of TOKEN_KEYS) {
    if (isUnfilled(config[key])) {
      err("brand-pack-placeholder", `Brand token "${key}" is unfilled`);
    }
  }

  if (!SHARE_CARD_IDS.includes(config.shareCard)) {
    err(
      "brand-pack-unpicked",
      `shareCard is "${config.shareCard}", which is not one of: ${SHARE_CARD_IDS.join(", ")}`,
    );
  }

  if (people.length === 0) {
    err("brand-pack-no-people", "people is empty, so the signature board has nobody on it");
  }

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && value.includes(EM_DASH)) {
      err("brand-pack-em-dash", `"${key}" contains an em dash`);
    }
  }

  return findings;
}

export async function loadBrandPackConfig(siteDir) {
  const path = join(siteDir, BRAND_PACK_FILENAME);
  if (!existsSync(path)) {
    throw new Error(`No ${BRAND_PACK_FILENAME} found in ${siteDir}`);
  }
  const mod = await import(pathToFileURL(resolve(path)).href);
  return mod.default ?? mod.config ?? {};
}
