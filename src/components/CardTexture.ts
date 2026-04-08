import * as THREE from "three";

/**
 * Generates a CanvasTexture for the liquid-glass badge face.
 * Renders Franklin's credentials, stats, and iridescent styling onto a 2D canvas,
 * which then gets mapped onto the 3D card mesh.
 * Returns a texture that auto-updates when the profile photo loads.
 */
export function createCardTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // --- Background: dark frosted glass ---
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "rgba(17,17,23,0.95)");
  bg.addColorStop(0.5, "rgba(22,22,30,0.92)");
  bg.addColorStop(1, "rgba(15,15,20,0.95)");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, w, h, 24);
  ctx.fill();

  // --- Iridescent sheen gradient overlay ---
  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, "rgba(91,184,212,0.08)");
  sheen.addColorStop(0.3, "rgba(167,139,250,0.05)");
  sheen.addColorStop(0.6, "rgba(91,184,212,0.06)");
  sheen.addColorStop(1, "rgba(167,139,250,0.04)");
  ctx.fillStyle = sheen;
  roundRect(ctx, 0, 0, w, h, 24);
  ctx.fill();

  // --- 1px iridescent border ---
  const borderGrad = ctx.createLinearGradient(0, 0, w, h);
  borderGrad.addColorStop(0, "rgba(91,184,212,0.4)");
  borderGrad.addColorStop(0.5, "rgba(167,139,250,0.3)");
  borderGrad.addColorStop(1, "rgba(91,184,212,0.35)");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, w - 2, h - 2, 23);
  ctx.stroke();

  // --- Top: CLEARED badge ---
  ctx.fillStyle = "rgba(91,184,212,0.12)";
  roundRect(ctx, w - 100, 16, 84, 22, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(91,184,212,0.3)";
  ctx.lineWidth = 1;
  roundRect(ctx, w - 100, 16, 84, 22, 4);
  ctx.stroke();
  ctx.fillStyle = "#5bb8d4";
  ctx.font = '500 9px "JetBrains Mono", monospace';
  ctx.letterSpacing = "2px";
  ctx.fillText("CLEARED", w - 92, 31);

  // --- Photo area ---
  const photoY = 50;
  const photoH = 220;
  const photoW = w - 64;
  const photoX = 32;

  // Draw placeholder gradient first
  const photoGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH);
  photoGrad.addColorStop(0, "rgba(91,184,212,0.1)");
  photoGrad.addColorStop(1, "rgba(167,139,250,0.08)");
  ctx.fillStyle = photoGrad;
  roundRect(ctx, photoX, photoY, photoW, photoH, 16);
  ctx.fill();

  // FC initials as fallback
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.font = 'italic 80px "Instrument Serif", Georgia, serif';
  ctx.textAlign = "center";
  ctx.fillText("FC", w / 2, photoY + photoH / 2 + 28);
  ctx.textAlign = "left";

  // --- Name ---
  const nameY = photoY + photoH + 40;
  ctx.fillStyle = "#ffffff";
  ctx.font = '400 32px "Instrument Serif", Georgia, serif';
  ctx.fillText("Franklin Cheng", 32, nameY);

  // --- Title ---
  ctx.fillStyle = "#8a8a95";
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillText("STRATEGIST & PRODUCT BUILDER", 32, nameY + 24);

  // --- Divider ---
  const divY = nameY + 44;
  const divGrad = ctx.createLinearGradient(32, divY, w - 32, divY);
  divGrad.addColorStop(0, "transparent");
  divGrad.addColorStop(0.5, "rgba(120,200,255,0.2)");
  divGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, divY);
  ctx.lineTo(w - 32, divY);
  ctx.stroke();

  // --- Stats Grid ---
  const statsY = divY + 24;
  const stats = [
    { label: "ORG", value: "Sia Partners" },
    { label: "DEGREE", value: "UPenn PPE" },
    { label: "FOCUS", value: "AI + GTM" },
    { label: "GPA", value: "3.85" },
    { label: "CLIENTS", value: "F500" },
    { label: "LOCATION", value: "Los Angeles" },
  ];

  const colW = (w - 64) / 2;
  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 32 + col * colW;
    const y = statsY + row * 48;

    ctx.fillStyle = "#55555f";
    ctx.font = '500 8px "JetBrains Mono", monospace';
    ctx.fillText(s.label, x, y);

    ctx.fillStyle = "#b0b0b8";
    ctx.font = '400 13px "Satoshi", sans-serif';
    ctx.fillText(s.value, x, y + 16);
  });

  // --- Bottom divider ---
  const bottomDivY = h - 52;
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, bottomDivY);
  ctx.lineTo(w - 32, bottomDivY);
  ctx.stroke();

  // --- Bottom: ID + dots ---
  ctx.fillStyle = "#55555f";
  ctx.font = '500 9px "JetBrains Mono", monospace';
  ctx.fillText("ID-FC-2025", 32, h - 28);

  // Rating dots
  const dotColors = ["#5bb8d4", "#5bb8d4", "#5bb8d4", "#5bb8d4", "#55555f"];
  dotColors.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(w - 32 - i * 14, h - 32, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // --- Noise grain overlay ---
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;

  // Async: load profile photo and redraw over the placeholder
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    // Save current canvas state
    ctx.save();
    // Clip to rounded rect
    roundRect(ctx, photoX, photoY, photoW, photoH, 16);
    ctx.clip();
    // Draw photo covering the area (object-fit: cover)
    const imgAspect = img.width / img.height;
    const areaAspect = photoW / photoH;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > areaAspect) {
      sw = img.height * areaAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / areaAspect;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
    // Subtle dark overlay for contrast with text below
    const overlay = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH);
    overlay.addColorStop(0, "rgba(0,0,0,0)");
    overlay.addColorStop(0.7, "rgba(0,0,0,0)");
    overlay.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = overlay;
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.restore();
    // Update the texture
    texture.needsUpdate = true;
  };
  img.src = "/assets/profile-card.jpg";

  return texture;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
