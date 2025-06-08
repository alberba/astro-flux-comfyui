import { appState } from "./appState";

export class ImageGenerator {
  private apiUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private onIntermediateImage: ((imageUrl: string) => void) | null = null;
  private clientId: string;

  constructor() {
    this.apiUrl = "http://localhost:8000";
    this.wsUrl = "ws://localhost:8000/ws";
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
        if (data.type === "intermediate_image" && this.onIntermediateImage) {
          this.onIntermediateImage(data.imageUrl);
        }
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
    mask: string;
  }): Promise<string> {
    try {
      // Conectar WebSocket si no está conectado
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWebSocket();
      }
      appState.clearProgress();

      const response = await fetch(`${this.apiUrl}/api/generate-simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...params,
          clientId: this.clientId,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      return data.imageUrl;
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
