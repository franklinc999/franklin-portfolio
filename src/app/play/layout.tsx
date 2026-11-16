import { GameFonts } from "@/components/game/GameFonts";
import "./game-fonts.css";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GameFonts />
      {children}
    </>
  );
}
