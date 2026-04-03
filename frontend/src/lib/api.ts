export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, options: RequestInit & { bodyJson?: unknown } = {}): Promise<T> {
  const { bodyJson, headers, ...rest } = options;
  const finalHeaders = new Headers(headers ?? undefined);
  finalHeaders.set("Content-Type", "application/json");

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
      if (typeof payload?.detail === "string") message = payload.detail;
    } catch {}
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function deletePersonaRequest(id: string): Promise<void> {
  try {
    await request<void>(`/personas/${id}/delete`, { method: "POST" });
    return;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("404") && !message.includes("405")) {
      throw error;
    }
  }

  await request<void>(`/personas/${id}`, { method: "DELETE" });
}

// ===== Types =====

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
  persona_type: string;
  position: number;
  is_active: boolean;
  identity_summary: string | null;
  status: string;
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
  persona_type: string;
  identity_summary: string | null;
  domains: string[];
  core_beliefs: string[];
  priorities: string[];
  anti_values: string[];
  decision_patterns: string[];
  communication_style: Record<string, string>;
  style_markers: string[];
  abstention_rules: string[];
  confidence_by_topic: Record<string, number>;
  source_count: number;
  source_quality_score: number | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

export type PersonaProfile = {
  display_name?: string;
  identity_summary?: string | null;
  domains?: string[];
  core_beliefs?: string[];
  priorities?: string[];
  anti_values?: string[];
  decision_patterns?: string[];
  communication_style?: {
    tone?: string;
    sentence_shape?: string;
    emotional_temperature?: string;
    metaphor_use?: string;
    wit_level?: string;
    rhetorical_rhythm?: string;
    [key: string]: string | undefined;
  };
  style_markers?: string[];
  abstention_rules?: string[];
  confidence_by_topic?: Record<string, number>;
  source_quality_note?: string;
  generated_prompt?: string;
  [key: string]: unknown;
};

export type PersonaDraft = {
  id: string;
  input_name: string;
  persona_type: string;
  custom_brief: string | null;
  review_status: string;
  draft_profile: PersonaProfile;
  job_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonaDraftRevision = {
  id: string;
  revision_kind: string;
  instruction: string | null;
  profile: PersonaProfile;
  created_at: string;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  message_count: number;
};

export type PersonaMessage = {
  id: string;
  persona_name: string;
  content: string;
  answer_mode: string | null;
  confidence: number | null;
  stance: string | null;
  latency_ms: number | null;
  status: string;
};

export type Synthesis = {
  id: string;
  agreements: string[];
  disagreements: string[];
  next_step: string | null;
  combined_recommendation: string | null;
  created_at: string | null;
};

export type ConversationTurn = {
  turn_number: number;
  user_message: {
    id: string;
    content: string;
    created_at: string | null;
  } | null;
  persona_responses: PersonaMessage[];
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

export type StartConsultResponse = {
  conversation_id: string;
  message_id: string;
  job_id: string;
};

// ===== API =====

export const api = {
  // Auth
  getMe: () => request<User>("/me"),

  // Council
  getCouncil: () => request<Council>("/council"),
  updateCouncil: (name: string) =>
    request<Council>("/council", { method: "PATCH", bodyJson: { name } }),
  updateCouncilMember: (
    memberId: string,
    payload: { is_active?: boolean; position?: number }
  ) => request<Council>(`/council/members/${memberId}`, { method: "PATCH", bodyJson: payload }),

  // Personas
  listPersonas: async () =>
    (await request<{ personas: Persona[] }>("/personas")).personas,
  getPersona: (id: string) => request<Persona>(`/personas/${id}`),
  deletePersona: (id: string) => deletePersonaRequest(id),
  deactivatePersona: (id: string) =>
    request<Persona>(`/personas/${id}/deactivate`, { method: "POST" }),
  activatePersona: (id: string) =>
    request<Persona>(`/personas/${id}/activate`, { method: "POST" }),

  // Drafts
  createDraft: (payload: { input_name: string; persona_type: string; custom_brief?: string }) =>
    request<PersonaDraft>("/personas/drafts", { method: "POST", bodyJson: payload }),
  getDraft: (id: string) => request<PersonaDraft>(`/personas/drafts/${id}`),
  updateDraft: (id: string, draft_profile: Record<string, unknown>) =>
    request<PersonaDraft>(`/personas/drafts/${id}`, {
      method: "PATCH",
      bodyJson: { draft_profile },
    }),
  reviseDraft: (id: string, instruction: string) =>
    request<PersonaDraft>(`/personas/drafts/${id}/revise`, {
      method: "POST",
      bodyJson: { instruction },
    }),
  listDraftRevisions: (id: string) =>
    request<PersonaDraftRevision[]>(`/personas/drafts/${id}/revisions`),
  restoreDraftRevision: (id: string, revisionId: string) =>
    request<PersonaDraft>(`/personas/drafts/${id}/revisions/${revisionId}/restore`, {
      method: "POST",
    }),
  approveDraft: (id: string) =>
    request<{ persona_id: string; council_member_id: string | null }>(
      `/personas/drafts/${id}/approve`,
      { method: "POST" }
    ),

  // Conversations
  listConversations: async () =>
    (await request<{ conversations: ConversationSummary[] }>("/conversations")).conversations,
  createConversation: (title?: string) =>
    request<ConversationSummary>("/conversations", {
      method: "POST",
      bodyJson: { title: title || null },
    }),
  startConsult: (content: string) =>
    request<StartConsultResponse>("/conversations/consult", {
      method: "POST",
      bodyJson: { content },
    }),
  getConversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  submitMessage: (conversationId: string, content: string) =>
    request<{ message_id: string; job_id: string }>(
      `/conversations/${conversationId}/messages`,
      { method: "POST", bodyJson: { content } }
    ),

  // Jobs
  getJob: (id: string) => request<Job>(`/jobs/${id}`),
  retryJob: (id: string) => request<Job>(`/jobs/${id}/retry`, { method: "POST" }),
};

// ===== Helpers =====

export async function pollJobUntilSettled(jobId: string, timeoutMs = 60000): Promise<Job> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = await api.getJob(jobId);
    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return job;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Job timed out");
}
