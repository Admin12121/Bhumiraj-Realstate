import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  createConversationSchema,
  cursorSocialQuerySchema,
  idSchema,
  sendMessageSchema,
} from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { MessagingService } from "./messaging.service";

@Controller("api/v1/messages")
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  @Get("conversations")
  conversations(
    @Session() session: UserSession,
    @Query(new ZodValidationPipe(cursorSocialQuerySchema))
    query: z.infer<typeof cursorSocialQuerySchema>,
  ) {
    return this.service.conversations(session.user.id, query);
  }

  @Post("conversations")
  createConversation(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(createConversationSchema))
    body: z.infer<typeof createConversationSchema>,
  ) {
    return this.service.createConversation(session.user.id, body);
  }

  @Get("conversations/:id")
  messages(
    @Session() session: UserSession,
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Query(new ZodValidationPipe(cursorSocialQuerySchema))
    query: z.infer<typeof cursorSocialQuerySchema>,
  ) {
    return this.service.messages(session.user.id, id, query);
  }

  @Post("conversations/:id")
  send(
    @Session() session: UserSession,
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(sendMessageSchema))
    body: z.infer<typeof sendMessageSchema>,
  ) {
    return this.service.send(session.user.id, id, body);
  }

  @Patch("conversations/:id/read")
  markRead(
    @Session() session: UserSession,
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
  ) {
    return this.service.markRead(session.user.id, id);
  }
}
