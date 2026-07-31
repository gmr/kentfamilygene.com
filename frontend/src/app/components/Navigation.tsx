import { useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  useNavItemsQuery,
  useCreateNavItemMutation,
  useUpdateNavItemMutation,
  useDeleteNavItemMutation,
  type NavItemsQuery,
} from '../../generated/graphql';

type NavItem = NavItemsQuery['navItems'][number];

interface Draft {
  location: string;
  groupLabel: string;
  label: string;
  target: string;
  sortOrder: number;
}

const EMPTY: Draft = { location: 'header', groupLabel: '', label: '', target: '', sortOrder: 0 };

function toInput(draft: Draft) {
  return {
    location: draft.location,
    groupLabel: draft.location === 'footer' ? draft.groupLabel || undefined : undefined,
    label: draft.label,
    target: draft.target,
    sortOrder: draft.sortOrder,
  };
}

export function Navigation() {
  const [{ data, error }, refetch] = useNavItemsQuery({ requestPolicy: 'cache-and-network' });
  const [, createNavItem] = useCreateNavItemMutation();
  const [, updateNavItem] = useUpdateNavItemMutation();
  const [, deleteNavItem] = useDeleteNavItemMutation();

  const [editing, setEditing] = useState<NavItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const items = data?.navItems ?? [];
  const open = creating || editing !== null;

  // Header first, then footer grouped by column heading.
  const groups: { key: string; heading: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const heading =
      item.location === 'header' ? 'Header navigation' : item.groupLabel || 'Footer (ungrouped)';
    const key = `${item.location}:${item.groupLabel ?? ''}`;
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.items.push(item);
    else groups.push({ key, heading, items: [item] });
  }

  const close = () => {
    setCreating(false);
    setEditing(null);
    setDraft(EMPTY);
  };

  const save = async () => {
    if (!draft.label.trim() || !draft.target.trim()) {
      toast.error('Label and target are required');
      return;
    }
    setSaving(true);
    const result = editing
      ? await updateNavItem({ id: editing.id, input: toInput(draft) })
      : await createNavItem({ input: toInput(draft) });
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    toast.success(editing ? 'Link updated' : 'Link added');
    close();
    refetch({ requestPolicy: 'network-only' });
  };

  const move = async (item: NavItem, delta: number) => {
    const result = await updateNavItem({
      id: item.id,
      input: {
        location: item.location,
        groupLabel: item.groupLabel ?? undefined,
        label: item.label,
        target: item.target,
        sortOrder: item.sortOrder + delta,
      },
    });
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    refetch({ requestPolicy: 'network-only' });
  };

  const remove = async (item: NavItem) => {
    const result = await deleteNavItem({ id: item.id });
    if (result.error) {
      toast.error(result.error.message.replace('[GraphQL] ', ''));
      return;
    }
    toast.success('Link removed');
    refetch({ requestPolicy: 'network-only' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Navigation</h2>
          <p className="text-sm text-gray-500">
            Header links and footer columns on the public site. Targets can be internal paths
            (/lineages) or full URLs.
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(EMPTY);
            setCreating(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New link
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {items.length === 0 && (
        <p className="text-sm text-gray-500">
          No managed links yet — the public site is showing its built-in defaults.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {group.heading}
          </h3>
          {group.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-white px-4 py-2"
            >
              <div className="min-w-0">
                <span className="font-medium">{item.label}</span>
                <span className="ml-2 truncate text-sm text-gray-500">{item.target}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" title="Move up" onClick={() => move(item, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Move down" onClick={() => move(item, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Edit"
                  onClick={() => {
                    setDraft({
                      location: item.location,
                      groupLabel: item.groupLabel ?? '',
                      label: item.label,
                      target: item.target,
                      sortOrder: item.sortOrder,
                    });
                    setEditing(item);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Delete" onClick={() => remove(item)}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit link' : 'New link'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Location</Label>
              <Select
                value={draft.location}
                onValueChange={(v) => setDraft({ ...draft, location: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="footer">Footer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.location === 'footer' && (
              <div>
                <Label htmlFor="nav-group">Column heading</Label>
                <Input
                  id="nav-group"
                  placeholder="Learn more"
                  value={draft.groupLabel}
                  onChange={(e) => setDraft({ ...draft, groupLabel: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label htmlFor="nav-label">Label</Label>
              <Input
                id="nav-label"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="nav-target">Target</Label>
              <Input
                id="nav-target"
                placeholder="/background or https://…"
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="nav-order">Sort order</Label>
              <Input
                id="nav-order"
                type="number"
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
