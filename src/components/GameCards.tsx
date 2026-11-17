import { GlassLink } from "@/components/Glass";
import { GAMES } from "@/lib/games";

/** One picture-led card per game. `as` sets the heading level for the page it sits on. */
export function GameCards({ as: Heading = "h3", lazy = false }: { as?: "h2" | "h3"; lazy?: boolean }) {
  return (
    <div className={`card-grid ${GAMES.length === 1 ? "one" : "two"}`}>
      {GAMES.map((game) => (
        <GlassLink key={game.slug} href={`/play/${game.slug}`} className="shot">
          <span className="shot-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/assets/shots/${game.slug}.jpg`} alt={game.alt} width={1200} height={750} loading={lazy ? "lazy" : undefined} />
          </span>
          <div className="shot-body">
            <Heading className="h3">{game.name}</Heading>
            <p className="meta">{game.kind}</p>
            <p>{game.blurb}</p>
            <p className="meta">{game.needs}</p>
          </div>
        </GlassLink>
      ))}
    </div>
  );
}
