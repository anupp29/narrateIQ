/**
 * Evidence retrieval.
 *
 * TF-IDF with cosine similarity over CRM notes and support tickets. At this
 * corpus size a vector database adds cost without adding recall, so the index
 * is built in memory and is fully deterministic and inspectable.
 */

import { notes, type NoteRow } from "./datasets";

const STOP = new Set(
  "a an and are as at be been but by for from had has have in into is it its of on or that the their there this to was were will with we our not no you your".split(
    " ",
  ),
);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));

interface IndexedDoc {
  note: NoteRow;
  tf: Map<string, number>;
  norm: number;
}

let index: { docs: IndexedDoc[]; idf: Map<string, number> } | null = null;

function buildIndex() {
  if (index) return index;
  const corpus = notes();
  const df = new Map<string, number>();
  const docTokens = corpus.map((note) => {
    const tokens = tokenize(note.text);
    new Set(tokens).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1));
    return { note, tokens };
  });

  const idf = new Map<string, number>();
  df.forEach((count, term) => idf.set(term, Math.log((1 + corpus.length) / (1 + count)) + 1));

  const docs: IndexedDoc[] = docTokens.map(({ note, tokens }) => {
    const tf = new Map<string, number>();
    tokens.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    let sq = 0;
    tf.forEach((count, term) => {
      const w = (count / tokens.length) * (idf.get(term) ?? 1);
      sq += w * w;
    });
    return { note, tf, norm: Math.sqrt(sq) || 1 };
  });

  index = { docs, idf };
  return index;
}

export interface RetrievedEvidence {
  noteId: string;
  date: string;
  source: "CRM" | "Tickets";
  region: string;
  segment: string;
  authorRole: string;
  text: string;
  score: number;
}

export interface RetrievalFilter {
  region?: string;
  segment?: string;
  sinceDate?: string;
}

export function retrieve(
  query: string,
  topK = 3,
  filter: RetrievalFilter = {},
): RetrievedEvidence[] {
  const { docs, idf } = buildIndex();
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const qTf = new Map<string, number>();
  qTokens.forEach((t) => qTf.set(t, (qTf.get(t) ?? 0) + 1));
  let qNorm = 0;
  qTf.forEach((count, term) => {
    const w = (count / qTokens.length) * (idf.get(term) ?? 1);
    qNorm += w * w;
  });
  qNorm = Math.sqrt(qNorm) || 1;

  return docs
    .filter((d) => {
      if (filter.region && d.note.region !== filter.region) return false;
      if (filter.segment && d.note.segment !== filter.segment) return false;
      if (filter.sinceDate && d.note.date < filter.sinceDate) return false;
      return true;
    })
    .map((d) => {
      let dot = 0;
      const docLen = Array.from(d.tf.values()).reduce((a, b) => a + b, 0) || 1;
      qTf.forEach((qCount, term) => {
        const dCount = d.tf.get(term);
        if (!dCount) return;
        const w = idf.get(term) ?? 1;
        dot += ((qCount / qTokens.length) * w) * ((dCount / docLen) * w);
      });
      return {
        noteId: d.note.noteId,
        date: d.note.date,
        source: d.note.source,
        region: d.note.region,
        segment: d.note.segment,
        authorRole: d.note.authorRole,
        text: d.note.text,
        score: Math.round((dot / (d.norm * qNorm)) * 1000) / 1000,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export const corpusSize = () => notes().length;
