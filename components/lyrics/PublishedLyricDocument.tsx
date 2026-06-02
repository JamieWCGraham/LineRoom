import { parseDraftForDisplay } from "@/lib/lyrics/parseDraftForDisplay";
import "./published-lyrics.css";

type Props = {
  title: string;
  draftText: string;
};

export function PublishedLyricDocument({ title, draftText }: Props) {
  const trimmed = draftText.trim();
  const { sections } = parseDraftForDisplay(trimmed);

  return (
    <div className="published-lyrics-document">
      <h1 className="published-lyrics-title">{title}</h1>

      {trimmed ?
        <div className="published-lyrics-body">
          {sections.map((section, sectionIndex) => (
            <section
              key={`${section.label ?? "body"}-${sectionIndex}`}
              className="published-lyric-section"
            >
              {section.label ?
                <h2 className="published-section-label">{section.label}</h2>
              : null}
              {section.stanzas.map((stanza, stanzaIndex) => (
                <div
                  key={`${sectionIndex}-${stanzaIndex}`}
                  className="published-stanza"
                >
                  {stanza.map((line, lineIndex) => (
                    <p
                      key={`${stanzaIndex}-${lineIndex}`}
                      className="published-lyric-line"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      : <p className="published-lyrics-empty">No lyrics yet.</p>}
    </div>
  );
}
