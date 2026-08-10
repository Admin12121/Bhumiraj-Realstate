import { ForbiddenException, Injectable } from "@nestjs/common";
@Injectable()
export class ResourcePolicyService {
 assertOwnerOrRole(resourceOwnerId: string, user: { id: string; role?: string }, roles = ["MODERATOR", "ADMIN", "SUPER_ADMIN"]) { if (resourceOwnerId !== user.id && !roles.includes(user.role ?? "")) throw new ForbiddenException({ code: "RESOURCE_FORBIDDEN", message: "This resource is not accessible to the current user" }); }
}
