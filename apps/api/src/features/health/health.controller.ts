import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { HealthService } from "./health.service";

@Controller("api/v1/health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("live")
  @AllowAnonymous()
  liveness() {
    return this.health.liveness();
  }

  @Get()
  @AllowAnonymous()
  async readiness() {
    const result = await this.health.readiness();
    if (result.status !== "ok") {
      throw new ServiceUnavailableException({
        code: "SERVICE_NOT_READY",
        message: "One or more required dependencies are unavailable.",
        details: result,
      });
    }
    return result;
  }
}
