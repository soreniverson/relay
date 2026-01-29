import { router } from "../lib/trpc";
import { authRouter } from "./auth";
import { ingestRouter } from "./ingest";
import { interactionsRouter } from "./interactions";
import { feedbackRouter } from "./feedback";
import { roadmapRouter } from "./roadmap";
import { surveysRouter } from "./surveys";
import { conversationsRouter } from "./conversations";
import { integrationsRouter } from "./integrations";
import { privacyRouter } from "./privacy";
import { knowledgeRouter } from "./knowledge";
import { botRouter } from "./bot";
import { workflowsRouter } from "./workflows";
import { toursRouter } from "./tours";
import { checklistsRouter } from "./checklists";
import { announcementsRouter } from "./announcements";
import { webhooksRouter } from "./webhooks";
import { campaignsRouter } from "./campaigns";

export const appRouter = router({
  auth: authRouter,
  ingest: ingestRouter,
  interactions: interactionsRouter,
  feedback: feedbackRouter,
  roadmap: roadmapRouter,
  surveys: surveysRouter,
  conversations: conversationsRouter,
  integrations: integrationsRouter,
  privacy: privacyRouter,
  knowledge: knowledgeRouter,
  bot: botRouter,
  workflows: workflowsRouter,
  tours: toursRouter,
  checklists: checklistsRouter,
  announcements: announcementsRouter,
  webhooks: webhooksRouter,
  campaigns: campaignsRouter,
});

export type AppRouter = typeof appRouter;
