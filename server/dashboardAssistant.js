import { createAssistantService } from "./assistant.js";
import { createCodexAssistantService } from "./codexAssistant.js";

export const createDashboardAssistantService = ({
  codexService = createCodexAssistantService(),
  responsesService = createAssistantService(),
} = {}) => {
  if (codexService.configured) return codexService;
  if (responsesService.configured) {
    return {
      ...responsesService,
      provider: "openai",
      status: "configured",
    };
  }
  return {
    ...codexService,
    provider: "local",
    status: "local",
  };
};
