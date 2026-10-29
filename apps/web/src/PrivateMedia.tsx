import { useEffect, useState } from "react";
interface Media {
  id: string;
  mime: string;
  size: number;
}
export function PrivateMedia({ base }: { base: string }) {
  const [files, setFiles] = useState<Media[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const r = await fetch(base + "/media");
    if (!r.ok) throw Error("Unable to load private files");
    setFiles(await r.json());
  }
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [base]);
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      if (
        file.size > 5 * 1024 * 1024 ||
        !["image/png", "image/jpeg"].includes(file.type)
      )
        throw Error("Choose a PNG or JPEG up to 5 MB.");
      const r = await fetch(base + "/media", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!r.ok) throw Error((await r.json()).error);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      const r = await fetch(base + "/media/" + id, { method: "DELETE" });
      if (!r.ok) throw Error("Deletion failed");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>My private images</h2>
      <p>
        PNG or JPEG, up to 5 MB each. Only you can access these files.
        Examination sharing is not enabled yet.
      </p>
      {error && <p role="alert">{error}</p>}
      <input
        aria-label="Private image"
        type="file"
        accept="image/png,image/jpeg"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {!files.length && <p>No private images uploaded.</p>}
      {files.map((f) => (
        <article key={f.id}>
          <a href={base + "/media/" + f.id}>
            Download {f.mime === "image/png" ? "PNG" : "JPEG"} ·{" "}
            {Math.ceil(f.size / 1024)} KB
          </a>
          <button disabled={busy} onClick={() => remove(f.id)}>
            Delete
          </button>
        </article>
      ))}
    </section>
  );
}
