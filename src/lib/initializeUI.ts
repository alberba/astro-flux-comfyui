import { ImageGenerator } from "./imageGenerator";
import { appState } from "./appState";
import { CanvasHandler } from "./canvasHandler";
import { UIEventHandler } from "./uiEventHandler";

let uiInitialized = false; // Flag para asegurar que la UI se inicialice solo una vez

export function initializeImageGeneratorUI(apiEndpointWorkflow?: string): void {
  const imageGenerator = new ImageGenerator(apiEndpointWorkflow);
  let canvasHandler: CanvasHandler | undefined;

  if (apiEndpointWorkflow !== "/generate-simple") {
    canvasHandler = new CanvasHandler(
      "canvas",
      "dropZone",
      "fileupload",
      "container"
    );

    window.addEventListener("imagenAPI", (e: Event) => {
      const customEvent = e as CustomEvent;
      const imageData = customEvent.detail;
      canvasHandler!.loadImageFromUrl(imageData);
    });
  }

  new UIEventHandler(imageGenerator, canvasHandler);
}
