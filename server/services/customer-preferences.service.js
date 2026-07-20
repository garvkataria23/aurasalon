import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const languages = new Set(["en", "hi", "hi-en", "mr", "gu", "ta", "te", "kn", "ml", "bn", "pa"]);
const channels = new Set(["whatsapp", "sms", "email", "call_only", "no_communication"]);

function scope(access) {
  return tenantService.accessScope(access || {}, "clients");
}

function getClient(customerId, access) {
  const client = repositories.clients.getById(customerId, scope(access));
  if (!client) throw notFound("Customer not found");
  if (client.branchId) tenantService.assertBranchAccess(access, client.branchId);
  return client;
}

function publicPreferences(client) {
  return {
    customerId: client.id,
    preferredLanguage: client.preferredLanguage || "en",
    preferredChannel: client.preferredChannel || "whatsapp",
    consolidateCommunications: Number(client.consolidateCommunications || 0) === 1,
    consolidateLoyalty: Number(client.consolidateLoyalty || 0) === 1
  };
}

export const customerPreferencesService = {
  getPreferences(customerId, access) {
    return publicPreferences(getClient(customerId, access));
  },

  setLanguage(customerId, language, access) {
    if (!languages.has(language)) throw badRequest("Unsupported preferred language");
    const client = getClient(customerId, access);
    return publicPreferences(repositories.clients.update(client.id, { preferredLanguage: language }, scope(access)));
  },

  setChannel(customerId, channel, access) {
    if (!channels.has(channel)) throw badRequest("Unsupported preferred channel");
    const client = getClient(customerId, access);
    return publicPreferences(repositories.clients.update(client.id, { preferredChannel: channel }, scope(access)));
  },

  setOptOut(customerId, optOut, access) {
    return this.setChannel(customerId, optOut ? "no_communication" : "whatsapp", access);
  },

  updatePreferences(customerId, payload = {}, access) {
    const client = getClient(customerId, access);
    const next = {};
    const language = payload.preferredLanguage ?? payload.language;
    const channel = payload.preferredChannel ?? payload.channel;
    if (language !== undefined) {
      if (!languages.has(language)) throw badRequest("Unsupported preferred language");
      next.preferredLanguage = language;
    }
    if (channel !== undefined) {
      if (!channels.has(channel)) throw badRequest("Unsupported preferred channel");
      next.preferredChannel = channel;
    }
    if (payload.consolidateCommunications !== undefined) {
      next.consolidateCommunications = payload.consolidateCommunications ? 1 : 0;
    }
    if (payload.consolidateLoyalty !== undefined) {
      next.consolidateLoyalty = payload.consolidateLoyalty ? 1 : 0;
    }
    if (!Object.keys(next).length) return publicPreferences(client);
    return publicPreferences(repositories.clients.update(client.id, next, scope(access)));
  }
};
