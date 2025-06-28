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
