import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

function scope(access) {
  return tenantService.accessScope(access || {}, "clients");
}

function getClient(id, access) {
  const client = repositories.clients.getById(id, scope(access));
  if (!client) throw notFound("Client not found");
  return client;
}

function publicClient(client) {
  if (!client) return null;
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    tier: client.tier,
    primaryAccountId: client.primaryAccountId || "",
    relationship: client.relationship || "",
    consolidateCommunications: Number(client.consolidateCommunications || 0) === 1,
    consolidateLoyalty: Number(client.consolidateLoyalty || 0) === 1
  };
}

export const familyAccountService = {
  linkMember(primaryClientId, payload = {}, access) {
    const memberCustomerId = payload.memberCustomerId || payload.memberClientId || payload.clientId;
    const relationship = payload.relationship || "other";
    if (!memberCustomerId) throw badRequest("memberCustomerId is required");
    if (memberCustomerId === primaryClientId) throw badRequest("Primary and member cannot be same");
    const primary = getClient(primaryClientId, access);
    if (primary.primaryAccountId) throw conflict("Only the primary account can manage family links");
    const member = getClient(memberCustomerId, access);
    if (member.primaryAccountId && member.primaryAccountId !== primary.id) {
      throw conflict("Member is already linked to another family account");
    }
    const updated = repositories.clients.update(member.id, {
      primaryAccountId: primary.id,
      relationship,
      consolidateCommunications: Number(payload.consolidateCommunications || primary.consolidateCommunications || 0) ? 1 : 0,
      consolidateLoyalty: Number(payload.consolidateLoyalty || primary.consolidateLoyalty || 0) ? 1 : 0
    }, scope(access));
    return { primary: publicClient(primary), member: publicClient(updated) };
  },

  unlinkMember(primaryClientId, memberClientId, access) {
    const primary = getClient(primaryClientId, access);
    if (primary.primaryAccountId) throw conflict("Only the primary account can manage family links");
    const member = getClient(memberClientId, access);
    if (member.primaryAccountId !== primary.id) throw notFound("Family member link not found");
    const updated = repositories.clients.update(member.id, {
      primaryAccountId: "",
      relationship: "",
      consolidateCommunications: 0,
      consolidateLoyalty: 0
    }, scope(access));
    return { unlinked: true, member: publicClient(updated) };
  },

  members(primaryClientId, access) {
    const primary = getClient(primaryClientId, access);
    const primaryId = primary.primaryAccountId || primary.id;
    const primaryAccount = primary.primaryAccountId ? getClient(primary.primaryAccountId, access) : primary;
    const members = repositories.clients
      .list({ limit: 10000 }, scope(access))
      .filter((client) => client.primaryAccountId === primaryId)
      .map(publicClient);
    return {
      primary: publicClient(primaryAccount),
      members,
      totalMembers: members.length,
      communicationTarget: Number(primaryAccount.consolidateCommunications || 0) === 1 ? publicClient(primaryAccount) : null
    };
  },

  familyTreeByPhone(phone = "", access) {
    const needle = String(phone || "").replace(/\D/g, "");
    if (!needle) throw badRequest("phone is required");
    const matches = repositories.clients
      .list({ limit: 10000 }, scope(access))
      .filter((client) => String(client.phone || "").replace(/\D/g, "").includes(needle))
      .map((client) => this.members(client.id, access));
    const unique = new Map(matches.map((tree) => [tree.primary.id, tree]));
    return { phone, families: [...unique.values()] };
  },

  billingAccountFor(clientId, access) {
    const client = getClient(clientId, access);
    if (client.primaryAccountId) {
      const primary = getClient(client.primaryAccountId, access);
      return Number(client.consolidateCommunications || primary.consolidateCommunications || 0) ? primary : client;
    }
    return client;
  }
};
