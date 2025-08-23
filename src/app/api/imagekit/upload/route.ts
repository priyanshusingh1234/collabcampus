import { NextRequest, NextResponse } from "next/server";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

// Updated folders
type ValidFolder = 'avatars' | 'posts' | 'questions' | 'stories' | 'temp' | 'banners';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File;
  const fileName = (form.get("fileName") as string) || `upload-${Date.now()}`;
  let folder = (form.get("folder") as ValidFolder) || "posts";

  if (!['avatars', 'posts', 'questions', 'stories', 'temp', 'banners'].includes(folder)) {
    return NextResponse.json({ error: "Invalid folder specified" }, { status: 400 });
  }

  folder = folder.replace(/^\//, '') as ValidFolder;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const response = await imagekit.upload({
      file: buffer,
      fileName,
      folder,
      useUniqueFileName: true,
    });

    return NextResponse.json({
      success: true,
      url: response.url,
      fileId: response.fileId,
      filePath: response.filePath,
    });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
