"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { Heart, ThumbsUp, Sparkles } from "lucide-react";

type CollectionKey = "posts" | "questions";
type ReactionKey = "like" | "love" | "celebrate";

const REACTIONS: { key: ReactionKey; label: string; Icon: any; className: string; activeClass: string }[] = [
  { key: "like", label: "Like", Icon: ThumbsUp, className: "border hover:border-blue-200", activeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "love", label: "Love", Icon: Heart, className: "border hover:border-pink-200", activeClass: "bg-pink-50 text-pink-700 border-pink-200" },
  { key: "celebrate", label: "Yay", Icon: Sparkles, className: "border hover:border-amber-200", activeClass: "bg-amber-50 text-amber-700 border-amber-200" },
];

export function ReactionBar({ collection, id }: { collection: CollectionKey; id: string }) {
  const auth = useMemo(() => getAuth(app), []);
  const db = useMemo(() => getFirestore(app), []);
  const [counts, setCounts] = useState<Record<ReactionKey, number>>({ like: 0, love: 0, celebrate: 0 });
  const [mine, setMine] = useState<Record<ReactionKey, boolean>>({ like: false, love: false, celebrate: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const parentRef = doc(db, collection, id);
        const snap = await getDoc(parentRef);
        const data: any = snap.data() || {};
        const c: any = data.reactions || {};
        if (!cancelled) {
          setCounts({ like: Number(c.like || 0), love: Number(c.love || 0), celebrate: Number(c.celebrate || 0) });
        }
        const u = auth.currentUser;
        if (u) {
          const youRef = doc(db, collection, id, "reactions", u.uid);
          const you = await getDoc(youRef);
          const y: any = you.data() || {};
          if (!cancelled) {
            setMine({ like: !!y.like, love: !!y.love, celebrate: !!y.celebrate });
          }
        } else if (!cancelled) {
          setMine({ like: false, love: false, celebrate: false });
        }
      } catch (e) {
        // noop
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [db, auth, collection, id]);

  async function toggle(reaction: ReactionKey) {
    const u = auth.currentUser;
    if (!u) {
      if (typeof window !== "undefined") window.location.href = "/auth/sign-in";
      return;
    }

    const parentRef = doc(db, collection, id);
    const youRef = doc(db, collection, id, "reactions", u.uid);
    const currently = !!mine[reaction];
    const delta = currently ? -1 : 1;

    try {
      // Optimistic UI
      setMine((m) => ({ ...m, [reaction]: !currently }));
      setCounts((c) => ({ ...c, [reaction]: Math.max(0, (c[reaction] || 0) + delta) }));

      await Promise.all([
        setDoc(youRef, { [reaction]: !currently }, { merge: true }),
        updateDoc(parentRef, {
          [`reactions.${reaction}`]: increment(delta),
          reactionsTotal: increment(delta),
        }),
      ]);
    } catch (e) {
      // Revert on failure
      setMine((m) => ({ ...m, [reaction]: currently }));
      setCounts((c) => ({ ...c, [reaction]: Math.max(0, (c[reaction] || 0) - delta) }));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTIONS.map(({ key, label, Icon, className, activeClass }) => {
        const active = !!mine[key];
        const cn = `flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition ${active ? activeClass : `bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 ${className}`}`;
        return (
          <button key={key} type="button" disabled={loading}
            onClick={() => toggle(key)}
            className={cn} aria-pressed={active} aria-label={`${label} reaction`}>
            <Icon className="w-4 h-4" fill={key === "love" && active ? "currentColor" : "none"} />
            <span className="font-medium">{counts[key] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ReactionBar;
