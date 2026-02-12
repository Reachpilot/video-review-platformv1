"use client";

import React from "react";

export default function SimpleVideoUpload() {
  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    form.append(
      "upload_preset",
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
    );

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`,
      { method: "POST", body: form }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      alert("Upload fehlgeschlagen: " + res.status + " " + txt);
      return;
    }

    const data = await res.json();
    alert("Upload fertig:\n" + data.secure_url);
  }

  return (
    <div>
      <input type="file" accept="video/*" onChange={handleChange} />
    </div>
  );
}
