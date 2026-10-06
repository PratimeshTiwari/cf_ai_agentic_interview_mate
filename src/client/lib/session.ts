import type { UserProfile } from "../../lib/types";

/**
 * Demo-only "login": the app ships with three personas and keeps the chosen
 * one in localStorage. There is no real authentication — each persona maps
 * to its own UserAgent instance, which holds that persona's history.
 */
export type DemoUser = UserProfile & { initials: string; color: string };

export const DEMO_USERS: DemoUser[] = [
  {
    id: "demo-alex",
    name: "Alex Rivera",
    role: "Software Engineer",
    initials: "AR",
    color: "bg-blue-500"
  },
  {
    id: "demo-priya",
    name: "Priya Shah",
    role: "Product Manager",
    initials: "PS",
    color: "bg-purple-500"
  },
  {
    id: "demo-jordan",
    name: "Jordan Lee",
    role: "Data Scientist",
    initials: "JL",
    color: "bg-emerald-500"
  }
];

const KEY = "aim.currentUser";

export function getCurrentUser(): DemoUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoUser) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: DemoUser) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // storage unavailable (private mode); the session just won't persist
  }
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
