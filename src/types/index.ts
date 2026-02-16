import type { Database } from "./database";

export type Tables = Database["public"]["Tables"];

export type Household = Tables["households"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Task = Tables["tasks"]["Row"];
export type TaskAssignee = Tables["task_assignees"]["Row"];
export type TaskImage = Tables["task_images"]["Row"];

export type TaskWithAssignees = Task & {
  assignees: Profile[];
  category: Category | null;
};

export type HouseholdMember = Profile;
