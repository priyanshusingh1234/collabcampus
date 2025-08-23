import { NextRequest, NextResponse } from "next/server";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

export async function POST(req: NextRequest) {
  try {
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "Missing fileId" },
        { status: 400 }
      );
    }

    // Optional: Verify file exists (not strictly required)
    try {
      await imagekit.getFileDetails(fileId);
    } catch (err) {
      console.warn("File might not exist or is already deleted:", err);
      // Continue deletion attempt
    }

    // Attempt deletion
    await imagekit.deleteFile(fileId);

    return NextResponse.json({ 
      success: true,
      message: "File deleted successfully"
    });

  } catch (error: any) {
    console.error("ImageKit Delete Error:", error);
    return NextResponse.json(
      { 
        error: error.message || "Delete failed",
        help: "Ensure you are passing a valid fileId from the ImageKit upload response" 
      },
      { status: 500 }
    );
  }
}
