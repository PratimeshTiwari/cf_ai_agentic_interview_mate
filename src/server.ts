import { routeAgentRequest } from "agents";
import { handleSpeak } from "./lib/speech";

export { InterviewAgent } from "./agents/interview";
export { UserAgent } from "./agents/user";
export { InterviewReportWorkflow } from "./workflows/report";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/speak") return handleSpeak(request, env);

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
