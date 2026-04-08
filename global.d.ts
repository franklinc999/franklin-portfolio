declare module "meshline" {
  export class MeshLineGeometry {
    setPoints(points: import("three").Vector3[]): void;
  }
  export class MeshLineMaterial {
    constructor(parameters?: Record<string, unknown>);
  }
}
