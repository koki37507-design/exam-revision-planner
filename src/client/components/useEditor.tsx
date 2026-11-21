import { useRouter } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { FieldsDialog, type FieldSpec } from "@/client/components/FieldsDialog";
import { Button } from "@/client/components/ui/button";
import { useAction } from "@/client/lib/useAction";
import { deleteItem } from "@/serverFunctions/curriculum";

type Values = Record<string, string | boolean>;
interface FormSpec {
  title: string;
  fields: FieldSpec[];
  initial?: Values;
  save: (values: Values) => Promise<unknown>;
}
type ItemType = "stream" | "subject" | "unit" | "chapter" | "card" | "exercise";
interface DeleteSpec {
  type: ItemType;
  id: string;
  name: string;
  consequence?: string;
}

/** The curriculum's edit and delete dialogs, opened from any row. */
export function useEditor() {
  const router = useRouter();
  const { run, pending } = useAction();
  const [form, setForm] = useState<FormSpec | null>(null);
  const [deleting, setDeleting] = useState<DeleteSpec | null>(null);

  const element = (
    <>
      {form ? (
        <FieldsDialog
          title={form.title}
          fields={form.fields}
          initial={form.initial}
          onClose={() => setForm(null)}
          onSave={async (values) => {
            await form.save(values);
            await router.invalidate();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={() =>
            run(() =>
              deleteItem({ data: { type: deleting.type, id: deleting.id } }),
            ).then(() => setDeleting(null))
          }
        >
          {deleting.consequence}
        </ConfirmDialog>
      ) : null}
    </>
  );

  return { open: setForm, remove: setDeleting, element };
}

/** Edit and delete buttons for one row, named after it for screen readers. */
export function RowActions({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${name}`}
        className="text-muted-foreground"
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${name}`}
        className="text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </span>
  );
}

export function ListRow({
  children,
  testId,
}: {
  children: ReactNode;
  testId?: string;
}) {
  return (
    <li
      data-testid={testId}
      className="flex items-center gap-3 px-4 py-2.5 text-sm"
    >
      {children}
    </li>
  );
}
