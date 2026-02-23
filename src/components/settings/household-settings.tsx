"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw } from "lucide-react";
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

    if (!error && data) onUpdate(data);
    setSaving(false);
  };

  const regenerateCode = async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("generate_invite_code", {
      p_household_id: household.id,
    });
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
      <h3 className="text-sm font-semibold text-gray-900">ハウスホールド</h3>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="household-name" className="text-xs text-gray-500">
          家族の名前
        </label>
        <div className="flex gap-2">
          <input
            id="household-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
          />
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-500">招待コード</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-gray-50 px-4 py-2.5 font-mono text-lg tracking-widest text-center">
            {inviteCode || "---"}
          </div>
          <button
            onClick={copyCode}
            className="rounded-lg bg-gray-100 p-2.5 text-gray-600 hover:bg-gray-200"
            title="コピー"
          >
            <Copy size={18} />
          </button>
          <button
            onClick={regenerateCode}
            className="rounded-lg bg-gray-100 p-2.5 text-gray-600 hover:bg-gray-200"
            title="再発行"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        {copied && (
          <p className="text-xs text-green-600">コピーしました</p>
        )}
        <p className="text-xs text-gray-400">
          招待コードは24時間有効です
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-500">メンバー</label>
        <div className="flex flex-col gap-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {member.nickname.charAt(0) || "?"}
              </div>
              <span className="flex-1 text-sm text-gray-900">{member.nickname}</span>
              {member.id === currentUserId && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  あなた
                </span>
              )}
            </div>
          ))}
        </div>
        {members.length === 0 && (
          <p className="text-sm text-gray-400">メンバーがいません</p>
        )}
      </div>
    </div>
  );
}
