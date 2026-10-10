import { describe, expect, it } from "vitest";
import { limitaZoom, percentualeZoom, trattieni, versoSchema, vistaAdattata, zoomAttorno } from "./schemaVista";

const SCHEMA = { larghezza: 1600, altezza: 830 };

describe("vistaAdattata", () => {
  it("in un riquadro largo e basso decide l'altezza, e lo schema sta al centro", () => {
    const v = vistaAdattata({ larghezza: 2000, altezza: 463 }, SCHEMA, 24);
    expect(v.k).toBeCloseTo(0.5);
    expect(v.x).toBeCloseTo((2000 - 800) / 2);
    expect(v.y).toBeCloseTo(24);
  });

  it("in un riquadro stretto e alto decide la larghezza", () => {
    const v = vistaAdattata({ larghezza: 848, altezza: 2000 }, SCHEMA, 24);
    expect(v.k).toBeCloseTo(0.5);
    expect(v.x).toBeCloseTo(24);
    expect(v.y).toBeCloseTo((2000 - 415) / 2);
  });

  it("un riquadro più piccolo del margine non dà un ingrandimento negativo o nullo", () => {
    expect(vistaAdattata({ larghezza: 10, altezza: 10 }, SCHEMA).k).toBeGreaterThan(0);
  });
});

describe("limitaZoom", () => {
  it("lascia passare un valore fra metà e otto volte la misura adattata", () => {
    expect(limitaZoom(1, 0.5)).toBe(1);
  });
  it("ferma chi rimpicciolisce a metà e chi ingrandisce a otto volte", () => {
    expect(limitaZoom(0.01, 0.5)).toBe(0.25);
    expect(limitaZoom(100, 0.5)).toBe(4);
  });
});

describe("zoomAttorno", () => {
  it("il punto dello schema sotto il mouse resta sotto il mouse", () => {
    const vista = { x: 40, y: 30, k: 0.5 };
    const perno = { x: 300, y: 200 };
    const prima = versoSchema(vista, perno);
    const dopo = zoomAttorno(vista, perno, 2);
    expect(dopo.k).toBe(2);
    expect(versoSchema(dopo, perno).x).toBeCloseTo(prima.x);
    expect(versoSchema(dopo, perno).y).toBeCloseTo(prima.y);
  });
});

describe("trattieni", () => {
  const area = { larghezza: 1000, altezza: 600 };

  it("non tocca una vista che sta dentro il riquadro", () => {
    const vista = { x: 100, y: 50, k: 0.5 };
    expect(trattieni(vista, area, SCHEMA)).toEqual(vista);
  });

  it("trascinato troppo a destra o in basso, lo schema lascia dentro 80 pixel", () => {
    expect(trattieni({ x: 5000, y: 5000, k: 0.5 }, area, SCHEMA)).toEqual({ x: 920, y: 520, k: 0.5 });
  });

  it("trascinato troppo a sinistra o in alto, lo schema lascia dentro 80 pixel", () => {
    // Schema a 0,5: 800 x 415.
    expect(trattieni({ x: -5000, y: -5000, k: 0.5 }, area, SCHEMA)).toEqual({ x: 80 - 800, y: 80 - 415, k: 0.5 });
  });

  it("uno schema più piccolo di 80 pixel resta tutto dentro", () => {
    const v = trattieni({ x: -5000, y: 0, k: 0.025 }, area, SCHEMA); // largo 40
    expect(v.x).toBe(0);
  });
});

describe("percentualeZoom", () => {
  it("100 quando lo schema è adattato al riquadro", () => {
    expect(percentualeZoom(0.72, 0.72)).toBe(100);
    expect(percentualeZoom(1.44, 0.72)).toBe(200);
  });
});
