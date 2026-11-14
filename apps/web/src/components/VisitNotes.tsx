'use client';

import type { VisitNote } from '@deeclinic/shared';
import { useEffect, useState } from 'react';
import { api, describeError } from '@/lib/api';

const field = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm';

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
      return list.some((n) => n.id === note.id)
        ? list.map((n) => (n.id === note.id ? note : n))
        : [...list, note];
    });
  }

  return (
    <section aria-label="Visit notes" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Visit notes</h3>
        {canAdd && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-sm underline">
            Add note
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {notes === null ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : (
        notes.length === 0 &&
        !adding && <p className="text-sm text-stone-500">No notes for this visit.</p>
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
            <li key={n.id} className="rounded-md bg-stone-50 p-3 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              {n.productsUsed && <p className="mt-1 text-stone-600">Products: {n.productsUsed}</p>}
              <p className="mt-1 flex items-center justify-between text-xs text-stone-500">
                <span>
                  {new Date(n.createdAt).toLocaleString()}
                  {n.updatedAt !== n.createdAt && ' (edited)'}
                </span>
                {canAdd && (
                  <button type="button" onClick={() => setEditingId(n.id)} className="underline">
                    Edit
                  </button>
                )}
              </p>
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border border-stone-300 p-3">
      <label className="block text-sm font-medium" htmlFor={`note-body-${note?.id ?? 'new'}`}>
        Note
      </label>
      <textarea
        id={`note-body-${note?.id ?? 'new'}`}
        rows={3}
        required
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={field}
      />
      <label className="block text-sm font-medium" htmlFor={`note-products-${note?.id ?? 'new'}`}>
        Products used (optional)
      </label>
      <input
        id={`note-products-${note?.id ?? 'new'}`}
        value={products}
        onChange={(e) => setProducts(e.target.value)}
        className={field}
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save note'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
