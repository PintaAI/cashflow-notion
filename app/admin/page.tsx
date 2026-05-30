"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Analytics01Icon,
  File01Icon,
  Home02Icon,
  Logout01Icon,
  UserCircleIcon,
  Shield01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminDashboard,
  getAllUsers,
  getAllManagements,
  getManagementDetails,
  deleteUser,
  deleteManagement,
  updateMemberRole,
  removeMember,
  transferOwnership,
} from "@/app/actions/admin";

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;
type AllUsers = Awaited<ReturnType<typeof getAllUsers>>;
type AllManagements = Awaited<ReturnType<typeof getAllManagements>>;
type ManagementDetail = Awaited<ReturnType<typeof getManagementDetails>>;

function StatsCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: IconSvgElement;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-4">
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentUsers, recentManagements } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard label="Total Users" value={stats.userCount} icon={UserCircleIcon} />
        <StatsCard label="Managements" value={stats.managementCount} icon={File01Icon} />
        <StatsCard label="Total Entries" value={stats.totalEntries} icon={Analytics01Icon} />
        <StatsCard label="Total Nominal" value={`Rp ${(stats.totalNominal).toLocaleString("id-ID")}`} icon={Shield01Icon} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-medium">Recent Users</p>
            <p className="text-xs text-muted-foreground">{stats.userCount} total</p>
          </div>
          <div className="divide-y">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground shrink-0">
                  {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{user.name ?? user.email}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(user.createdAt).toLocaleDateString("id-ID")}
                </p>
              </div>
            ))}
            {recentUsers.length === 0 && (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">No users yet</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-medium">Recent Managements</p>
            <p className="text-xs text-muted-foreground">{stats.managementCount} total</p>
          </div>
          <div className="divide-y">
            {recentManagements.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {m.memberCount} member{m.memberCount !== 1 ? "s" : ""} · {m.entryCount} entries
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(m.createdAt).toLocaleDateString("id-ID")}
                </p>
              </div>
            ))}
            {recentManagements.length === 0 && (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">No managements yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<AllUsers>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleDeleteUser(userId: string, userName: string) {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert("Failed to delete user: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Memberships</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground shrink-0">
                    {user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
                  </div>
                  <span className="text-xs font-medium truncate max-w-[120px]">{user.name ?? "—"}</span>
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString("id-ID")}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {user.memberships.map((m) => (
                    <Badge key={m.id} variant={m.role === "owner" ? "default" : "secondary"} className="text-[10px]">
                      {m.managementName}
                      <span className="ml-0.5 opacity-60">({m.role})</span>
                    </Badge>
                  ))}
                  {user.memberships.length === 0 && (
                    <span className="text-[10px] text-muted-foreground">None</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={() => handleDeleteUser(user.id, user.name ?? user.email)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">
                No users found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ManagementDetailView({
  managementId,
  onBack,
}: {
  managementId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<ManagementDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getManagementDetails(managementId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [managementId]);

  async function handleRoleChange(memberId: string, role: string) {
    try {
      await updateMemberRole(memberId, role);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) =>
                m.id === memberId ? { ...m, role } : m
              ),
            }
          : prev
      );
    } catch (err) {
      alert("Failed to update role: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function handleRemoveMember(memberId: string, userName: string) {
    if (!window.confirm(`Remove "${userName}" from this management?`)) return;
    try {
      await removeMember(memberId);
      setDetail((prev) =>
        prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev
      );
    } catch (err) {
      alert("Failed to remove member: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  async function handleTransferOwnership(userId: string, userName: string) {
    if (!window.confirm(`Transfer ownership to "${userName}"?`)) return;
    try {
      await transferOwnership(managementId, userId);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((m) => ({
                ...m,
                role: m.userId === userId ? "owner" : m.role === "owner" ? "member" : m.role,
              })),
            }
          : prev
      );
    } catch (err) {
      alert("Failed to transfer ownership: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="xs" onClick={onBack}>
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 rotate-180" />
        </Button>
        <div>
          <p className="text-sm font-semibold">{detail.name}</p>
          <p className="text-[10px] text-muted-foreground">
            Created {new Date(detail.createdAt).toLocaleDateString("id-ID")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="rounded-md border p-2.5 text-center">
          <p className="text-lg font-bold">{detail._count.entries}</p>
          <p className="text-[10px] text-muted-foreground">Entries</p>
        </div>
        <div className="rounded-md border p-2.5 text-center">
          <p className="text-lg font-bold">{detail.members.length}</p>
          <p className="text-[10px] text-muted-foreground">Members</p>
        </div>
        <div className="rounded-md border p-2.5 text-center">
          <p className="text-lg font-bold">{detail._count.categories}</p>
          <p className="text-[10px] text-muted-foreground">Categories</p>
        </div>
        <div className="rounded-md border p-2.5 text-center">
          <p className="text-lg font-bold">{detail._count.quickFills}</p>
          <p className="text-[10px] text-muted-foreground">Quick Fills</p>
        </div>
        <div className="rounded-md border p-2.5 text-center">
          <p className="text-lg font-bold">{detail._count.invitations}</p>
          <p className="text-[10px] text-muted-foreground">Invitations</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-md border p-3">
          <p className="text-[10px] text-muted-foreground">Income</p>
          <p className="text-sm font-semibold text-green-600">
            Rp {detail.totalIncome.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[10px] text-muted-foreground">Expenses</p>
          <p className="text-sm font-semibold text-red-600">
            Rp {detail.totalExpenses.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-[10px] text-muted-foreground">Balance</p>
          <p className="text-sm font-semibold">
            Rp {(detail.totalIncome - detail.totalExpenses).toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="border-b px-4 py-2.5">
          <p className="text-sm font-medium">Members</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground shrink-0">
                      {member.user.name?.[0]?.toUpperCase() ?? member.user.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate max-w-[120px]">
                        {member.user.name ?? "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {member.user.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={member.role}
                    onValueChange={(value) => handleRoleChange(member.id, value)}
                  >
                    <SelectTrigger className="h-6 text-[10px] w-20" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(member.joinedAt).toLocaleDateString("id-ID")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {member.role !== "owner" && (
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            handleTransferOwnership(
                              member.userId,
                              member.user.name ?? member.user.email
                            )
                          }
                        >
                          Make Owner
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={() =>
                            handleRemoveMember(
                              member.id,
                              member.user.name ?? member.user.email
                            )
                          }
                        >
                          Remove
                        </Button>
                      </>
                    )}
                    {member.role === "owner" && (
                      <Badge variant="default" className="text-[10px]">
                        Owner
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ManagementsTab() {
  const [managements, setManagements] = useState<AllManagements>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchManagements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllManagements();
      setManagements(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagements();
  }, [fetchManagements]);

  async function handleDeleteManagement(id: string, name: string) {
    if (!window.confirm(`Delete management "${name}" and all its data?`)) return;
    try {
      await deleteManagement(id);
      setManagements((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      alert("Failed to delete management: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  }

  if (selectedId) {
    return (
      <ManagementDetailView
        managementId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Entries</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {managements.map((m) => (
            <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelectedId(m.id)}>
              <TableCell className="text-xs font-medium">{m.name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {m.owner?.name ?? m.owner?.email ?? "—"}
              </TableCell>
              <TableCell className="text-xs">{m.memberCount}</TableCell>
              <TableCell className="text-xs">{m.entryCount}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {m.lastActivity
                  ? new Date(m.lastActivity).toLocaleDateString("id-ID")
                  : "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(m.createdAt).toLocaleDateString("id-ID")}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteManagement(m.id, m.name);
                  }}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {managements.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                No managements found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="size-6 text-primary" />
          <h1 className="text-lg font-semibold">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="outline" size="xs">
              <HugeiconsIcon icon={Home02Icon} strokeWidth={2} className="size-4 mr-1" />
              Home
            </Button>
          </Link>
          <Button variant="ghost" size="xs" onClick={() => {
            import("@/lib/auth-client").then(({ signOut }) => {
              signOut();
              window.location.href = "/auth";
            });
          }}>
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} className="size-4 mr-1" />
            Keluar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="overview">
            <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users">
            <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} className="size-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="managements">
            <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-4" />
            Managements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        <TabsContent value="managements">
          <ManagementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
