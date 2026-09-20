/**
 * In-memory Store: local development and tests. Everything is lost on
 * restart, which is why production refuses to fall back to it.
 */

import { randomUUID } from "node:crypto";
import { Store, User, UserWithHash, Save, Prefs } from "../types.js";

export function memoryStore(): Store {
  const users = new Map<string, UserWithHash>();
  const byEmail = new Map<string, string>();
  const sessions = new Map<string, { userId: string; expiresAt: number }>();
  const saves = new Map<string, Map<string, Save>>();
  const subscribers = new Map<string, { confirmed: boolean; unsubscribed: boolean }>();
  const sends = new Set<string>();
  const limits = new Map<string, { count: number; resetAt: number }>();

  const strip = ({ passwordHash: _omit, ...u }: UserWithHash): User => u;

  return {
    async createUser({ email, name, passwordHash }) {
      if (byEmail.has(email)) return null;
      const u: UserWithHash = {
        id: randomUUID(), email, name, passwordHash, follows: [], digest: false, createdAt: new Date().toISOString(),
      };
      users.set(u.id, u);
      byEmail.set(email, u.id);
      return strip(u);
    },
    async userByEmail(email) {
      const id = byEmail.get(email);
      return id ? (users.get(id) ?? null) : null;
    },

    async createSession(userId, tokenHash, expiresAt) {
      sessions.set(tokenHash, { userId, expiresAt: expiresAt.getTime() });
    },
    async sessionUser(tokenHash) {
      const s = sessions.get(tokenHash);
      if (!s) return null;
      if (s.expiresAt <= Date.now()) {
        sessions.delete(tokenHash);
        return null;
      }
      const u = users.get(s.userId);
      return u ? strip(u) : null;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },

    async listSaves(userId) {
      return [...(saves.get(userId)?.values() ?? [])].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },
    async addSave(userId, s) {
      const m = saves.get(userId) ?? new Map<string, Save>();
      if (!m.has(s.storyId)) m.set(s.storyId, { ...s, savedAt: new Date().toISOString() });
      saves.set(userId, m);
    },
    async removeSave(userId, storyId) {
      saves.get(userId)?.delete(storyId);
    },

    async setPrefs(userId, prefs: Prefs) {
      const u = users.get(userId);
      if (!u) return null;
      const next: UserWithHash = { ...u, follows: [...prefs.follows], digest: prefs.digest };
      users.set(userId, next);
      return strip(next);
    },
    async subscribe(email) {
      const cur = subscribers.get(email);
      if (cur && !cur.unsubscribed) return cur.confirmed ? "confirmed" : "pending";
      subscribers.set(email, { confirmed: false, unsubscribed: false });
      return "new";
    },
    async confirmSubscriber(email) {
      subscribers.set(email, { confirmed: true, unsubscribed: false });
    },
    async unsubscribe(email) {
      const cur = subscribers.get(email);
      if (cur) subscribers.set(email, { ...cur, unsubscribed: true });
      const id = byEmail.get(email);
      const u = id ? users.get(id) : undefined;
      if (id && u) users.set(id, { ...u, digest: false });
    },
    async pendingSubscribers() {
      return [...subscribers].filter(([, v]) => !v.confirmed && !v.unsubscribed).map(([e]) => e);
    },
    async confirmedRecipients() {
      return [...subscribers].filter(([, v]) => v.confirmed && !v.unsubscribed).map(([e]) => e);
    },
    async claimSend(date, email) {
      const k = `${date}|${email}`;
      if (sends.has(k)) return false;
      sends.add(k);
      return true;
    },
    async releaseSend(date, email) {
      sends.delete(`${date}|${email}`);
    },

    async hit(key, limit, windowSec) {
      const now = Date.now();
      const cur = limits.get(key);
      if (!cur || cur.resetAt <= now) {
        limits.set(key, { count: 1, resetAt: now + windowSec * 1000 });
        return true;
      }
      cur.count += 1;
      return cur.count <= limit;
    },
  };
}
