"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { Household, Profile } from "@/types";

interface HouseholdSettingsProps {
  household: Household;
  onUpdate: (household: Household) => void;
  members: Profile[];
  currentUserId: string;
}

export function HouseholdSettings({
  household,
  onUpdate,
  members,
  currentUserId,
}: HouseholdSettingsProps) {
  const [name, setName] = useState(household.name);
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState(household.invite_code);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("households")
      .update({ name })
      .eq("id", household.id)
      .select()
      .single();

    if (error) toast.error("ハウスホールド名の保存に失敗しました");
    if (!error && data) onUpdate(data);
    setSaving(false);
  };

  const regenerateCode = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("generate_invite_code", {
      p_household_id: household.id,
    });
    if (error) toast.error("招待コードの生成に失敗しました");
    if (data) setInviteCode(data);
  };

  const copyCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">家族グループ</h3>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="household-name" className="text-xs text-muted">
          家族の名前
        </label>
        <div className="flex gap-2">
          <input
            id="household-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="flex-1 rounded border border-border-strong bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-focus focus:ring-2 focus:ring-focus/15"
          />
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">招待コード</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded border border-border bg-background px-4 py-2.5 font-mono text-lg tracking-widest text-center text-foreground">
            {inviteCode || "---"}
          </div>
          <button
            onClick={copyCode}
            className="rounded bg-surface-strong p-2.5 text-muted hover:bg-border-strong"
            title="コピー"
          >
            <Copy size={18} />
          </button>
          <button
            onClick={regenerateCode}
            className="rounded bg-surface-strong p-2.5 text-muted hover:bg-border-strong"
            title="再発行"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        {copied && (
          <p className="text-xs text-success">コピーしました</p>
        )}
        <p className="text-xs text-subtle">
          招待コードは24時間有効です
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted">メンバー</label>
        <div className="flex flex-col gap-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-2">
              <Avatar profile={member} size="md" />
              <span className="flex-1 text-sm text-foreground">{member.nickname}</span>
              {member.id === currentUserId && (
                <span className="text-xs text-muted bg-surface-strong px-2 py-1 rounded">
                  あなた
                </span>
              )}
            </div>
          ))}
        </div>
        {members.length === 0 && (
          <p className="text-sm text-subtle">メンバーがいません</p>
        )}
      </div>
    </div>
  );
}
