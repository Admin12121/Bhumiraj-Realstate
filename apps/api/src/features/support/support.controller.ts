import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  OptionalAuth,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import type { z } from "zod";
import {
  ANONYMOUS_THREAD_TTL_MINUTES,
  assignSupportThreadSchema,
  idSchema,
  sendSupportMessageSchema,
  supportThreadQuerySchema,
} from "@real-estate/contracts";
import {
  StaffPermissions,
} from "../../shared/auth/staff-permissions.decorator";
import { StaffPermissionsGuard } from "../../shared/auth/staff-permissions.guard";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ADMIN_PERMISSIONS } from "../admin/admin.permissions";
import { SupportService } from "./support.service";
import { SupportPresenceService } from "./support-presence.service";

const VISITOR_COOKIE = "bhumiraj_support";
/** Comfortably longer than the message TTL, so a returning visitor is not
 *  handed a new thread while their old one is still alive. */
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Read one cookie straight from the header. The app does not use cookie-parser,
 * and pulling in a dependency for a single lookup is not worth it.
 */
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim()) || null;
  }
  return null;
}

/** Visitor-facing general enquiry chat. Works signed out. */
@Controller("api/v1/support")
export class SupportController {
  constructor(private readonly service: SupportService) {}

  /**
   * Anonymous identity is an opaque first-party cookie, never a device
   * fingerprint: IP and user-agent collide behind shared networks, which would
   * put unrelated visitors into one another's conversation.
   */
  private visitorKey(request: Request, response: Response): string {
    const existing = readCookie(request.headers.cookie, VISITOR_COOKIE);
    if (existing) return existing;

    const key = this.service.createVisitorKey();
    response.cookie(VISITOR_COOKIE, key, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.secure,
      maxAge: COOKIE_MAX_AGE_MS,
      path: "/",
    });
    return key;
  }

  @Get("thread")
  @OptionalAuth()
  async thread(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Session() session?: UserSession,
  ) {
    const key = this.visitorKey(request, response);
    const thread = await this.service.getThread(key, session?.user.id);
    return {
      thread,
      ttlMinutes: session ? null : ANONYMOUS_THREAD_TTL_MINUTES,
    };
  }

  @Post("messages")
  @OptionalAuth()
  send(
    @Body(new ZodValidationPipe(sendSupportMessageSchema))
    body: z.infer<typeof sendSupportMessageSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Session() session?: UserSession,
  ) {
    const key = this.visitorKey(request, response);
    return this.service.sendVisitorMessage(
      key,
      body.body,
      session?.user.id,
      body.attachmentId,
    );
  }
}

/** Staff-facing support inbox. */
@Controller("api/v1/admin/support")
@UseGuards(StaffPermissionsGuard)
export class AdminSupportController {
  constructor(
    private readonly service: SupportService,
    private readonly presenceService: SupportPresenceService,
  ) {}

  @Get("threads")
  @StaffPermissions(ADMIN_PERMISSIONS.SUPPORT_READ)
  list(
    @Query(new ZodValidationPipe(supportThreadQuerySchema))
    query: z.infer<typeof supportThreadQuerySchema>,
    @Session() session: UserSession,
  ) {
    return this.service.listThreads(query, session.user.id);
  }

  @Get("threads/:id")
  @StaffPermissions(ADMIN_PERMISSIONS.SUPPORT_READ)
  detail(@Param("id", new ZodValidationPipe(idSchema)) id: string) {
    return this.service.staffThread(id);
  }

  @Post("threads/:id/messages")
  @StaffPermissions(ADMIN_PERMISSIONS.SUPPORT_REPLY)
  reply(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(sendSupportMessageSchema))
    body: z.infer<typeof sendSupportMessageSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.sendStaffMessage(id, body.body, session.user.id);
  }

  @Post("threads/:id/assign")
  @StaffPermissions(ADMIN_PERMISSIONS.SUPPORT_REPLY)
  assign(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(assignSupportThreadSchema))
    body: z.infer<typeof assignSupportThreadSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.assign(id, body.assigneeId, session.user.id);
  }

  @Post("threads/:id/close")
  @StaffPermissions(ADMIN_PERMISSIONS.SUPPORT_REPLY)
  close(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
  ) {
    return this.service.close(id, session.user.id);
  }

  /**
   * Announces that this staff member has the thread open and returns everyone
   * else who does. Polled while the thread is on screen, so two staff can see
   * each other before they both start typing.
   */
  @Post("threads/:id/presence")
  @StaffPermissions(ADMIN_PERMISSIONS.SUPPORT_READ)
  async presence(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
  ) {
    await this.presenceService.join(id, session.user.id);
    return { viewers: await this.presenceService.viewers(id) };
  }

  @Delete("threads/:id/presence")
  @StaffPermissions(ADMIN_PERMISSIONS.SUPPORT_READ)
  async leave(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
  ) {
    await this.presenceService.leave(id, session.user.id);
    return { left: true };
  }
}
