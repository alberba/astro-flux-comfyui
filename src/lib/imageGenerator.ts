import { appState } from "./appState";

export class ImageGenerator {
  private apiUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private onIntermediateImage: ((imageUrl: string) => void) | null = null;
  private clientId: string;

  constructor(apiEndpointWorkflow?: string) {
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    this.apiUrl = isLocal
      ? "http://localhost:8000/lorasuib/api"
      : "http://ia-ltim.uib.es/lorasuib/api";
    this.wsUrl = isLocal
      ? "ws://localhost:8000/ws"
      : "ws://ia-ltim.uib.es/lorasuib/api/ws";
    this.clientId = this.generateClientId();
  }

  private generateClientId(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  setIntermediateImageCallback(callback: (imageUrl: string) => void) {
    this.onIntermediateImage = callback;
  }

  private connectWebSocket() {
    const wsUrl = new URL(this.wsUrl);
    wsUrl.searchParams.append("clientId", this.clientId);
    this.ws = new WebSocket(wsUrl.toString());

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "progress" && data.data) {
          appState.setProgress({ value: data.data.value, max: data.data.max });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }

  async generateImage(params: {
    prompt: string;
    mask?: Blob;
    seed?: number;
    cfg?: number;
    steps?: number;
    width?: number;
    height?: number;
    number?: number;
    lora?: string;
  }): Promise<{ image: string; seed: number }> {
    try {
      // Conectar WebSocket si no está conectado
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWebSocket();
      }
      appState.clearProgress();

      const response = await fetch(`${this.apiUrl}/generate-simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: params.prompt,
          seed: params.seed,
          cfg: params.cfg,
          steps: params.steps,
          width: params.width,
          height: params.height,
          clientId: this.clientId,
          lora: params.lora,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      return { image: data.image, seed: data.seed };
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }

  // Función de ayuda para convertir File/Blob a Data URL Base64
  fileOrBlobToDataURL(fileOrBlob: File | Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result será algo como "data:image/png;base64,iVBORw0KGgoAAAANS…"
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBlob);
    });
  }

  async generateImageWithMask(
    params: {
      prompt: string;
      mask?: Blob;
      image?: string;
      seed?: number;
      cfg?: number;
      steps?: number;
      width?: number;
      height?: number;
      number?: number;
      lora?: string;
    },
    apiEndpointWorkflow: string
  ): Promise<{ image: string; seed: number }> {
    try {
      const [maskDataURL] = await Promise.all([
        this.fileOrBlobToDataURL(params.mask!),
      ]);
      // Conectar WebSocket si no está conectado
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWebSocket();
      }
      appState.clearProgress();
      console.log(params.image);
      const apiUrl = this.apiUrl + apiEndpointWorkflow;
      console.log("API URL:", apiUrl);

      const response = await fetch(`${apiUrl}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: params.prompt,
          mask: maskDataURL,
          image: params.image,
          seed: params.seed,
          cfg: params.cfg,
          steps: params.steps,
          width: params.width,
          height: params.height,
          clientId: this.clientId,
          lora: params.lora,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      return { image: data.image, seed: data.seed };
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
