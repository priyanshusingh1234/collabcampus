import { DocumentReference, updateDoc, arrayUnion } from "firebase/firestore";

// Central catalog for badge presentation
export const BADGES_CATALOG: Record<string, { icon: string; description: string; color: string }> = {
  // Answers
  "First Answer": { icon: "MessageSquare", description: "Posted your first answer.", color: "sky" },
  "Answered 10 Questions": { icon: "MessageSquareQuote", description: "Shared answers on 10 questions.", color: "blue" },
  "Answer Pro (50)": { icon: "MessagesSquare", description: "50 answers and counting.", color: "indigo" },
  "Answer Master (100)": { icon: "Medal", description: "100 answers—community legend.", color: "violet" },
  // Posts
  "First Post": { icon: "Feather", description: "Published your first article.", color: "emerald" },
  "Published 5 Posts": { icon: "PenSquare", description: "Shared 5 articles.", color: "green" },
  "Published 20 Posts": { icon: "ScrollText", description: "20 posts—prolific author.", color: "teal" },
  // Questions
  "First Question": { icon: "HelpCircle", description: "Asked your first question.", color: "amber" },
  "Curious Cat (10 Questions)": { icon: "CircleHelp", description: "Asked 10 thoughtful questions.", color: "orange" },
  "Curiosity Champion (50)": { icon: "Trophy", description: "50 questions—fueling discussions.", color: "yellow" },
  // Comments
  "First Comment": { icon: "MessageCircle", description: "Wrote your first comment.", color: "rose" },
  "Conversation Starter (25)": { icon: "MessageCircleMore", description: "25 comments—keeping threads active.", color: "pink" },
  "Community Voice (100)": { icon: "Megaphone", description: "100 comments—pillar of the community.", color: "fuchsia" },
  // Followers
  "10 Followers": { icon: "Users", description: "10 people follow your work.", color: "cyan" },
  "100 Followers": { icon: "UserRoundCheck", description: "100 followers—recognized expert.", color: "purple" },
  "500 Followers": { icon: "Award", description: "500 followers—thought leader.", color: "slate" },
};

export function getBadgeMeta(label: string) {
  return BADGES_CATALOG[label] || { icon: "BadgeCheck", description: label, color: "gray" };
}

// Threshold definitions per stat
const ANSWER_THRESHOLDS = [
  { threshold: 1, label: "First Answer" },
  { threshold: 10, label: "Answered 10 Questions" },
  { threshold: 50, label: "Answer Pro (50)" },
  { threshold: 100, label: "Answer Master (100)" },
];
const POST_THRESHOLDS = [
  { threshold: 1, label: "First Post" },
  { threshold: 5, label: "Published 5 Posts" },
  { threshold: 20, label: "Published 20 Posts" },
];
const QUESTION_THRESHOLDS = [
  { threshold: 1, label: "First Question" },
  { threshold: 10, label: "Curious Cat (10 Questions)" },
  { threshold: 50, label: "Curiosity Champion (50)" },
];
const COMMENT_THRESHOLDS = [
  { threshold: 1, label: "First Comment" },
  { threshold: 25, label: "Conversation Starter (25)" },
  { threshold: 100, label: "Community Voice (100)" },
];
const FOLLOWER_THRESHOLDS = [
  { threshold: 10, label: "10 Followers" },
  { threshold: 100, label: "100 Followers" },
  { threshold: 500, label: "500 Followers" },
];

function computeByThresholds(count: number, thresholds: { threshold: number; label: string }[]) {
  return thresholds.filter((t) => count >= t.threshold).map((t) => t.label);
}

export function computeAnswerBadges(count: number): string[] {
  return computeByThresholds(count, ANSWER_THRESHOLDS);
}
export function computePostBadges(count: number): string[] {
  return computeByThresholds(count, POST_THRESHOLDS);
}
export function computeQuestionBadges(count: number): string[] {
  return computeByThresholds(count, QUESTION_THRESHOLDS);
}
export function computeCommentBadges(count: number): string[] {
  return computeByThresholds(count, COMMENT_THRESHOLDS);
}
export function computeFollowerBadges(count: number): string[] {
  return computeByThresholds(count, FOLLOWER_THRESHOLDS);
}

async function awardNewBadges(
  userRef: DocumentReference,
  currentBadges: string[] | undefined,
  targetLabels: string[]
) {
  const existing = currentBadges || [];
  const newlyEarned = targetLabels.filter((l) => !existing.includes(l));
  if (!newlyEarned.length) return;
  await updateDoc(userRef, { badges: arrayUnion(...newlyEarned) });
}

export async function awardAnswerBadges(options: { userRef: DocumentReference; currentBadges?: string[]; nextAnswerCount: number; }) {
  const labels = computeAnswerBadges(options.nextAnswerCount);
  await awardNewBadges(options.userRef, options.currentBadges, labels);
}
export async function awardPostBadges(options: { userRef: DocumentReference; currentBadges?: string[]; nextPostCount: number; }) {
  const labels = computePostBadges(options.nextPostCount);
  await awardNewBadges(options.userRef, options.currentBadges, labels);
}
export async function awardQuestionBadges(options: { userRef: DocumentReference; currentBadges?: string[]; nextQuestionCount: number; }) {
  const labels = computeQuestionBadges(options.nextQuestionCount);
  await awardNewBadges(options.userRef, options.currentBadges, labels);
}
export async function awardCommentBadges(options: { userRef: DocumentReference; currentBadges?: string[]; nextCommentCount: number; }) {
  const labels = computeCommentBadges(options.nextCommentCount);
  await awardNewBadges(options.userRef, options.currentBadges, labels);
}
export async function awardFollowerBadges(options: { userRef: DocumentReference; currentBadges?: string[]; nextFollowerCount: number; }) {
  const labels = computeFollowerBadges(options.nextFollowerCount);
  await awardNewBadges(options.userRef, options.currentBadges, labels);
}
