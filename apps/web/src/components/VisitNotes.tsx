'use client';

import type { VisitNote } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { Alert, Button, Field, Input, Skeleton, Textarea } from '@/components/ui';
import { api, describeError } from '@/lib/api';

/**
 * Notes for one appointment. Pass initialNotes when the parent already has them
 * (the client history does); otherwise the notes are fetched.
 */
export function VisitNotes({
  appointmentId,
  initialNotes,
  canAdd = true,
}: {
  appointmentId: string;
  initialNotes?: VisitNote[];
  canAdd?: boolean;
}) {
  const [notes, setNotes] = useState<VisitNote[] | null>(initialNotes ?? null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialNotes) return;
    let cancelled = false;
    api<{ data: VisitNote[] }>(`/visit-notes?appointmentId=${appointmentId}`)
      .then((r) => !cancelled && setNotes(r.data))
      .catch((e) => {
        if (cancelled) return;
        setNotes([]);
        setError(describeError(e, 'Could not load notes.'));
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, initialNotes]);

  function upsert(note: VisitNote) {
    setNotes((prev) => {
      const list = prev ?? [];
      return list.some((n) => n.id === note.id) ? list.map((n) => (n.id === note.id ? note : n)) : [...list, note];
    });
  }

  return (
    <section aria-label="Visit notes" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Visit notes</h3>
        {canAdd && !adding && (
          <Button size="sm" icon="plus" onClick={() => setAdding(true)}>
            Add note
          </Button>
        )}
      </div>

      {error && <Alert tone="bad">{error}</Alert>}

      {notes === null ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        notes.length === 0 && !adding && <p className="text-sm text-muted">No notes for this visit.</p>
      )}

      <ul className="space-y-2">
        {notes?.map((n) =>
          editingId === n.id ? (
            <li key={n.id}>
              <NoteForm
                note={n}
                appointmentId={appointmentId}
                onSaved={(saved) => {
                  upsert(saved);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={n.id} className="rounded-lg border border-line bg-sunken/60 p-3.5 text-sm">
              <p className="whitespace-pre-wrap text-fg">{n.body}</p>
              {n.productsUsed && <p className="mt-1.5 text-muted">Products: {n.productsUsed}</p>}
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>
                  {new Date(n.createdAt).toLocaleString()}
                  {n.updatedAt !== n.createdAt && ' · edited'}
                </span>
                {canAdd && (
                  <button type="button" onClick={() => setEditingId(n.id)} className="font-medium text-primary-ink hover:underline">
                    Edit
                  </button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>

      {adding && (
        <NoteForm
          note={null}
          appointmentId={appointmentId}
          onSaved={(saved) => {
            upsert(saved);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </section>
  );
}

function NoteForm({
  note,
  appointmentId,
  onSaved,
  onCancel,
}: {
  note: VisitNote | null;
  appointmentId: string;
  onSaved: (n: VisitNote) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(note?.body ?? '');
  const [products, setProducts] = useState(note?.productsUsed ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = note?.id ?? 'new';

  async function submit(e: React.FormEvent) {
    // Stop the click from submitting a form this one sits inside
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    setError(null);
    try {
      const r = note
        ? await api<{ data: VisitNote }>(`/visit-notes/${note.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ body, productsUsed: products }),
          })
        : await api<{ data: VisitNote }>('/visit-notes', {
            method: 'POST',
            body: JSON.stringify({ appointmentId, body, productsUsed: products }),
          });
      onSaved(r.data);
    } catch (err) {
      setError(describeError(err, 'Could not save the note.'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line-strong bg-surface p-4">
      <Field label="Note" htmlFor={`note-body-${key}`}>
        <Textarea id={`note-body-${key}`} rows={3} required value={body} onChange={(e) => setBody(e.target.value)} data-autofocus />
      </Field>
      <Field label="Products used" htmlFor={`note-products-${key}`} hint="Optional">
        <Input id={`note-products-${key}`} value={products} onChange={(e) => setProducts(e.target.value)} />
      </Field>
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          {saving ? 'Saving…' : 'Save note'}
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
