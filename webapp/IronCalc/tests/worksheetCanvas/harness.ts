// Renders a model through the real WorksheetCanvas onto a real (Skia-backed)
// canvas in node — no browser involved. The bundled DejaVu Sans is the only
// font, so the output is identical on every machine.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { initSync, Model } from "@ironcalc/wasm";
import { type Canvas, createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { WorkbookState } from "../../src/components/workbookState";
import { FakeCanvasElement, FakeElement, installDomGlobals } from "./fakeDom";

// Rendered at 2x, like a retina display: crisper screenshots to review
const DEVICE_PIXEL_RATIO = 2;

let wasmLoaded = false;

export async function newModel(): Promise<Model> {
  if (!wasmLoaded) {
    const buffer = await readFile("node_modules/@ironcalc/wasm/wasm_bg.wasm");
    initSync({ module: buffer });
    GlobalFonts.registerFromPath(
      fileURLToPath(new URL("fonts/DejaVuSans.ttf", import.meta.url)),
      "TestFont",
    );
    wasmLoaded = true;
  }
  return new Model("workbook", "en", "UTC", "en");
}

export interface RenderOptions {
  // 430x230 fits the 30px/28px headers plus four 100px columns and eight
  // 25px rows
  width?: number;
  height?: number;
}

export async function renderToCanvas(
  model: Model,
  options: RenderOptions = {},
): Promise<Canvas> {
  installDomGlobals(DEVICE_PIXEL_RATIO);
  // Imported dynamically: the module reads `window` at load time, so the
  // fake DOM globals must be installed first
  const { default: WorksheetCanvas } = await import(
    "../../src/components/WorksheetCanvas/worksheetCanvas"
  );

  const width = options.width ?? 430;
  const height = options.height ?? 230;
  const canvas = createCanvas(
    width * DEVICE_PIXEL_RATIO,
    height * DEVICE_PIXEL_RATIO,
  );

  const root = new FakeElement("div");
  root.className = "ic-root";
  const container = root.appendChild(new FakeElement("div"));
  const canvasElement = container.appendChild(
    new FakeCanvasElement(canvas.getContext("2d")),
  );
  const div = (): HTMLDivElement =>
    container.appendChild(new FakeElement("div")) as unknown as HTMLDivElement;

  const worksheet = new WorksheetCanvas({
    model,
    width,
    height,
    workbookState: new WorkbookState(),
    elements: {
      canvas: canvasElement as unknown as HTMLCanvasElement,
      cellOutline: div(),
      areaOutline: div(),
      cellArrayStructure: div(),
      extendToOutline: div(),
      columnGuide: div(),
      rowGuide: div(),
      columnHeaders: div(),
      editor: div(),
    },
    onColumnWidthChanges: () => {},
    onRowHeightChanges: () => {},
    linkTooltipCell: null,
    refresh: () => {},
  });
  worksheet.renderSheet();
  return canvas;
}
