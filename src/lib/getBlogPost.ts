// lib/getBlogPost.ts
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export const getBlogPost = async (slug: string) => {
  const postsRef = collection(db, "posts");
  const q = query(postsRef, where("slug", "==", slug));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;
  return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as any;
};
