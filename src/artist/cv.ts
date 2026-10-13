/**
 * The CV.
 *
 * Carole 10 makes this a primary destination and specifies the shape: education
 * near the top, exhibitions newest first, solo separated from group, entries kept
 * to year / title / venue / city. She adds that a self-taught or emerging artist
 * can list mentors, meaningful study and workshops in place of a degree.
 *
 * Carole 13 is the constraint that decides how this behaves: a stale or empty
 * section reads as an abandoned site and costs the artist the gallery. So every
 * section is OPTIONAL and a page renders only the ones with real entries. An empty
 * Awards heading is worse than no Awards heading.
 *
 * The site owns its CV and passes it in. Nothing here invents an entry, and
 * `cvGaps` names what is still missing so it never quietly stays empty.
 */

export interface CvEntry {
  year: string;
  title: string;
  venue?: string;
  location?: string;
  href?: string;
  note?: string;
}

export interface CvEducation {
  year?: string;
  what: string;
  where?: string;
}

export interface Cv {
  /** Carole 10: a degree, or the mentors and study that stand in for one. */
  education: CvEducation[];
  soloExhibitions: CvEntry[];
  groupExhibitions: CvEntry[];
  press: CvEntry[];
  awards: CvEntry[];
}

export interface CvSection {
  id: string;
  heading: string;
  entries: CvEntry[];
}

/** Only sections with entries, in Carole's order. Education is rendered by the page
    above these, since its entries have a different shape. */
export function cvSections(source: Cv): CvSection[] {
  return [
    { id: "solo", heading: "Solo Exhibitions", entries: source.soloExhibitions },
    { id: "group", heading: "Group Exhibitions", entries: source.groupExhibitions },
    { id: "press", heading: "Selected Press", entries: source.press },
    { id: "awards", heading: "Awards and Residencies", entries: source.awards },
  ].filter((s) => s.entries.length > 0);
}

/** Newest first, per Carole 10. Non-numeric years sort last rather than throwing. */
export function newestFirst(entries: readonly CvEntry[]): CvEntry[] {
  return [...entries].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
}

/** What the artist still owes this page. Surfaced so it cannot quietly stay empty. */
export function cvGaps(source: Cv): string[] {
  const gaps: string[] = [];
  if (!source.education.length) gaps.push("education, mentors or meaningful study");
  if (!source.soloExhibitions.length && !source.groupExhibitions.length) {
    gaps.push("exhibitions");
  }
  return gaps;
}

/** Carole 13: do not ship a destination with nothing on it. */
export function hasCvContent(source: Cv): boolean {
  return cvSections(source).length > 0 || source.education.length > 0;
}
