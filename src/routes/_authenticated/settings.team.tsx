import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMyProfile, listMyShops } from "@/lib/shops.functions";
import { listTeam, inviteMember, updateMemberRole, removeMember } from "@/lib/team.functions";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamSettings,
});

type Role = "owner" | "manager" | "cashier" | "staff";

function TeamSettings() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const listShopsFn = useServerFn(listMyShops);
  const listTeamFn = useServerFn(listTeam);
  const inviteFn = useServerFn(inviteMember);
  const updateRoleFn = useServerFn(updateMemberRole);
  const removeFn = useServerFn(removeMember);

  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const shops = useQuery({ queryKey: ["my-shops"], queryFn: () => listShopsFn() });

  const activeId = profile.data?.active_shop_id ?? shops.data?.[0]?.id ?? null;
  const myRole = shops.data?.find((s) => s.id === activeId)?.role;
  const canManage = myRole === "owner" || myRole === "manager";

  const team = useQuery({
    queryKey: ["team", activeId],
    queryFn: () => listTeamFn({ data: { shop_id: activeId! } }),
    enabled: !!activeId,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("cashier");

  const invite = useMutation({
    mutationFn: () =>
      inviteFn({ data: { shop_id: activeId!, email: inviteEmail, role: inviteRole } }),
    onSuccess: () => {
      toast.success("Invitation added");
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["team", activeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to invite"),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      updateRoleFn({ data: { id, role } }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["team", activeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["team", activeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  if (!activeId) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No active shop. Create one to manage a team.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Invite a teammate</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col sm:flex-row gap-3 sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
              </div>
              <div className="w-full sm:w-44 space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Invite
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              The teammate will appear once they sign up with this email and accept (auto-link coming soon).
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Team members</CardTitle>
        </CardHeader>
        <CardContent>
          {team.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="divide-y divide-border">
              {(team.data ?? []).map((m) => {
                const name = m.profile?.full_name ?? m.invited_email ?? "Unnamed";
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.invited_email ?? (m.user_id ? "Active member" : "—")}
                      </div>
                    </div>
                    {m.status === "invited" && (
                      <Badge variant="outline" className="text-xs">
                        Invited
                      </Badge>
                    )}
                    {canManage && m.role !== "owner" ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          changeRole.mutate({ id: m.id, role: v as Role })
                        }
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="cashier">Cashier</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="capitalize text-xs">
                        {m.role}
                      </Badge>
                    )}
                    {canManage && m.role !== "owner" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove.mutate(m.id)}
                        aria-label="Remove member"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </li>
                );
              })}
              {team.data && team.data.length === 0 && (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  No members yet.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
