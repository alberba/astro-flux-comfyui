import { ImageGenerator } from "./imageGenerator";
import { appState } from "./appState";
import { CanvasHandler } from "./canvasHandler";
import { UIEventHandler } from "./uiEventHandler";

let uiInitialized = false; // Flag para asegurar que la UI se inicialice solo una vez

export function initializeImageGeneratorUI(apiEndpointWorkflow?: string): void {
  if (uiInitialized) {
    console.warn("UI ya está inicializada, no se volverá a inicializar.");
    return; // Si ya se inicializó, salir
  }
  uiInitialized = true; // Marcar como inicializado

  const imageGenerator = new ImageGenerator(apiEndpointWorkflow);
  let canvasHandler: CanvasHandler | undefined;

  if (apiEndpointWorkflow !== "/generate-simple") {
    canvasHandler = new CanvasHandler(
      "canvas",
      "dropZone",
      "fileupload",
      "container"
    );
  }

  new UIEventHandler(imageGenerator, canvasHandler);

  // Configurar callback para imágenes intermedias
  imageGenerator.setIntermediateImageCallback((imageData) => {
    appState.addIntermediateImage(`data:image/png;base64,${imageData}`);
  });

  // Event listener for imagenAPI to load generated image in canvas
  if (canvasHandler) {
    window.addEventListener("imagenAPI", (e: Event) => {
      const customEvent = e as CustomEvent;
      const imageData = customEvent.detail;
      canvasHandler!.loadImageFromUrl(imageData);
    });
  }
}
