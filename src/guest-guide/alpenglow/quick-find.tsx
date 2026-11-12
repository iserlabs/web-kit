import type { Plan } from "../plan";
import { CopyButton } from "./blocks";

/** The numbered index on the arrival field: each row jumps straight to its answer (no smooth scroll). */
export function QuickFind({ quickFind }: { quickFind: Plan["quickFind"] }) {
  if (quickFind.rows.length === 0) return null;
  return (
    <section className="find" id="find" aria-labelledby="find-h">
      <h2 className="find__h" id="find-h">
        {quickFind.head.text}
      </h2>
      <ol className="find__list" role="list">
        {quickFind.rows.map((r) => (
          <li className="find__item" key={r.ref}>
            <span className="find__n" aria-hidden="true">
              {r.n}
            </span>
            <div>
              <h3 className="find__q">
                <a href={r.href}>{r.question}</a>
              </h3>
              {r.wifi ? (
                <>
                  {r.question.includes(r.wifi.network) ? null : (
                    <p className="find__a">
                      <span className="fig">{r.wifi.network}</span>
                    </p>
                  )}
                  <div className="find__wifi">
                    <p className="find__a">
                      {r.wifi.label} <span className="fig">{r.wifi.password}</span>
                    </p>
                    <CopyButton text={r.wifi.password} label={r.wifi.copy} />
                  </div>
                </>
              ) : r.answer ? (
                <p className="find__a">{r.answer}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
