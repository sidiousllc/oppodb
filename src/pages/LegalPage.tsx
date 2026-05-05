import { useParams, Link } from "react-router-dom";
import { LegalDocWindow } from "@/components/LegalDocWindow";
import { LEGAL_DOC_LIST, LEGAL_DOCS, type LegalDocId } from "@/data/legal";
import { Win98Window } from "@/components/Win98Window";

const SLUG_TO_ID: Record<string, LegalDocId> = {
  terms: "terms",
  privacy: "privacy",
  refund: "refund",
  refunds: "refund",
  "acceptable-use": "aup",
  aup: "aup",
};

export default function LegalPage() {
  const { slug } = useParams<{ slug?: string }>();
  const docId: LegalDocId = (slug && SLUG_TO_ID[slug]) || "terms";
  const doc = LEGAL_DOCS[docId];

  // Set page title for SEO
  if (typeof document !== "undefined") {
    document.title = `${doc.title} — ORO`;
  }

  return (
    <div className="min-h-screen bg-[hsl(180,50%,50%)] p-4">
      <div className="max-w-[860px] mx-auto">
        <Win98Window
          title={`${doc.title} — Opposition Research Database`}
          icon={<span className="text-[12px]">{doc.icon}</span>}
        >
          <div className="bg-[hsl(var(--win98-face))]">
            <nav className="flex flex-wrap gap-1 p-2 border-b border-[hsl(var(--win98-shadow))]">
              {LEGAL_DOC_LIST.map((d) => (
                <Link
                  key={d.id}
                  to={`/legal/${d.slug}`}
                  className={`win98-button text-[11px] px-2 py-0.5 ${
                    d.id === docId ? "font-bold" : ""
                  }`}
                >
                  {d.icon} {d.title}
                </Link>
              ))}
              <Link to="/" className="win98-button text-[11px] px-2 py-0.5 ml-auto">
                ← Back to app
              </Link>
            </nav>
            <div style={{ height: "calc(100vh - 200px)", minHeight: 480 }}>
              <LegalDocWindow docId={docId} />
            </div>
          </div>
        </Win98Window>
        <p className="text-center text-[10px] text-white mt-2">
          {LEGAL_DOC_LIST.map((d, i) => (
            <span key={d.id}>
              {i > 0 && " · "}
              <Link to={`/legal/${d.slug}`} className="underline">
                {d.title}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
