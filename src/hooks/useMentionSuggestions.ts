"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where, startAt, endAt } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface MentionUser {
  uid: string;
  username: string;
  avatarUrl?: string;
  verified?: boolean;
  // Optional displayName retained for compatibility with older builds; not always populated.
  displayName?: string;
}

export function useMentionSuggestions(sourceText: string) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const tokenRef = useRef<string | null>(null);

  // Extract the current @ token the caret is inside (simplified: last @word segment)
  useEffect(() => {
    const match = /(?:^|\s)@([a-zA-Z0-9_.-]{1,32})$/.exec(sourceText.slice(0));
    if (match) {
      const fragment = match[1];
      tokenRef.current = fragment;
      if (fragment.length === 0) {
        setOpen(false);
        return;
      }
      fetchUsers(fragment);
    } else {
      tokenRef.current = null;
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceText]);

  const fetchUsers = useCallback(async (prefix: string) => {
    setLoading(true);
    try {
      // Case-insensitive naive approach: query range on username with startAt/endAt
      // This assumes usernames are stored as-is; Firestore will match case-sensitively.
      // For better results, maintain a usernameLower field and query that. Fallback: client filter.
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("username"), startAt(prefix), endAt(prefix + "\uf8ff"), limit(5));
      const snap = await getDocs(q);
      const list: MentionUser[] = [];
      snap.forEach(d => {
        const data: any = d.data();
        if (!data?.uid || !data?.username) return;
        list.push({ uid: data.uid, username: data.username, avatarUrl: data.avatarUrl, verified: !!data.verified });
      });
      setUsers(list.filter(u => u.username.toLowerCase().startsWith(prefix.toLowerCase())));
      setOpen(list.length > 0);
      setActiveIndex(0);
    } catch (e) {
      setUsers([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const select = (u: MentionUser) => {
    if (!tokenRef.current) return null;
    const fragment = tokenRef.current;
    // Replace last @fragment with @username (ensuring single space tail)
    const replaced = sourceText.replace(new RegExp(`@${fragment}$`), `@${u.username} `);
    setOpen(false);
    return replaced;
  };

  return { open, loading, users, activeIndex, setActiveIndex, select };
}
