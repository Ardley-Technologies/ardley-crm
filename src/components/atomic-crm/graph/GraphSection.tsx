import type { ReactNode } from "react";

/**
 * A titled section of a graph show page that says "None" instead of leaving a
 * heading over nothing. Several sections are legitimately empty in the demo data
 * -- a borrower has no affiliations, a hand-seeded contact has no identifiers --
 * and a bare heading reads as a rendering fault rather than as an absence.
 */
export function GraphSection({
  title,
  isEmpty,
  children,
}: {
  title: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-medium mb-2">{title}</h2>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        children
      )}
    </section>
  );
}
