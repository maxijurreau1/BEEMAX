import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request, type Item } from "../api";

/** Loads the public art and asset catalog from the marketplace Worker. */
export function ArtGallery() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    request<{ items: Item[] }>("/api/art?limit=24", { signal: controller.signal })
      .then(({ items: artItems }) => {
        setItems(artItems);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <section aria-labelledby="art-gallery-title">
      <div className="section-heading">
        <div className="eyebrow">MAX-ART · CREATOR SHOWCASE</div>
        <h2 id="art-gallery-title">Art &amp; assets</h2>
      </div>
      {status === "loading" && (
        <p className="notice" role="status">Loading the art catalog…</p>
      )}
      {status === "error" && (
        <p className="notice error" role="alert">
          The art catalog is temporarily unavailable.
        </p>
      )}
      {status === "ready" && (items.length ? (
        <div className="products-grid">
          {items.map((item) => (
            <Link
              className={`product-card ${item.type}`}
              key={item.id}
              to={`/product/${item.slug}`}
            >
              <div className="product-art" aria-hidden="true">
                <span>{item.title.slice(0, 1)}</span>
                <small>{item.type}</small>
              </div>
              <div className="product-copy">
                <span className="creator">{item.creatorName}</span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>No art releases yet</h3>
          <p>Published art and assets will appear here.</p>
        </div>
      ))}
    </section>
  );
}
