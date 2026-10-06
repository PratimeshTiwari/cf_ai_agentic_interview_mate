import { routeAgentRequest } from "agents";

export { InterviewAgent } from "./agents/interview";
export { UserAgent } from "./agents/user";
export { InterviewReportWorkflow } from "./workflows/report";

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
