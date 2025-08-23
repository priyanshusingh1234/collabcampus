// app/groups/[groupId]/info/page.tsx
import { getAdminDb } from "@/lib/firebaseAdmin";
import GroupInfoPage from "./GroupInfoPage";

export async function generateMetadata({ params }: any) {
  const resolved = params && typeof params.then === "function" ? await params : params;
  const groupId = resolved?.groupId as string;
  let title = "Group Information | CollabCampus";
  let description = "View group details and manage members.";

  try {
    const adminDb = getAdminDb();
    const snap = await adminDb.collection("groups").doc(groupId).get();
    if (snap.exists) {
      const groupData = snap.data() as any;
      if (groupData.name) {
        title = `${groupData.name} | Group Information | CollabCampus`;
      }
      if (groupData.description) {
        description = groupData.description;
      }
    }
  } catch {
    // fallback values used if error happens
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export default function GroupInfoWrapper() {
  return <GroupInfoPage />;
}
