import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const root = "C:/Users/SHASHANK KAKAD/Documents/projects/Invaria";
const deck = path.join(root, "presentation-output", "Invaria_Review_Deck_Simple.pptx");
const out = path.join(root, ".presentation-build", "rendered-simple");
await fs.mkdir(out, { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(deck));
const snapshot = await presentation.inspect({ kind: "slide", maxChars: 50000 });
const slides = snapshot.ndjson.split("\n").filter(Boolean).map(JSON.parse).filter(x => x.kind === "slide");
for (let i = 0; i < slides.length; i += 1) {
  const slide = presentation.resolve(slides[i].id);
  const png = await presentation.export({ slide, format: "png", scale: 1.5 });
  await fs.writeFile(path.join(out, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}
console.log(JSON.stringify({ count: slides.length, out }, null, 2));
