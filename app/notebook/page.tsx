"use client";

import { useState, useEffect, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import { PageTransition } from "@/components/ui/animations";

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  mood: string | null;
  tradeDate: string | null;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

const MOOD_EMOJI: Record<string, string> = { good: "😊", neutral: "😐", bad: "😔" };

export default function NotebookPage() {
  const [notes,    setNotes]    = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [isNew,    setIsNew]    = useState(false);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Editor fields
  const [title,   setTitle]   = useState("");
  const [content, setContent] = useState("");
  const [tags,    setTags]    = useState("");
  const [mood,    setMood]    = useState("neutral");
  const [images,  setImages]  = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/notes")
      .then(r => r.json())
      .then((data: Note[] | { ok: false }) => {
        if (Array.isArray(data)) setNotes(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const openNote = (note: Note) => {
    setSelected(note);
    setIsNew(false);
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags.join(", "));
    setMood(note.mood ?? "neutral");
    setImages(note.images);
  };

  const newNote = () => {
    setSelected(null);
    setIsNew(true);
    setTitle("");
    setContent("");
    setTags("");
    setMood("neutral");
    setImages([]);
  };

  const save = async () => {
    setSaving(true);
    const body = {
      title:   title || "Untitled",
      content,
      tags:    tags.split(",").map(t => t.trim()).filter(Boolean),
      mood,
      images,
    };

    try {
      if (isNew) {
        const res  = await fetch("/api/notes", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const note = await res.json() as Note;
        setNotes(prev => [note, ...prev]);
        openNote(note);
        setIsNew(false);
      } else if (selected) {
        const res  = await fetch(`/api/notes/${selected.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const note = await res.json() as Note;
        setNotes(prev => prev.map(n => n.id === note.id ? note : n));
        setSelected(note);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selected?.id === id) { setSelected(null); setIsNew(false); }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImages(prev => [...prev, reader.result as string]);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    n.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppShell>
      <PageTransition>
        <div className="flex h-[calc(100vh-48px)] md:h-screen bg-[#0f1117]">

          {/* ── Sidebar ── */}
          <div className="w-72 shrink-0 border-r border-white/5 flex flex-col bg-[#161b27]">
            {/* Header */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Notebook</h2>
                <button
                  onClick={newNote}
                  className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition text-lg leading-none"
                >+</button>
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full bg-white/[0.04] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500/30"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-xs text-slate-600 text-center">Loading...</p>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-xs text-slate-600 text-center">
                  {search ? "Nothing found" : "No notes yet — create one!"}
                </p>
              ) : (
                filtered.map(note => (
                  <div
                    key={note.id}
                    onClick={() => openNote(note)}
                    className={`px-4 py-3 border-b border-white/[0.04] cursor-pointer transition group
                      ${selected?.id === note.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm">{MOOD_EMOJI[note.mood ?? "neutral"] ?? "😐"}</span>
                          <p className="text-xs font-medium text-white truncate">{note.title}</p>
                        </div>
                        {note.content && (
                          <p className="text-[11px] text-slate-600 truncate">{note.content.slice(0, 60)}</p>
                        )}
                        {note.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {note.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[10px] bg-white/[0.04] text-slate-500 px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-slate-700 mt-1">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition shrink-0 text-xs mt-0.5"
                      >✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Editor ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {(selected || isNew) ? (
              <>
                {/* Toolbar */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Note title..."
                    className="flex-1 bg-transparent text-white text-base font-semibold outline-none min-w-0"
                  />
                  <select
                    value={mood}
                    onChange={e => setMood(e.target.value)}
                    className="bg-white/[0.04] border border-white/5 text-white text-xs rounded-lg px-2 py-1.5 outline-none shrink-0"
                  >
                    <option value="good">😊 Good</option>
                    <option value="neutral">😐 Neutral</option>
                    <option value="bad">😔 Bad</option>
                  </select>
                  <button
                    onClick={() => fileRef.current?.click()}
                    title="Add screenshot"
                    className="text-slate-500 hover:text-slate-300 transition text-sm shrink-0"
                  >📎</button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
                  <button
                    onClick={save}
                    disabled={saving}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50 shrink-0"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 px-5 py-2 border-b border-white/5 shrink-0">
                  <span className="text-slate-600 text-xs">Tags:</span>
                  <input
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="BTCUSDT, mistake, FOMO..."
                    className="flex-1 bg-transparent text-slate-400 text-xs outline-none"
                  />
                </div>

                {/* Content */}
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Write your observations, mistakes, lessons learned from this trading session..."
                  className="flex-1 bg-transparent text-slate-300 text-sm leading-relaxed px-5 py-4 outline-none resize-none"
                />

                {/* Images */}
                {images.length > 0 && (
                  <div className="px-5 py-3 border-t border-white/5 shrink-0">
                    <p className="text-[10px] text-slate-600 mb-2">Screenshots</p>
                    <div className="flex gap-2 flex-wrap">
                      {images.map((img, i) => (
                        <div key={i} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/5" />
                          <button
                            onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center px-8">
                <div>
                  <div className="text-5xl mb-4">📓</div>
                  <h3 className="text-sm font-semibold text-white mb-2">Trading Notebook</h3>
                  <p className="text-xs text-slate-500 mb-5">
                    Record your thoughts, mistakes and lessons after each trading session
                  </p>
                  <button
                    onClick={newNote}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium px-5 py-2.5 rounded-xl transition"
                  >
                    + New Note
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </PageTransition>
    </AppShell>
  );
}
