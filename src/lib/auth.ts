import { Employee } from "./types";

const STORAGE_KEY = "redwine_employee";

export function getStoredEmployee(): Employee | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function storeEmployee(employee: Employee): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(employee));
}

export function clearEmployee(): void {
  localStorage.removeItem(STORAGE_KEY);
}
