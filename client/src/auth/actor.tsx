import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../data/api";

export type Role = "operations" | "compliance" | "treasury" | "checker" | "auditor" | "admin";
export type CurrentActor = { id: string; role: Role; organizationId: string };

/**
 * Mirrors the requireRole() gates in server/api.ts. This only hides buttons;
 * the server remains the authority and still rejects anything not allowed.
 */
export const actionRoles = {
  placeHold: ["operations", "compliance"],
  releaseHold: ["compliance", "checker"],
  validateJournal: ["treasury", "checker"],
  postJournal: ["treasury"],
  reverseJournal: ["treasury", "checker"]
} as const satisfies Record<string, readonly Role[]>;
export type Action = keyof typeof actionRoles;

export const roleLabels: Record<Role, string> = {
  operations: "Operations maker",
  compliance: "Compliance",
  treasury: "Treasury",
  checker: "Checker",
  auditor: "Auditor",
  admin: "Administrator"
};

type ActorState = { actor?: CurrentActor; error?: string; loading: boolean };
const ActorContext = createContext<ActorState>({ loading: true });

export function ActorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActorState>({ loading: true });
  useEffect(() => {
    let active = true;
    api<{ item: CurrentActor }>("/me")
      .then((data) => active && setState({ actor: data.item, loading: false }))
      .catch((error: Error) => active && setState({ error: error.message, loading: false }));
    return () => { active = false; };
  }, []);
  return <ActorContext.Provider value={state}>{children}</ActorContext.Provider>;
}

export function useActor(): ActorState {
  return useContext(ActorContext);
}

/** False while /api/me is loading or failed, so actions stay hidden unless the role is confirmed. */
export function useCan(action: Action): boolean {
  const { actor } = useActor();
  return !!actor && (actionRoles[action] as readonly Role[]).includes(actor.role);
}
