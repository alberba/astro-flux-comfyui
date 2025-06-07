export class ImageGenerator {
  private apiUrl: string;

  constructor() {
    this.apiUrl = "http://localhost:8000";
  }

  async fetchLoras(): Promise<{ name: string }[]> {
    try {
      const response = await fetch(`${this.apiUrl}/loras`);
      if (!response.ok) throw new Error("Failed to fetch LoRAs");
      return await response.json();
    } catch (error) {
      console.error("Error fetching LoRAs:", error);
      return [];
    }
  }

  async generateImage(params: {
    prompt: string;
  }): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/api/generate-simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      return data.imageUrl;
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }
}
