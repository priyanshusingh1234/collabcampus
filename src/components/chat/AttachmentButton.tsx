"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";
import { toast } from "sonner";

export type AttachmentMeta = {
	url: string;
	secureUrl: string;
	publicId: string;
	resourceType: "image" | "video" | "raw" | "auto";
	bytes: number;
	width?: number;
	height?: number;
	format?: string;
	originalFilename?: string;
};

export type AttachmentButtonProps = {
	onUploaded?: (file: AttachmentMeta) => void;
	onPicked?: (file: File, previewUrl: string) => void;
	deferred?: boolean; // when true, don't upload automatically; call onPicked with File + preview URL
	folder?: string;
	accept?: string;
	disabled?: boolean;
	title?: string;
};

export default function AttachmentButton({ onUploaded, onPicked, deferred = false, folder = "chat", accept = "image/*,video/*,application/pdf", disabled, title = "Attach" }: AttachmentButtonProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);

	function handleChoose() {
		inputRef.current?.click();
	}

	async function handleFiles(files: FileList | null) {
		if (!files || !files.length) return;
		const file = files[0];
		try {
			if (deferred && onPicked) {
				// Create a local preview and let the parent decide when to upload
				const url = URL.createObjectURL(file);
				onPicked(file, url);
				if (inputRef.current) inputRef.current.value = "";
				return;
			}
			setBusy(true);
			const signRes = await fetch("/api/cloudinary-sign", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ folder, resource_type: "auto" }),
			});
			const signed = await signRes.json();
			if (!signRes.ok) throw new Error(signed?.error || "Sign failed");

			const form = new FormData();
			form.append("file", file);
			form.append("api_key", signed.apiKey);
			form.append("timestamp", String(signed.timestamp));
			form.append("signature", signed.signature);
			if (signed.folder) form.append("folder", signed.folder);

			const uploadUrl = `https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`;
			const upRes = await fetch(uploadUrl, { method: "POST", body: form });
			const up = await upRes.json();
			if (!upRes.ok) throw new Error(up?.error?.message || "Upload failed");

			onUploaded && onUploaded({
				url: up.url,
				secureUrl: up.secure_url,
				publicId: up.public_id,
				resourceType: up.resource_type,
				bytes: up.bytes,
				width: up.width,
				height: up.height,
				format: up.format,
				originalFilename: up.original_filename,
			});
			toast.success("Uploaded");
		} catch (e: any) {
			console.error(e);
			toast.error(e?.message || "Upload failed");
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	return (
		<>
			<input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
			<Button type="button" size="icon" variant="ghost" onClick={handleChoose} disabled={disabled || busy} title={title} aria-label={title}>
				<Icons.Paperclip className="h-5 w-5" />
			</Button>
		</>
	);
}
