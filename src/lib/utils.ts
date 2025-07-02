export const LORA_DISPLAY_NAMES: Record<string, string> = {
  "Bibiloni1024.safetensors": "Antoni Bibiloni (bibiloni)",
  "mascaroPerfeccionadoFlux.safetensors": "Miquel Mascaró (mqlmscr)",
  "oliver1024.safetensors": "Antoni Oliver (oliver)",
};

export const LORA_TO_EXCLUDE: string =
  "aidmaImageUprader-FLUX-v0.3.safetensors";

// Determinar la URL base de la API
function getApiUrl(): string {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const apiUrl = isLocal
    ? "http://localhost:8000/lorasuib/api"
    : "http://ia-ltim.uib.es/lorasuib/api";

  return apiUrl;
}

async function fetchUrlResponse(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
}

export function syncRangeAndNumber(
  rangeInputId: string,
  numberInputId: string,
): void {
  const rangeInput = document.getElementById(rangeInputId) as HTMLInputElement;
  const numberInput = document.getElementById(
    numberInputId,
  ) as HTMLInputElement;

  rangeInput?.addEventListener("input", () => {
    numberInput.value = rangeInput.value;
  });

  numberInput?.addEventListener("input", () => {
    rangeInput.value = numberInput.value;
  });
}

export { getApiUrl, fetchUrlResponse };
