type QueryFilters = Record<string, unknown> | undefined;

export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  companies: {
    all: ["companies"] as const,
    list: (filters?: QueryFilters) => ["companies", "list", filters ?? {}] as const,
    detail: (id: string) => ["companies", "detail", id] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: (filters?: QueryFilters) => ["contacts", "list", filters ?? {}] as const,
    detail: (id: string) => ["contacts", "detail", id] as const,
  },
  segments: {
    all: ["segments"] as const,
  },
  owners: {
    all: ["owners"] as const,
  },
  prospection: {
    assignments: ["prospection", "assignments"] as const,
    session: (companyIds: string[]) => ["prospection", "session", companyIds] as const,
  },
  kpi: {
    all: ["kpi"] as const,
    period: (period: string) => ["kpi", "period", period] as const,
    view: (view: string) => ["kpi", "view", view] as const,
  },
  pipeline: {
    all: ["pipeline"] as const,
  },
  agenda: {
    all: ["agenda"] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (filters?: QueryFilters) => ["tasks", "list", filters ?? {}] as const,
  },
} as const;
