import { ImageGenerator } from "./imageGenerator";
import { appState } from "./appState";
import { CanvasHandler } from "./canvasHandler";

interface CanvasSize {
  width: number;
  height: number;
}

export class UIEventHandler {
  private imageGenerator: ImageGenerator;
  private canvasHandler: CanvasHandler | undefined;
  private lastUsedSeed: number | null = null;
  private isAspectRatioLocked = false;
  private initialAspectRatio: number | null = null;
  private canvasSize: CanvasSize = { width: 1024, height: 1024 };

  constructor(imageGenerator: ImageGenerator, canvasHandler?: CanvasHandler) {
    this.imageGenerator = imageGenerator;
    this.canvasHandler = canvasHandler;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Event listeners para la relación de aspecto
    const widthInput = document.getElementById("width") as HTMLInputElement;
    const heightInput = document.getElementById("height") as HTMLInputElement;
    const toggleAspectRatioButton = document.getElementById(
      "toggle-aspect-ratio"
    ) as HTMLButtonElement;

    toggleAspectRatioButton?.addEventListener("click", () => {
      this.isAspectRatioLocked = !this.isAspectRatioLocked;
      if (this.isAspectRatioLocked) {
        if (widthInput.value && heightInput.value) {
          this.initialAspectRatio =
            parseInt(widthInput.value) / parseInt(heightInput.value);
        }
        toggleAspectRatioButton.classList.add("bg-indigo-500", "text-white");
        toggleAspectRatioButton.classList.remove(
          "bg-gray-100",
          "text-gray-700"
        );
      } else {
        this.initialAspectRatio = null;
        toggleAspectRatioButton.classList.remove("bg-indigo-500", "text-white");
        toggleAspectRatioButton.classList.add("bg-gray-100", "text-gray-700");
      }
    });

    widthInput?.addEventListener("input", () => {
      if (this.isAspectRatioLocked && this.initialAspectRatio !== null) {
        const newWidth = parseInt(widthInput.value);
        if (!isNaN(newWidth) && newWidth > 0) {
          heightInput.value = Math.round(
            newWidth / this.initialAspectRatio
          ).toString();
        }
      }
    });

    heightInput?.addEventListener("input", () => {
      if (this.isAspectRatioLocked && this.initialAspectRatio !== null) {
        const newHeight = parseInt(heightInput.value);
        if (!isNaN(newHeight) && newHeight > 0) {
          widthInput.value = Math.round(
            newHeight * this.initialAspectRatio
          ).toString();
        }
      }
    });

    const dropZone = document.getElementById("dropZone");
    dropZone?.addEventListener("canvas:resize", (event) => {
      const { width, height } = (event as CustomEvent).detail as CanvasSize;
      widthInput.value = width.toString();
      heightInput.value = height.toString();
    });

    // Event listener para el botón de generar
    document.getElementById("generate")?.addEventListener("click", async () => {
      const prompt = (document.getElementById("prompt") as HTMLTextAreaElement)
        .value;
      const seedInput = document.getElementById("seed") as HTMLInputElement;
      const cfgInput = document.getElementById(
        "cfg-number"
      ) as HTMLInputElement;
      const stepsInput = document.getElementById(
        "steps-number"
      ) as HTMLInputElement;
      const exSizeInput = document.getElementById(
        "ex-size"
      ) as HTMLInputElement;
      const lorasSelect = document.getElementById(
        "loras-select"
      ) as HTMLSelectElement | null;
      const selectedLora = lorasSelect ? lorasSelect.value : undefined;

      const width = parseInt(widthInput.value) || 1024;
      const height = parseInt(heightInput.value) || 1024;

      if (!prompt) {
        alert("Por favor, ingresa un prompt");
        return;
      }

      const numberOfGenerations = parseInt(exSizeInput.value) || 1;
      appState.startMultipleGeneration(numberOfGenerations);

      const isMaskGeneration =
        this.canvasHandler &&
        (this.canvasHandler.getMaskLines().length > 0 ||
          this.canvasHandler.getFile() !== undefined);

      for (let i = 0; i < numberOfGenerations; i++) {
        appState.updateGenerationProgress(i + 1);
        if (isMaskGeneration) {
          try {
            appState.startLoading();
            const maskBlob = await this.canvasHandler!.buildCanvasMask();
            if (!maskBlob) {
              throw new Error("Failed to create mask blob.");
            }

            let imageBlob: Blob | undefined;
            if (this.canvasHandler!.getFile()) {
              imageBlob = this.canvasHandler!.getFile();
            } else if (this.canvasHandler!.getGeneratedUrl()) {
              const response = await fetch(
                this.canvasHandler!.getGeneratedUrl()!
              ); // Add '!' for non-null assertion
              imageBlob = await response.blob();
            } else {
              throw new Error("No image provided for mask generation.");
            }

            const { image, seed } =
              await this.imageGenerator.generateImageWithMask({
                prompt,
                mask: maskBlob,
                image: imageBlob,
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

            this.lastUsedSeed = seed;
            appState.setGeneratedImage(`data:image/png;base64,${image}`);
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
            const { image, seed } = await this.imageGenerator.generateImage({
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
              lora: selectedLora,
            });
            window.dispatchEvent(
              new CustomEvent("imagenAPI", {
                detail: `data:image/png;base64,${image}`,
                bubbles: true,
                composed: true,
              })
            );

            this.lastUsedSeed = seed;
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
        document
          .getElementById("random-seed")
          ?.setAttribute("disabled", "true");
      } else {
        document.getElementById("last-seed")?.removeAttribute("disabled");
        document.getElementById("random-seed")?.removeAttribute("disabled");
      }
    });

    document.getElementById("last-seed")?.addEventListener("click", () => {
      if (this.lastUsedSeed !== null) {
        (document.getElementById("seed") as HTMLInputElement).value =
          this.lastUsedSeed.toString();
      }
    });

    document.getElementById("random-seed")?.addEventListener("click", () => {
      (document.getElementById("seed") as HTMLInputElement).value = "-1";
    });

    document.getElementById("cfg-range")?.addEventListener("input", (event) => {
      const value = (event.target as HTMLInputElement).value;
      (document.getElementById("cfg-number") as HTMLInputElement).value = value;
    });

    document
      .getElementById("cfg-number")
      ?.addEventListener("input", (event) => {
        const value = (event.target as HTMLInputElement).value;
        (document.getElementById("cfg-range") as HTMLInputElement).value =
          value;
      });

    document
      .getElementById("steps-range")
      ?.addEventListener("input", (event) => {
        const value = (event.target as HTMLInputElement).value;
        (document.getElementById("steps-number") as HTMLInputElement).value =
          value;
      });

    document
      .getElementById("steps-number")
      ?.addEventListener("input", (event) => {
        const value = (event.target as HTMLInputElement).value;
        (document.getElementById("steps-range") as HTMLInputElement).value =
          value;
      });

    document
      .getElementById("ex-size-range")
      ?.addEventListener("input", (event) => {
        const value = (event.target as HTMLInputElement).value;
        (document.getElementById("ex-size") as HTMLInputElement).value = value;
      });

    const clearMaskButton = document.getElementById(
      "clear-mask-button"
    ) as HTMLButtonElement;
    if (clearMaskButton) {
      clearMaskButton.addEventListener("click", () => {
        this.canvasHandler?.clearCanvas();
      });
    }

    const undoMaskButton = document.getElementById(
      "undo-mask-button"
    ) as HTMLButtonElement;
    if (undoMaskButton) {
      undoMaskButton.addEventListener("click", () => {
        this.canvasHandler?.undoLastMaskLine();
      });
    }

    const fileUpload = document.getElementById(
      "fileupload"
    ) as HTMLInputElement;
    if (fileUpload) {
      fileUpload.addEventListener("change", (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files && target.files[0];
        if (file) {
          this.canvasHandler?.handleImageUpload(file);
        }
      });
    }

    const toggleDrawButton = document.getElementById(
      "toggle-draw-button"
    ) as HTMLButtonElement;
    if (toggleDrawButton) {
      toggleDrawButton.addEventListener("click", () => {
        this.canvasHandler?.toggleDrawMode();
        toggleDrawButton.classList.toggle("bg-indigo-500");
        toggleDrawButton.classList.toggle("text-white");
        toggleDrawButton.classList.toggle("bg-gray-100");
        toggleDrawButton.classList.toggle("text-gray-700");
      });
    }

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
}
