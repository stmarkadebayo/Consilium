import { getSupabaseAccessToken, isSupabaseConfigured } from "@/lib/supabase";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type RequestOptions = RequestInit & {
  bodyJson?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { bodyJson, headers, ...rest } = options;
  const accessToken = await getSupabaseAccessToken();
  const finalHeaders = new Headers(headers ?? undefined);
  finalHeaders.set("Content-Type", "application/json");
  if (accessToken && isSupabaseConfigured()) {
    finalHeaders.set("Authorization", `Bearer ${accessToken}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: bodyJson === undefined ? undefined : JSON.stringify(bodyJson),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload?.detail === "string") {
        message = payload.detail;
      } else if (typeof payload?.error?.message === "string") {
        message = payload.error.message;
      }
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export type User = {
  id: string;
  email: string;
  display_name: string | null;
  onboarding_done: boolean;
  created_at: string;
};

export type CouncilMember = {
  id: string;
  persona_id: string;
  display_name: string;
  persona_type: "real_person" | "custom";
  position: number;
  is_active: boolean;
};

export type Council = {
  id: string;
  name: string;
  min_personas: number;
  max_personas: number;
  created_at: string;
  updated_at: string;
  members: CouncilMember[];
};

export type Persona = {
  id: string;
  display_name: string;
  persona_type: "real_person" | "custom";
  identity_summary: string | null;
  worldview: string[];
  communication_style: string[];
  decision_style: string[];
  values: string[];
  blind_spots: string[];
  domain_confidence: Record<string, number>;
  source_count: number;
  source_quality_score: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type PersonaSource = {
  id: string;
  url: string;
  title: string | null;
  source_type: string;
  publisher: string | null;
  quality_score: number | null;
  is_primary: boolean;
  notes_excerpt: string | null;
  chunk_count: number;
};

export type PersonaDraft = {
  id: string;
  job_id: string | null;
  input_name: string;
  persona_type: "real_person" | "custom";
  review_status: string;
  draft_profile: {
    display_name: string;
    identity_summary?: string;
    worldview?: string[];
    communication_style?: string[];
    decision_style?: string[];
    values?: string[];
    blind_spots?: string[];
    domain_confidence?: Record<string, number>;
    source_count?: number;
    source_quality_score?: number | null;
    warnings?: string[];
  };
  sources: PersonaSource[];
  created_at: string;
  updated_at: string;
};

export type UpdatePersonaDraftInput = {
  draft_profile: Partial<PersonaDraft["draft_profile"]>;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export type PersonaResponse = {
  id: string;
  persona_name: string;
  response_type: "answer" | "inference" | "no_basis";
  verdict: string | null;
  reasoning: string | null;
  recommended_action: string | null;
  confidence: number | null;
  status: string;
  latency_ms: number | null;
  evidence_snippets: Array<{
    chunk_text: string;
    source_id: string;
    source_title: string | null;
    source_url: string;
    source_type: string;
    quality_score: number | null;
    is_primary: boolean;
    score: number;
  }>;
};

export type Synthesis = {
  id: string;
  agreements: string[];
  disagreements: string[];
  next_step: string | null;
  combined_recommendation: string | null;
  created_at: string;
};

export type ConversationTurn = {
  user_message: {
    id: string;
    content: string;
    created_at: string;
  };
  persona_responses: PersonaResponse[];
  synthesis: Synthesis | null;
};

export type Conversation = {
  id: string;
  title: string | null;
  turns: ConversationTurn[];
};

export type Job = {
  id: string;
  job_type: string;
  status: string;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type CreatePersonaInput = {
  display_name: string;
  persona_type: "real_person" | "custom";
  identity_summary?: string;
  worldview?: string[];
  communication_style?: string[];
  decision_style?: string[];
  values?: string[];
  blind_spots?: string[];
  domain_confidence?: Record<string, number>;
  source_count?: number;
  source_quality_score?: number | null;
  add_to_council?: boolean;
};

export type CreatePersonaDraftInput = {
  input_name: string;
  persona_type: "real_person" | "custom";
  custom_brief?: string;
};

export type CreatePersonaSourceInput = {
  url: string;
  title?: string;
  source_type: string;
  publisher?: string;
  quality_score?: number | null;
  is_primary?: boolean;
  content?: string;
};

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

const mockPersonas: Persona[] = [];
const mockConversations: ConversationSummary[] = [];
const mockCouncil: Council = {
  id: "c1",
  name: "My Council",
  min_personas: 3,
  max_personas: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  members: [],
};

function cloneCouncil(council: Council): Council {
  return {
    ...council,
    members: council.members.map((member) => ({ ...member })),
  };
}

function clonePersonas(personas: Persona[]): Persona[] {
  return personas.map((persona) => ({
    ...persona,
    worldview: [...persona.worldview],
    communication_style: [...persona.communication_style],
    decision_style: [...persona.decision_style],
    values: [...persona.values],
    blind_spots: [...persona.blind_spots],
    domain_confidence: { ...persona.domain_confidence },
  }));
}

function cloneConversations(conversations: ConversationSummary[]): ConversationSummary[] {
  return conversations.map((conversation) => ({ ...conversation }));
}

export const api = {
  getMe: async () => {
    if (USE_MOCK) {
      return {
        id: "u1",
        email: "demo@consilium.com",
        display_name: "Demo User",
        onboarding_done: true,
        created_at: new Date().toISOString(),
      };
    }
    return request<User>("/me");
  },
  getCouncil: async () => {
    if (USE_MOCK) return cloneCouncil(mockCouncil);
    return request<Council>("/council");
  },
  updateCouncil: async (name: string) => {
    if (USE_MOCK) {
      mockCouncil.name = name;
      return cloneCouncil(mockCouncil);
    }
    return request<Council>("/council", { method: "PATCH", bodyJson: { name } });
  },
  listPersonas: async () => {
    if (USE_MOCK) return clonePersonas(mockPersonas);
    return (await request<{ personas: Persona[] }>("/personas")).personas;
  },
  createPersona: async (payload: CreatePersonaInput) => {
    if (USE_MOCK) {
      const p: Persona = {
        id: `p_${Date.now()}`,
        display_name: payload.display_name,
        persona_type: payload.persona_type,
        identity_summary: payload.identity_summary || null,
        worldview: payload.worldview || [],
        communication_style: payload.communication_style || [],
        decision_style: payload.decision_style || [],
        values: payload.values || [],
        blind_spots: payload.blind_spots || [],
        domain_confidence: payload.domain_confidence || {},
        source_count: payload.source_count || 0,
        source_quality_score: payload.source_quality_score || 0,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (payload.add_to_council) {
        mockCouncil.members.push({
          id: `cm_${Date.now()}`,
          persona_id: p.id,
          display_name: p.display_name,
          persona_type: p.persona_type,
          position: mockCouncil.members.length,
          is_active: true
        });
      }
      mockPersonas.push(p);
      return { ...p };
    }
    return request<Persona>("/personas", { method: "POST", bodyJson: payload });
  },
  createPersonaDraft: (payload: CreatePersonaDraftInput) =>
    request<PersonaDraft>("/personas/drafts", { method: "POST", bodyJson: payload }),
  getPersonaDraft: (draftId: string) =>
    request<PersonaDraft>(`/personas/drafts/${draftId}`),
  updatePersonaDraft: (draftId: string, payload: UpdatePersonaDraftInput) =>
    request<PersonaDraft>(`/personas/drafts/${draftId}`, { method: "PATCH", bodyJson: payload }),
  addDraftSource: (draftId: string, payload: CreatePersonaSourceInput) =>
    request<PersonaSource>(`/personas/drafts/${draftId}/sources`, { method: "POST", bodyJson: payload }),
  approvePersonaDraft: (draftId: string) =>
    request<{ persona_id: string; council_member_id: string | null }>(`/personas/drafts/${draftId}/approve`, {
      method: "POST",
    }),
  deactivatePersona: async (personaId: string) => {
    if (USE_MOCK) {
      const persona = mockPersonas.find((item) => item.id === personaId);
      if (!persona) {
        throw new Error("Persona not found");
      }
      const member = mockCouncil.members.find((item) => item.persona_id === personaId);
      if (member) {
        member.is_active = !member.is_active;
        persona.status = member.is_active ? "active" : "inactive";
      } else {
        mockCouncil.members.push({
          id: `cm_${Date.now()}`,
          persona_id: persona.id,
          display_name: persona.display_name,
          persona_type: persona.persona_type,
          position: mockCouncil.members.length,
          is_active: true,
        });
        persona.status = "active";
      }
      return { ...persona };
    }
    return request<Persona>(`/personas/${personaId}/deactivate`, { method: "POST" });
  },
  listPersonaSources: async (personaId: string) => {
    if (USE_MOCK) return [];
    return (await request<{ sources: PersonaSource[] }>(`/personas/${personaId}/sources`)).sources;
  },
  addPersonaSource: (personaId: string, payload: CreatePersonaSourceInput) =>
    request<PersonaSource>(`/personas/${personaId}/sources`, { method: "POST", bodyJson: payload }),
  listConversations: async () => {
    if (USE_MOCK) return cloneConversations(mockConversations);
    return (await request<{ conversations: ConversationSummary[]; next_cursor: string | null }>("/conversations")).conversations;
  },
  createConversation: async (title?: string) => {
    if (USE_MOCK) {
      const c: ConversationSummary = {
        id: `c_${Date.now()}`,
        title: title || "New Debate",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0
      };
      mockConversations.push(c);
      return { ...c };
    }
    return request<ConversationSummary>("/conversations", {
      method: "POST",
      bodyJson: { title: title || null },
    });
  },
  getConversation: async (conversationId: string) => {
    if (USE_MOCK) {
      return { id: conversationId, title: "Mock Debate", turns: [] };
    }
    return request<Conversation>(`/conversations/${conversationId}`);
  },
  submitMessage: (conversationId: string, content: string) =>
    request<{ message_id: string; job_id: string }>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      bodyJson: { content },
    }),
  getJob: (jobId: string) => request<Job>(`/jobs/${jobId}`),
  retryJob: (jobId: string) => request<Job>(`/jobs/${jobId}/retry`, { method: "POST" }),
};

export async function pollJobUntilSettled(jobId: string, timeoutMs = 30000): Promise<Job> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await api.getJob(jobId);
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return job;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 400));
  }

  throw new Error("Job timed out before completion");
}
