import { draftTable } from "../copy";
import type { GuideModel } from "../model";

/**
 * The drafts preview's side-by-side table: each held line beside the live
 * wording it replaces, by approval section. Only for the `/drafts` preview
 * route, which a production build never has.
 */
export function DraftsTable({ model }: { model: GuideModel }) {
  const rows = draftTable(model);
  return (
    <section className="gg-drafts" aria-labelledby="gg-drafts-h">
      <h2 id="gg-drafts-h">
        Held lines for {model.name}: {rows.length}
      </h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Section</th>
            <th scope="col">Held</th>
            <th scope="col">Live today</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity beyond their order
            <tr key={i}>
              <td>{r.section}</td>
              <td>{r.held}</td>
              <td>{r.live}</td>
              <td>{r.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
