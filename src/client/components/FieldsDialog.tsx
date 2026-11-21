import { useState, type ReactNode } from "react";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { messageOf } from "@/client/lib/useAction";

export interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "checkbox";
  required?: boolean;
}

type Values = Record<string, string | boolean>;

/** A dialog of labelled fields that saves through `onSave`, then closes. */
export function FieldsDialog({
  title,
  fields,
  initial,
  onSave,
  onClose,
}: {
  title: ReactNode;
  fields: FieldSpec[];
  initial?: Values;
  onSave: (values: Values) => Promise<unknown>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Values>(() => {
    const start: Values = {};
    for (const f of fields)
      start[f.name] = initial?.[f.name] ?? (f.type === "checkbox" ? false : "");
    return start;
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (name: string, value: string | boolean) =>
    setValues((v) => ({ ...v, [name]: value }));

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            try {
              await onSave(values);
              onClose();
            } catch (cause) {
              setError(messageOf(cause));
            } finally {
              setPending(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {fields.map((f) => {
            const id = `field-${f.name}`;
            if (f.type === "checkbox") {
              return (
                <label key={f.name} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={values[f.name] === true}
                    onCheckedChange={(checked) => set(f.name, checked)}
                  />
                  {f.label}
                </label>
              );
            }
            return (
              <div key={f.name} className="space-y-1.5">
                <Label htmlFor={id}>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={id}
                    rows={4}
                    required={f.required !== false}
                    value={String(values[f.name])}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                ) : (
                  <Input
                    id={id}
                    type={f.type === "number" ? "number" : "text"}
                    min={f.type === "number" ? 1 : undefined}
                    required={f.required !== false}
                    value={String(values[f.name])}
                    onChange={(e) => set(f.name, e.target.value)}
                  />
                )}
              </div>
            );
          })}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
