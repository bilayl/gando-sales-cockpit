type Filters = Record<string, unknown> | undefined;

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  segments: {
    all: ["segments"] as const,
  },
  owners: {
    all: ["owners"] as const,
  },
  companies: {
    all: ["companies"] as const,
    list: (filters?: Filters) => ["companies", "list", filters ?? {}] as const,
    detail: (id: string) => ["companies", "detail", id] as const,
    centralized: (id: string) => ["companies", "centralized", id] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: (filters?: Filters) => ["contacts", "list", filters ?? {}] as const,
    detail: (id: string) => ["contacts", "detail", id] as const,
  },
  prospection: {
    assignments: ["prospection", "assignments"] as const,
    session: (companyIds: string[]) => ["prospection", "session", companyIds] as const,
  },
  agenda: {
    range: (start: string, end: string) => ["agenda", start, end] as const,
  },
  pipeline: {
    all: ["pipeline"] as const,
    deals: ["pipeline", "deals"] as const,
    rooms: ["pipeline", "rooms"] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (filters?: Filters) => ["tasks", "list", filters ?? {}] as const,
  },
  kpi: {
    all: ["kpi"] as const,
    root: ["kpi", "root"] as const,
    endpoint: (name: string, params?: Filters) => ["kpi", name, params ?? {}] as const,
    period: (period: string) => ["kpi", "period", period] as const,
  },
} as const;
