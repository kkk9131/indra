import type {
  Session,
  SessionManager,
  TranscriptManager,
  TranscriptMessage,
  TranscriptMessageContent,
} from "../../../platform/infra/index.js";

export interface SessionWithPreview extends Session {
  lastMessage?: string;
  messageCount?: number;
}

export interface SessionService {
  list: (type?: "cli" | "web") => SessionWithPreview[];
  get: (id: string) => Session | null;
  create: (title?: string) => Session;
  delete: (id: string) => boolean;
  updateTitle: (id: string, title: string) => void;
  getHistory: (
    sessionId: string,
    limit?: number,
  ) => { messages: TranscriptMessage[] };
  appendMessage: (sessionId: string, msg: TranscriptMessageContent) => string;
  updateTokenUsage: (
    sessionId: string,
    usage: { input: number; output: number; total: number },
  ) => void;
  getOrCreateSession: (
    sessionId: string | undefined,
    type: "cli" | "web",
  ) => Session;
}

interface SessionServiceDeps {
  sessionManager: SessionManager;
  transcriptManager: TranscriptManager;
}

export function createSessionService(deps: SessionServiceDeps): SessionService {
  const { sessionManager, transcriptManager } = deps;

  return {
    list: (type) => {
      const sessions = sessionManager.list(type);
      return sessions.map((session) => {
        const preview: SessionWithPreview = { ...session };

        if (session.transcriptFile) {
          const { messages } = transcriptManager.read(session.id);
          preview.messageCount = messages.length;

          // Get last assistant message as preview
          const lastAssistantMsg = [...messages]
            .reverse()
            .find((m) => m.message.role === "assistant");
          if (lastAssistantMsg) {
            const content = lastAssistantMsg.message.content as unknown;
            if (Array.isArray(content)) {
              for (const c of content) {
                if (
                  typeof c === "object" &&
                  c !== null &&
                  "type" in c &&
                  (c as { type: string }).type === "text" &&
                  "text" in c
                ) {
                  const text = (c as { text: string }).text;
                  preview.lastMessage = text.slice(0, 100);
                  break;
                }
              }
            } else if (typeof content === "string") {
              preview.lastMessage = (content as string).slice(0, 100);
            }
          }
        }

        return preview;
      });
    },

    get: (id) => sessionManager.get(id),

    create: (title) => {
      const session = sessionManager.create("web", { title });
      const transcriptFile = transcriptManager.getPath(session.id);
      transcriptManager.create(session.id);
      sessionManager.updateTranscriptFile(session.id, transcriptFile);
      return sessionManager.get(session.id)!;
    },

    delete: (id) => {
      transcriptManager.delete(id);
      return sessionManager.delete(id);
    },

    updateTitle: (id, title) => {
      sessionManager.updateTitle(id, title);
    },

    getHistory: (sessionId, limit) => {
      const { messages } = transcriptManager.read(sessionId, limit);
      return { messages };
    },

    appendMessage: (sessionId, msg) => {
      // Ensure transcript exists
      if (!transcriptManager.exists(sessionId)) {
        transcriptManager.create(sessionId);
        const transcriptFile = transcriptManager.getPath(sessionId);
        sessionManager.updateTranscriptFile(sessionId, transcriptFile);
      }

      return transcriptManager.append(sessionId, msg);
    },

    updateTokenUsage: (sessionId, usage) => {
      sessionManager.updateTokenUsage(sessionId, usage);
    },

    getOrCreateSession: (sessionId, type) => {
      if (sessionId) {
        const existing = sessionManager.get(sessionId);
        if (existing) {
          sessionManager.updateLastSeen(sessionId);
          return existing;
        }
      }

      // Create new session with transcript
      const session = sessionManager.create(type);
      const transcriptFile = transcriptManager.getPath(session.id);
      transcriptManager.create(session.id);
      sessionManager.updateTranscriptFile(session.id, transcriptFile);
      return sessionManager.get(session.id)!;
    },
  };
}
