export const queryKeys = {
  tasks: (householdId: string | null) => ["tasks", householdId] as const,
  categories: (householdId: string | null) => ["categories", householdId] as const,
  stapleItems: (householdId: string | null) => ["staple-items", householdId] as const,
  recommendations: (householdId: string | null) => ["recommendations", householdId] as const,
  titleSuggestions: (householdId: string | null) => ["title-suggestions", householdId] as const,
  profile: () => ["page-data", "profile"] as const,
  household: (householdId: string | null) => ["page-data", "household", householdId] as const,
};
