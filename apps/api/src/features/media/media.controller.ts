import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  completeUploadSchema,
  createUploadSchema,
  idSchema,
} from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { MediaService } from "./media.service";

@Controller("api/v1/media")
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Post("uploads")
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(createUploadSchema))
    body: z.infer<typeof createUploadSchema>,
  ) {
    return this.service.create(session.user.id, body);
  }

  @Post("uploads/complete")
  complete(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(completeUploadSchema))
    body: z.infer<typeof completeUploadSchema>,
  ) {
    return this.service.complete(session.user.id, body.assetId, body.etag);
  }

  @Get(":id/download")
  download(
    @Session() session: UserSession,
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
  ) {
    return this.service.download(session.user.id, session.session.id, id);
  }

  @Get("uploads/:id")
  status(
    @Session() session: UserSession,
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
  ) {
    return this.service.status(session.user.id, id);
  }
}
