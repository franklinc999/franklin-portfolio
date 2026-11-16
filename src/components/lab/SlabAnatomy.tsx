import { PRESETS } from "@/lib/field/engine";

const R1 = 28; // corner radius of a panel, from .glass in globals.css

/**
 * A dimensional drawing of one glass slab, in the manner of a component spec
 * sheet: plan view, section, a detail of the corner, and the variables that
 * drive the shader. The numbers are read from the live presets, so the
 * drawing cannot drift from what the site renders.
 */
export function SlabAnatomy() {
  const p = PRESETS.panel;
  const rows = [
    ["R1", `${R1}`, "corner radius"],
    ["B", `${p.bezel}`, "bezel width"],
    ["R2", `${Math.max(R1, p.bezel)}`, "inner profile, max(R1, B)"],
    ["S", `${p.strength}`, "bend, as a share of B"],
    [
      "S·B",
      `${(p.strength * p.bezel).toFixed(1)}`,
      "furthest a point is shifted",
    ],
    ["F", `${p.frost}`, "frost at the centre"],
    ["Z", `${p.zoom}`, "magnification"],
  ];

  return (
    <figure className="anatomy">
      <div
        className="anatomy-sheet"
        tabIndex={0}
        role="group"
        aria-label="Drawing of a glass slab. Scrolls sideways on small screens."
      >
        <svg
          viewBox="0 0 640 392"
          role="img"
          aria-labelledby="anatomy-title anatomy-desc"
        >
          <title id="anatomy-title">Anatomy of a glass slab</title>
          <desc id="anatomy-desc">
            A plan view with the bezel band marked, a section showing light
            bending inward at the bezel, and a detail of the corner radii.
          </desc>
          <defs>
            <pattern
              id="hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="6" className="an-hatch" />
            </pattern>
            <marker
              id="tick"
              viewBox="0 0 8 8"
              refX="4"
              refY="4"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M1 7 L7 1" className="an-tick" />
            </marker>
          </defs>

          {/* Title block */}
          <text x="16" y="24" className="an-title">
            GLASS-SLAB-001
          </text>
          <text x="16" y="42" className="an-note">
            kind: panel · units: css px · not to scale
          </text>

          {/* Plan view */}
          <text x="16" y="68" className="an-view">
            PLAN
          </text>
          <rect
            x="40"
            y="100"
            width="250"
            height="150"
            rx="26"
            pathLength={1}
            className="an-line an-heavy"
          />
          <path
            fillRule="evenodd"
            d="M66 100 H264 A26 26 0 0 1 290 126 V224 A26 26 0 0 1 264 250 H66 A26 26 0 0 1 40 224 V126 A26 26 0 0 1 66 100 Z M104 134 H226 A34 34 0 0 1 260 168 V182 A34 34 0 0 1 226 216 H104 A34 34 0 0 1 70 182 V168 A34 34 0 0 1 104 134 Z"
            fill="url(#hatch)"
          />
          <rect
            x="70"
            y="134"
            width="190"
            height="82"
            rx="34"
            className="an-line an-dash"
          />
          <text x="165" y="179" textAnchor="middle" className="an-note">
            frost F
          </text>
          {/* width */}
          <line
            x1="40"
            y1="272"
            x2="290"
            y2="272"
            pathLength={1}
            className="an-line"
            markerStart="url(#tick)"
            markerEnd="url(#tick)"
          />
          <line
            x1="40"
            y1="256"
            x2="40"
            y2="280"
            pathLength={1}
            className="an-thin"
          />
          <line
            x1="290"
            y1="256"
            x2="290"
            y2="280"
            pathLength={1}
            className="an-thin"
          />
          <text x="165" y="290" textAnchor="middle" className="an-dim">
            W · FILL
          </text>
          {/* bezel */}
          <line
            x1="40"
            y1="88"
            x2="70"
            y2="88"
            pathLength={1}
            className="an-line"
            markerStart="url(#tick)"
            markerEnd="url(#tick)"
          />
          <line
            x1="70"
            y1="82"
            x2="70"
            y2="134"
            pathLength={1}
            className="an-thin"
          />
          <text x="55" y="80" textAnchor="middle" className="an-dim">
            B
          </text>
          {/* radius leader */}
          <path d="M271 119 L306 84 H330" pathLength={1} className="an-line" />
          <text x="334" y="88" className="an-dim">
            R1
          </text>

          {/* Section */}
          <text x="372" y="68" className="an-view">
            SECTION
          </text>
          <path
            d="M384 170 C384 138 398 128 426 128 H566 C594 128 608 138 608 170"
            pathLength={1}
            className="an-line an-heavy"
          />
          <line
            x1="372"
            y1="170"
            x2="620"
            y2="170"
            pathLength={1}
            className="an-line"
          />
          <line
            x1="372"
            y1="176"
            x2="620"
            y2="176"
            className="an-thin an-dash"
          />
          {/* a ray through the middle goes straight; one through the bezel bends in */}
          <path d="M496 96 V170" pathLength={1} className="an-ray" />
          <path d="M398 96 V140 L420 170" pathLength={1} className="an-ray" />
          <path d="M594 96 V140 L572 170" pathLength={1} className="an-ray" />
          <circle cx="398" cy="140" r="2.4" className="an-dot" />
          <circle cx="594" cy="140" r="2.4" className="an-dot" />
          <line
            x1="398"
            y1="188"
            x2="420"
            y2="188"
            pathLength={1}
            className="an-line"
            markerStart="url(#tick)"
            markerEnd="url(#tick)"
          />
          <text x="409" y="204" textAnchor="middle" className="an-dim">
            S·B
          </text>
          <text x="438" y="204" className="an-note">
            centre: straight through
          </text>
          <text x="372" y="226" className="an-note">
            bezel: light bends inward, so the rim
          </text>
          <text x="372" y="242" className="an-note">
            shows what sits deeper under the slab
          </text>

          {/* Corner detail */}
          <text x="372" y="282" className="an-view">
            DETAIL A · CORNER
          </text>
          <circle cx="420" cy="328" r="38" pathLength={1} className="an-line" />
          <path
            d="M396 358 V328 A28 28 0 0 1 424 300 H452"
            pathLength={1}
            className="an-line an-heavy"
          />
          <path
            d="M412 362 V340 A24 24 0 0 1 436 316 H456"
            className="an-line an-dash"
          />
          <text x="472" y="312" className="an-dim">
            R1 outer edge
          </text>
          <text x="472" y="332" className="an-dim">
            R2 inner profile
          </text>
          <text x="472" y="352" className="an-note">
          R2 = max(R1, B), so a
        </text>
        <text x="472" y="366" className="an-note">
          wide bezel still turns
        </text>
        <text x="472" y="380" className="an-note">
          the corner smoothly
        </text>
          <circle cx="271" cy="119" r="9" pathLength={1} className="an-thin" />
          <text x="297" y="127" className="an-note">
          A
        </text>
        </svg>
      </div>

      <figcaption>
        <table className="anatomy-table">
          <caption className="sr-only">Variables for a panel slab</caption>
          <tbody>
            {rows.map(([name, value, what]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{value}</td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
