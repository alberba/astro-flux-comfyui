import { ImageGenerator } from "./imageGenerator";
import { appState } from "./appState";

let uiInitialized = false; // Flag para asegurar que la UI se inicialice solo una vez

interface MaskLine {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  lineWidth: number;
}

interface CanvasSize {
  width: number;
  height: number;
}

export function initializeImageGeneratorUI() {
  if (uiInitialized) {
    return; // Si ya se inicializó, salir
  }
  uiInitialized = true; // Marcar como inicializado

  const imageGenerator = new ImageGenerator();
  let lastUsedSeed: number | null = null;
  let canvasSize: CanvasSize | null = null;
  let file: File | null = null;
  let generatedUrl: string | null;
  let latestMaskLines: MaskLine[] = [];
  let isAspectRatioLocked = false;
  let initialAspectRatio: number | null = null;

  // Configurar callback para imágenes intermedias
  imageGenerator.setIntermediateImageCallback((imageData) => {
    appState.addIntermediateImage(`data:image/png;base64,${imageData}`);
  });

  const dropZone = document.getElementById("test") as HTMLDivElement;
  dropZone?.addEventListener("masklines:update", (event: Event) => {
    latestMaskLines = (event as CustomEvent).detail;
  });
  dropZone?.addEventListener("canvas:resize", (event: Event) => {
    const { width, height } = (event as CustomEvent).detail;
    canvasSize = { width, height };
    widthInput.value = width.toString();
    heightInput.value = height.toString();
    initialAspectRatio = width / height;
  });
  dropZone?.addEventListener("file:loaded", (event: Event) => {
    file = (event as CustomEvent).detail;
    console.log("File loaded:", file);
  });
  dropZone?.addEventListener("updateGeneratedUrl", (e: Event) => {
    console.log("cambiado");
    generatedUrl = (e as CustomEvent).detail;
  });

  const widthInput = document.getElementById("width") as HTMLInputElement;
  const heightInput = document.getElementById("height") as HTMLInputElement;
  const toggleAspectRatioButton = document.getElementById(
    "toggle-aspect-ratio"
  ) as HTMLButtonElement;

  toggleAspectRatioButton?.addEventListener("click", () => {
    isAspectRatioLocked = !isAspectRatioLocked;
    if (isAspectRatioLocked) {
      if (widthInput.value && heightInput.value) {
        initialAspectRatio =
          parseInt(widthInput.value) / parseInt(heightInput.value);
      }
      toggleAspectRatioButton.classList.add("bg-indigo-500", "text-white");
      toggleAspectRatioButton.classList.remove("bg-gray-100", "text-gray-700");
    } else {
      initialAspectRatio = null;
      toggleAspectRatioButton.classList.remove("bg-indigo-500", "text-white");
      toggleAspectRatioButton.classList.add("bg-gray-100", "text-gray-700");
    }
  });

  widthInput?.addEventListener("input", () => {
    if (isAspectRatioLocked && initialAspectRatio !== null) {
      const newWidth = parseInt(widthInput.value);
      if (!isNaN(newWidth) && newWidth > 0) {
        heightInput.value = Math.round(
          newWidth / initialAspectRatio
        ).toString();
      }
    }
  });

  heightInput?.addEventListener("input", () => {
    if (isAspectRatioLocked && initialAspectRatio !== null) {
      const newHeight = parseInt(heightInput.value);
      if (!isNaN(newHeight) && newHeight > 0) {
        widthInput.value = Math.round(
          newHeight * initialAspectRatio
        ).toString();
      }
    }
  });

  function construirCanvas(): HTMLCanvasElement | undefined {
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = canvasSize?.width || 0;
    canvas.height = canvasSize?.height || 0;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Could not get canvas context");
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    latestMaskLines.forEach((line) => {
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.lineWidth = line.lineWidth;
      ctx.strokeStyle = "#fff";
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";
      ctx.stroke();
    });
    ctx.closePath();
    return canvas;
  }

  function invertMask(mask: HTMLCanvasElement): HTMLCanvasElement {
    const w = mask.width;
    const h = mask.height;
    const inv = document.createElement("canvas");
    inv.width = w;
    inv.height = h;
    const ctx = inv.getContext("2d");

    ctx!.fillStyle = "white";
    ctx?.fillRect(0, 0, w, h);

    ctx!.globalCompositeOperation = "destination-out";
    ctx?.drawImage(mask, 0, 0);

    ctx!.globalCompositeOperation = "source-over";
    return inv;
  }

  document.getElementById("generate")?.addEventListener("click", async () => {
    const prompt = (document.getElementById("prompt") as HTMLTextAreaElement)
      .value;
    const seedInput = document.getElementById("seed") as HTMLInputElement;
    const cfgInput = document.getElementById("cfg-number") as HTMLInputElement;
    const stepsInput = document.getElementById(
      "steps-number"
    ) as HTMLInputElement;
    const exSizeInput = document.getElementById("ex-size") as HTMLInputElement;
    const lorasSelect = document.getElementById(
      "loras-select"
    ) as HTMLSelectElement | null;
    const selectedLora = lorasSelect ? lorasSelect.value : undefined;

    // Get width and height values
    const width = parseInt(widthInput.value) || 1024;
    const height = parseInt(heightInput.value) || 1024;

    if (!prompt) {
      alert("Por favor, ingresa un prompt");
      return;
    }

    const numberOfGenerations = parseInt(exSizeInput.value) || 1;
    appState.startMultipleGeneration(numberOfGenerations);

    const isMaskGeneration = latestMaskLines.length > 0 || file !== null;

    for (let i = 0; i < numberOfGenerations; i++) {
      appState.updateGenerationProgress(i + 1);
      if (isMaskGeneration) {
        // Estamos generando Loras con máscara
        // Hay que preparar la máscara y la imagen
        try {
          appState.startLoading();
          let canvas = construirCanvas();
          // Asegurarse de que el canvas no esté vacío antes de invertir la máscara
          if (
            !canvas ||
            (canvas.width === 0 && canvas.height === 0) ||
            (latestMaskLines.length === 0 && !file)
          ) {
            // Si no hay líneas de máscara ni archivo, no se debería generar con máscara.
            // Esto debería haber sido capturado por isMaskGeneration, pero es una doble comprobación.
            throw new Error("No mask lines or image for mask generation.");
          }
          canvas = invertMask(canvas as HTMLCanvasElement);
          let aux;
          if (generatedUrl) {
            aux = generatedUrl;
          } else {
            aux = await imageGenerator.fileOrBlobToDataURL(file!);
          }
          await new Promise<void>((resolve, reject) => {
            canvas?.toBlob(async (blob) => {
              if (!blob) {
                reject(new Error("Failed to create mask blob."));
                return;
              }
              const formData = new FormData();
              formData.append("file", blob!, "mask.png");
              const { image, seed } =
                await imageGenerator.generateImageWithMask({
                  prompt,
                  mask: blob!,
                  image: aux!,
                  seed: seedInput.value
                    ? parseInt(seedInput.value) === -1
                      ? undefined
                      : parseInt(seedInput.value)
                    : undefined,
                  cfg: cfgInput.value ? parseFloat(cfgInput.value) : undefined,
                  steps: stepsInput.value
                    ? parseInt(stepsInput.value)
                    : undefined,
                  width: width,
                  height: height,
                  lora: selectedLora,
                });
              window.dispatchEvent(
                new CustomEvent("imagenAPI", {
                  detail: `data:image/png;base64,${image}`,
                  bubbles: true,
                  composed: true,
                })
              );

              // Guardar la última seed usada
              lastUsedSeed = seed;
              appState.setGeneratedImage(`data:image/png;base64,${image}`);
              resolve();
            });
          });
        } catch (error) {
          appState.setError("Failed to generate image. Please try again.");
          console.error("Error generating image:", error);
        } finally {
          if (i === numberOfGenerations - 1) {
            appState.finishMultipleGeneration();
          }
        }
      } else {
        try {
          appState.startLoading();
          const { image, seed } = await imageGenerator.generateImage({
            prompt,
            seed: seedInput.value
              ? parseInt(seedInput.value) === -1
                ? undefined
                : parseInt(seedInput.value)
              : undefined,
            cfg: cfgInput.value ? parseFloat(cfgInput.value) : undefined,
            steps: stepsInput.value ? parseInt(stepsInput.value) : undefined,
            width: width,
            height: height,
          });
          window.dispatchEvent(
            new CustomEvent("imagenAPI", {
              detail: `data:image/png;base64,${image}`,
              bubbles: true,
              composed: true,
            })
          );

          // Guardar la última seed usada
          lastUsedSeed = seed;
          appState.setGeneratedImage(`data:image/png;base64,${image}`);
        } catch (error) {
          appState.setError("Failed to generate image. Please try again.");
          console.error("Error generating image:", error);
        } finally {
          if (i === numberOfGenerations - 1) {
            appState.finishMultipleGeneration();
          }
        }
      }
    }
  });

  document
    .getElementById("toggle-advanced")
    ?.addEventListener("change", (event) => {
      const advancedFields = document.getElementById("advanced-fields");
      if (advancedFields) {
        advancedFields.style.display = (event.target as HTMLInputElement)
          .checked
          ? "block"
          : "none";
      }
    });

  document.getElementById("seed")?.addEventListener("input", (event) => {
    const value = parseInt((event.target as HTMLInputElement).value);
    if (value === -1) {
      document.getElementById("last-seed")?.setAttribute("disabled", "true");
      document.getElementById("random-seed")?.setAttribute("disabled", "true");
    } else {
      document.getElementById("last-seed")?.removeAttribute("disabled");
      document.getElementById("random-seed")?.removeAttribute("disabled");
    }
  });

  document.getElementById("last-seed")?.addEventListener("click", () => {
    if (lastUsedSeed !== null) {
      (document.getElementById("seed") as HTMLInputElement).value =
        lastUsedSeed.toString();
    }
  });

  document.getElementById("random-seed")?.addEventListener("click", () => {
    (document.getElementById("seed") as HTMLInputElement).value = "-1";
  });

  document.getElementById("cfg-range")?.addEventListener("input", (event) => {
    const value = (event.target as HTMLInputElement).value;
    (document.getElementById("cfg-number") as HTMLInputElement).value = value;
  });

  document.getElementById("cfg-number")?.addEventListener("input", (event) => {
    const value = (event.target as HTMLInputElement).value;
    (document.getElementById("cfg-range") as HTMLInputElement).value = value;
  });

  document.getElementById("steps-range")?.addEventListener("input", (event) => {
    const value = (event.target as HTMLInputElement).value;
    (document.getElementById("steps-number") as HTMLInputElement).value = value;
  });

  document
    .getElementById("steps-number")
    ?.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      (document.getElementById("steps-range") as HTMLInputElement).value =
        value;
    });

  // Suscribirse a cambios de estado de appState para actualizar la UI
  appState.subscribe((state) => {
    const generateButton = document.getElementById(
      "generate"
    ) as HTMLButtonElement;
    if (generateButton) {
      generateButton.disabled = state.isLoading;
      generateButton.textContent = state.isLoading
        ? "Generando..."
        : "Generate Image";
    }

    if (state.error) {
      alert(state.error);
    }

    const generatedImageContainer = document.getElementById("generatedImage");
    if (generatedImageContainer) {
      if (state.isLoading && state.progress) {
        const percent = Math.round(
          (state.progress.value / state.progress.max) * 100
        );
        generatedImageContainer.innerHTML = `
          <div class="w-full flex flex-col items-center justify-center h-full">
            <div class="w-2/3 bg-gray-200 rounded-full h-6 mb-4 overflow-hidden">
              <div class="bg-indigo-600 h-6 rounded-full transition-all duration-300" style="width: ${percent}%;"></div>
            </div>
            <span class="text-indigo-700 font-semibold">${percent}%</span>
          </div>
        `;
      } else if (state.generatedImageUrl) {
        generatedImageContainer.innerHTML = `
          <img src="${state.generatedImageUrl}" alt="Generated image" class="max-w-full max-h-full" />
        `;
      } else {
        generatedImageContainer.innerHTML =
          '<p class="text-gray-500">Generated image will appear here</p>';
      }
    }

    // Actualizar historial de imágenes
    const imageHistoryContainer = document.querySelector(
      "#imageHistory .flex.space-x-2"
    );
    if (imageHistoryContainer) {
      imageHistoryContainer.innerHTML = ""; // Limpiar antes de añadir
      // Display newest images first (left to right)
      state.imageHistory
        .slice()
        .reverse()
        .forEach((imageUrl) => {
          const imgElement = document.createElement("img");
          imgElement.src = imageUrl;
          imgElement.className =
            "object-cover rounded cursor-pointer border border-gray-600 shadow-md";
          imgElement.addEventListener("click", () => {
            // Aquí puedes añadir lógica para mostrar la imagen grande al hacer clic
            console.log("Clicked on history image:", imageUrl);
            appState.setState({ generatedImageUrl: imageUrl }); // O cargarla en el área principal
          });
          imageHistoryContainer.appendChild(imgElement);
        });
    }
  });
}

// Asegúrate de llamar a esta función cuando el DOM esté completamente cargado
document.addEventListener("DOMContentLoaded", initializeImageGeneratorUI);
