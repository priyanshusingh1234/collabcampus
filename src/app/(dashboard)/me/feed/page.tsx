"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { app } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
	collection,
	doc,
	getDocs,
	getFirestore,
	limit,
	onSnapshot,
	orderBy,
	query,
	where,
} from "firebase/firestore";

type FeedItem = {
	id: string;
	type: "post" | "question";
	title: string;
	slug?: string;
	content?: string;
	username?: string;
	avatarUrl?: string;
	image?: string;
	imageUrl?: string;
	createdAt?: any;
};

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.06, delayChildren: 0.12 },
	},
};
const itemVariants = {
	hidden: { y: 24, opacity: 0 },
	visible: { y: 0, opacity: 1, transition: { duration: 0.35 } },
};

function sanitize(html: string) {
	if (!html) return "";
	// Remove scripts, styles, iframes, on* handlers
	return html
		.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
		.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
		.replace(/ on\w+="[^"]*"/gi, "")
		.replace(/ on\w+='[^']*'/gi, "");
}

export default function FeedPage() {
	const [userId, setUserId] = useState<string | null>(null);
	const [items, setItems] = useState<FeedItem[]>([]);
		const [loading, setLoading] = useState(true);
	const unsubRefs = useRef<(() => void)[]>([]);
		const profileByUsernameRef = useRef<Record<string, string>>({});
		const [visibleCount, setVisibleCount] = useState<number>(12);

	useEffect(() => {
		const auth = getAuth(app);
		const off = onAuthStateChanged(auth, (u) => setUserId(u?.uid || null));
		return () => off();
	}, []);

	useEffect(() => {
		unsubRefs.current.forEach((fn) => fn());
		unsubRefs.current = [];
		setItems([]);
		if (!userId) {
			setLoading(false);
			return;
		}

		const db = getFirestore(app);

		async function wire() {
			setLoading(true);
			try {
				// Load current user to get following array (user IDs or usernames)
				const userDoc = await getDocs(
					query(collection(db, "users"), where("uid", "==", userId))
				);
				const me = userDoc.docs[0]?.data() as any;
				const followingArr: string[] = Array.isArray(me?.following)
					? me.following
					: [];

				if (!followingArr.length) {
					setLoading(false);
					return;
				}

			// Determine if the array is usernames or user IDs; fetch usernames if needed
				let usernames: string[] = followingArr;
				const seemsId = followingArr.some((v) => /[A-Za-z0-9]{16,}/.test(v));
				if (seemsId) {
					// Map user IDs to usernames
					const chunks: string[][] = [];
					for (let i = 0; i < followingArr.length; i += 10) {
						chunks.push(followingArr.slice(i, i + 10));
					}
					const nameSet = new Set<string>();
					for (const c of chunks) {
						const snap = await getDocs(
							query(collection(db, "users"), where("uid", "in", c))
						);
						snap.forEach((d) => {
							const u = d.data() as any;
							if (u?.username) nameSet.add(u.username);
						});
					}
					usernames = Array.from(nameSet);
				}

				if (!usernames.length) {
					setLoading(false);
					return;
				}

						// Preload avatarUrl for usernames
						profileByUsernameRef.current = {};
						const userChunks: string[][] = [];
						for (let i = 0; i < usernames.length; i += 10) userChunks.push(usernames.slice(i, i + 10));
						for (const c of userChunks) {
							const snap = await getDocs(query(collection(db, "users"), where("username", "in", c)));
							snap.forEach((d) => {
								const u = d.data() as any;
								const uname = u?.username as string;
								if (uname) profileByUsernameRef.current[uname] = u?.avatarUrl || "";
							});
						}

				// Subscribe to posts and questions by followed usernames
				const chunks: string[][] = [];
				for (let i = 0; i < usernames.length; i += 10) {
					chunks.push(usernames.slice(i, i + 10));
				}

						const postUnsubs = chunks.map((c) => {
							const q = query(
								collection(db, "posts"),
								where("username", "in", c),
							limit(90)
							);
					return onSnapshot(q, (snap) => {
						const next: FeedItem[] = snap.docs.map((d) => {
							const x = d.data() as any;
							return {
								id: d.id,
								type: "post",
								title: x.title,
								slug: x.slug,
								content: x.content,
								username: x.username,
							avatarUrl: profileByUsernameRef.current[x.username] || x.author?.avatarUrl || x.avatarUrl || "",
								image: x.image,
								imageUrl: x.imageUrl,
								createdAt: x.createdAt,
							};
						});
						setItems((prev) => sortMerge(prev, next));
					});
				});

						const questionUnsubs = chunks.map((c) => {
							const q = query(
								collection(db, "questions"),
								where("author.username", "in", c),
							limit(90)
							);
					return onSnapshot(q, (snap) => {
									const next: FeedItem[] = snap.docs.map((d) => {
							const x = d.data() as any;
										const uname = x.author?.username as string | undefined;
							return {
								id: d.id,
								type: "question",
								title: x.title,
								slug: x.slug,
								content: x.content,
								username: x.author?.username,
											avatarUrl: (uname && profileByUsernameRef.current[uname]) || x.author?.avatarUrl || "",
								image: x.image,
								imageUrl: x.imageUrl,
								createdAt: x.createdAt,
							};
						});
						setItems((prev) => sortMerge(prev, next));
					});
				});

				unsubRefs.current = [...postUnsubs, ...questionUnsubs];
			} finally {
				setLoading(false);
			}
		}

		wire();

		return () => {
			unsubRefs.current.forEach((fn) => fn());
			unsubRefs.current = [];
		};
	}, [userId]);

	const sortedItems = useMemo(() => sortByDate(items), [items]);

	if (!userId) {
		return (
			<div className="container mx-auto px-4 py-10">
				<Card>
					<CardContent className="p-6 text-center">
						<p className="mb-4">Sign in to see your personalized feed.</p>
						<Button asChild>
							<Link href="/auth/sign-in">Sign in</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 md:px-6 py-8">
			<h1 className="text-2xl font-semibold mb-6">Your Feed</h1>
			{loading && !sortedItems.length ? (
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
					))}
				</div>
			) : !sortedItems.length ? (
				<Card>
					<CardContent className="p-6 text-center">
						<p className="mb-2">Your feed is empty.</p>
						<p className="text-sm text-muted-foreground">
							Follow authors to see their latest posts and questions here.
						</p>
					</CardContent>
				</Card>
			) : (
				<>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
				>
					  {sortedItems.slice(0, visibleCount).map((it) => {
						const cover = it.image || it.imageUrl || "";
						const href =
							it.type === "post" ? `/blog/${it.slug || it.id}` : `/questions/${it.slug || it.id}`;
						const safeHTML = sanitize((it.content || "").slice(0, 220)) + (it.content ? "…" : "");
						return (
							<motion.article
								key={`${it.type}-${it.id}`}
								variants={itemVariants}
								className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow"
							>
								{cover ? (
									<Link href={href} className="block">
										<Image
											src={cover}
											alt={it.title}
											width={600}
											height={320}
											className="h-40 w-full object-cover"
										/>
									</Link>
								) : null}
								<div className="p-4 space-y-3">
									<div className="flex items-center justify-between gap-2">
										<Badge variant={it.type === "post" ? "default" : "secondary"}>
											{it.type === "post" ? "Post" : "Question"}
										</Badge>
										<span className="text-xs text-muted-foreground">
											{it.createdAt
												? format((it.createdAt as any)?.toDate?.() || (it.createdAt as any), "MMM d, yyyy")
												: ""}
										</span>
									</div>
									<h3 className="font-semibold leading-snug line-clamp-2">
										<Link href={href} className="hover:underline">
											{it.title}
										</Link>
									</h3>
									<div
										className="text-sm text-muted-foreground line-clamp-3"
										dangerouslySetInnerHTML={{ __html: safeHTML }}
									/>
									<div className="flex items-center gap-2 pt-2">
										<Avatar className="h-8 w-8">
											<AvatarImage src={it.avatarUrl || ""} alt={it.username || ""} />
											<AvatarFallback>
												{(it.username || "U").charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<Link href={`/user/${it.username || "unknown"}`} className="text-sm hover:underline">
											{it.username || "Unknown"}
										</Link>
									</div>
								</div>
							</motion.article>
							);
						})}
					</motion.div>
					{visibleCount < sortedItems.length && (
						<div className="flex justify-center mt-6">
							<Button variant="outline" onClick={() => setVisibleCount((c) => Math.min(c + 12, sortedItems.length))}>Load more</Button>
						</div>
					)}
					</>
				)}
				</div>
	);
}

function sortByDate(arr: FeedItem[]): FeedItem[] {
	return [...arr].sort((a, b) => {
		const ta = (a.createdAt as any)?.toDate?.()?.getTime?.() ?? new Date(a.createdAt || 0).getTime();
		const tb = (b.createdAt as any)?.toDate?.()?.getTime?.() ?? new Date(b.createdAt || 0).getTime();
		return tb - ta;
	});
}

function sortMerge(prev: FeedItem[], incoming: FeedItem[]): FeedItem[] {
	const byKey = new Map(prev.map((p) => [`${p.type}-${p.id}`, p] as const));
	for (const it of incoming) byKey.set(`${it.type}-${it.id}`, it);
	return sortByDate(Array.from(byKey.values()));
}

