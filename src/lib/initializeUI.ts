import { ImageGenerator } from "./imageGenerator";
import { CanvasHandler } from "./canvasHandler";
import { UIEventHandler } from "./uiEventHandler";


export function initializeUI(apiEndpointWorkflow?: string): void {
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
