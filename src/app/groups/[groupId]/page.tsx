// app/groups/[groupId]/page.tsx
import { getAdminDb } from "@/lib/firebaseAdmin";
import GroupPage from "./GroupPage"; // Normal import, no dynamic or ssr: false

export async function generateMetadata({ params }: any) {
  const resolved = params && typeof params.then === "function" ? await params : params;
  const groupId = resolved?.groupId as string;

  let metaTitle = "Group | CollabCampus";
  let metaDescription = "View and join group on CollabCampus.";

  try {
    const adminDb = getAdminDb();
    const snap = await adminDb.collection("groups").doc(groupId).get();
    if (snap.exists) {
      const groupData = snap.data() as any;
      metaTitle = `${groupData.name} | Group on CollabCampus`;
      metaDescription = groupData.description || metaDescription;
    }
  } catch {
    // fallback metadata if fetch fails
  }

  return {
    title: metaTitle,
    description: metaDescription,
    openGraph: {
      title: metaTitle,
      description: metaDescription,
    },
  };
}

export default function GroupPageWrapper({ params }: any) {
  const groupId = (params && (params as any).groupId) ?? undefined;
  return <GroupPage groupId={groupId} />;
}
