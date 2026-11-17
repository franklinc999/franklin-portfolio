"use client";

import { useEffect, useRef } from "react";
import {
  LiquidMetalShapes,
  ShaderFitOptions,
  ShaderMount,
  getShaderColorFromString,
  liquidMetalFragmentShader,
} from "@paper-design/shaders";
import { useMotionOff } from "@/lib/useReducedMotion";

const SPEED = 0.5;

/*
  The shader is Paper's Liquid Metal (Apache 2.0, https://shaders.paper.design), with one change.
  The stock shader calls smoothstep with both edges at zero, which GLSL leaves undefined: most
  graphics chips answer with a hard step, some answer with nothing and the mark disappears. A hair
  of width makes the answer the same everywhere.
*/
const FRAGMENT = liquidMetalFragmentShader.replace("getImgFrame(v_imageUV, 0.)", "getImgFrame(v_imageUV, 0.002)");

/**
 * The seal on the badge: an FC mark poured in liquid metal, the way an ID card carries a foil
 * stamp over the corner of its photo.
 *
 * Paper's own component works the mark's edges out in the browser on every visit. Here that was
 * done once, ahead of time (public/assets/fc-mark-metal.png is the result, made from fc-mark.svg),
 * so a phone only has to load a small image and run the shader.
 */
export default function Seal() {
  const hostRef = useRef<HTMLSpanElement>(null);
  const mountRef = useRef<ShaderMount | null>(null);
  const still = useMotionOff();
  const stillRef = useRef(still);

  useEffect(() => {
    stillRef.current = still;
    mountRef.current?.setSpeed(still ? 0 : SPEED);
  }, [still]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let gone = false;
    let mount: ShaderMount | null = null;
    const img = new Image();
    img.onload = () => {
      if (gone) return;
      try {
        mount = new ShaderMount(
          host,
          FRAGMENT,
          {
            u_colorBack: getShaderColorFromString("#00000000"),
            u_colorTint: getShaderColorFromString("#ffffff"),
            u_image: img,
            u_contour: 0.62,
            u_distortion: 0.09,
            u_softness: 0.22,
            u_repetition: 2.4,
            u_shiftRed: 0.34,
            u_shiftBlue: 0.34,
            u_angle: 62,
            u_isImage: true,
            u_shape: LiquidMetalShapes.none,
            u_fit: ShaderFitOptions.contain,
            u_scale: 0.74,
            u_rotation: 0,
            u_offsetX: 0,
            u_offsetY: 0,
            u_originX: 0.5,
            u_originY: 0.5,
            u_worldWidth: 0,
            u_worldHeight: 0,
          },
          undefined,
          stillRef.current ? 0 : SPEED,
          0,
          2,
          360 * 360,
          ["u_image"],
        );
        mountRef.current = mount;
        host.setAttribute("data-ready", "");
      } catch {
        // No WebGL: the flat mark underneath stays.
      }
    };
    img.src = "/assets/fc-mark-metal.png";
    return () => {
      gone = true;
      mount?.dispose();
      mountRef.current = null;
    };
  }, []);

  return <span ref={hostRef} className="badge-seal-metal" />;
}
