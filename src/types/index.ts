import type { Database } from "./database";

export type Tables = Database["public"]["Tables"];

export type Household = Tables["households"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Task = Tables["tasks"]["Row"];
export type TaskAssignee = Tables["task_assignees"]["Row"];
export type TaskImage = Tables["task_images"]["Row"];
export type PushSubscription = Tables["push_subscriptions"]["Row"];

export type TaskWithAssignees = Task & {
  assignees: Profile[];
  category: Category | null;
};

export type HouseholdMember = Profile;

export type TaskRecommendation = {
  normalized_title: string;
  latest_title: string;
  latest_category_id: string | null;
  latest_memo: string | null;
  median_interval_days: number;
  days_since_last: number;
  completion_count: number;
  last_completed_at: string;
};
