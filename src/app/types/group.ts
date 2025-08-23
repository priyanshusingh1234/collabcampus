export interface Group {
  id?: string; // optional when creating
  name: string;
  description: string;
  imageUrl?: string;
  createdAt: any;
  createdBy: string;
  members: string[];
  admins: string[];
  // New
  requests?: string[]; // pending join requests (uids)
  announcements?: Array<{ id: string; message: string; createdAt: any; author: string }>;
}
