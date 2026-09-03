import { ShowBase, useShowContext } from "ra-core";
import { Link } from "react-router";

import { Card } from "@/components/ui/card";
import { GraphSection } from "./GraphSection";

interface GraphCompany {
  id: string;
  name: string;
  kind_id: string | null;
  parent: { id: string; name: string } | null;
  children: { id: string; name: string; kind_id: string | null }[];
  people: {
    contact_id: string;
    first_name: string;
    last_name: string;
    role: string | null;
  }[];
  referred_deals: {
    id: string;
    name: string;
    stage_label: string | null;
    agent_id: string;
    agent_name: string;
  }[];
}

export function GraphCompanyShow() {
  return (
    <ShowBase>
      <CompanyGraph />
    </ShowBase>
  );
}

function CompanyGraph() {
  const { record, isPending } = useShowContext<GraphCompany>();
  if (isPending || !record) return null;

  const children = record.children ?? [];
  const people = record.people ?? [];
  const referred = record.referred_deals ?? [];

  return (
    <Card className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{record.name}</h1>
      {record.kind_id ? (
        <p className="text-muted-foreground">{record.kind_id}</p>
      ) : null}

      <GraphSection title="Parent" isEmpty={!record.parent}>
        {record.parent ? (
          <Link
            className="underline"
            to={`/companies/${record.parent.id}/show`}
          >
            {record.parent.name}
          </Link>
        ) : null}
      </GraphSection>

      <GraphSection title="Children" isEmpty={children.length === 0}>
        <ul>
          {children.map((child) => (
            <li key={child.id}>
              <Link className="underline" to={`/companies/${child.id}/show`}>
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      </GraphSection>

      <GraphSection title="People" isEmpty={people.length === 0}>
        <ul>
          {people.map((person) => (
            <li key={person.contact_id}>
              <Link
                className="underline"
                to={`/contacts/${person.contact_id}/show`}
              >
                {person.first_name} {person.last_name}
              </Link>
              {person.role ? ` — ${person.role}` : ""}
            </li>
          ))}
        </ul>
      </GraphSection>

      <GraphSection title="Referred deals" isEmpty={referred.length === 0}>
        <ul>
          {referred.map((deal) => (
            <li key={deal.id}>
              <Link className="underline" to={`/deals/${deal.id}/show`}>
                {deal.name}
              </Link>
              {deal.stage_label ? ` · ${deal.stage_label}` : ""} — referred by{" "}
              <Link
                className="underline"
                to={`/contacts/${deal.agent_id}/show`}
              >
                {deal.agent_name}
              </Link>
            </li>
          ))}
        </ul>
      </GraphSection>
    </Card>
  );
}
