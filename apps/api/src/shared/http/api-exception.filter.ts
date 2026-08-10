import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ApiErrorPayload {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

type DatabaseErrorLike = {
  code?: unknown;
  meta?: unknown;
};

function databaseHttpError(error: unknown):
  | { status: number; payload: ApiErrorPayload }
  | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as DatabaseErrorLike).code;
  if (typeof code !== "string") return undefined;

  if (code === "P2002") {
    return {
      status: HttpStatus.CONFLICT,
      payload: {
        code: "RESOURCE_CONFLICT",
        message: "The requested resource conflicts with an existing record.",
      },
    };
  }
  if (code === "P2025") {
    return {
      status: HttpStatus.NOT_FOUND,
      payload: {
        code: "RESOURCE_NOT_FOUND",
        message: "The requested resource was not found.",
      },
    };
  }
  if (code === "P2034" || code === "40001" || code === "40P01") {
    return {
      status: HttpStatus.CONFLICT,
      payload: {
        code: "TRANSACTION_CONFLICT",
        message: "The operation conflicted with another update. Please retry.",
      },
    };
  }
  return undefined;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: ApiErrorPayload = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const raw = exception.getResponse();
      payload =
        typeof raw === "string" ? { message: raw } : (raw as ApiErrorPayload);
    } else {
      const mapped = databaseHttpError(exception);
      if (mapped) {
        status = mapped.status;
        payload = mapped.payload;
      } else {
        const stack =
          exception instanceof Error ? exception.stack : String(exception);
        this.logger.error(
          `Unhandled request failure ${request.method} ${request.originalUrl} requestId=${request.requestId ?? "unknown"}`,
          stack,
        );
      }
    }

    const safeMessage =
      status >= 500
        ? "The service could not complete the request."
        : Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message ?? "The request could not be completed.";

    response.status(status).json({
      statusCode: status,
      code:
        payload.code ??
        (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
      message: safeMessage,
      ...(status < 500 && payload.details !== undefined
        ? { details: payload.details }
        : {}),
      requestId: request.requestId,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
