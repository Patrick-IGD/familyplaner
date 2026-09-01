// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    interface Locals {
      member: {
        id: string;
        householdId: string;
        displayName: string;
        role: "adult" | "child";
        avatarColor: string;
      } | null;
    }
  }
}

export {};
