import json
import logging
from typing import Any, Dict, List, Optional
from openai import OpenAI
from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres un asistente ejecutivo experto en análisis y síntesis de reuniones y material audiovisual empresarial.
Tu objetivo es analizar la transcripción proporcionada y estructurar un informe de alta calidad profesional en formato JSON.

Estructura requerida de salida JSON:
{
  "title": "Título conciso y representativo de la sesión",
  "summary": "Resumen ejecutivo detallado en 2-3 párrafos claros y directos",
  "key_points": [
    "Punto clave 1...",
    "Punto clave 2..."
  ],
  "action_items": [
    {
      "task": "Descripción clara de la tarea o acuerdo",
      "owner": "Nombre del responsable si se menciona en el audio, o 'Sin asignar'",
      "deadline": "Plazo temporal si se menciona, o 'No especificado'"
    }
  ],
  "decisions": [
    "Decisión tomada 1..."
  ]
}

Responde SIEMPRE única y exclusivamente con el JSON válido (sin markdown ```json alrededor)."""


class SummarizerService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        if self.api_key:
            self.client = OpenAI(
                api_key=self.api_key,
                timeout=settings.OPENAI_TIMEOUT_SECONDS,
                max_retries=3
            )
        else:
            self.client = None

    def generate_meeting_notes(self, transcript_text: str, language: str = "es") -> Dict[str, Any]:
        """Generates structured executive meeting notes, action items and summary using gpt-4o-mini."""
        if not self.client:
            raise ValueError("OPENAI_API_KEY no está configurada para el servicio de resumen.")

        if not transcript_text or len(transcript_text.strip()) < 20:
            return {
                "title": "Transcripción Corta",
                "summary": "El audio proporcionado no contiene suficiente contenido hablado para generar un resumen detallado.",
                "key_points": [],
                "action_items": [],
                "decisions": []
            }

        # Truncate safely if exceeding token limits (gpt-4o-mini has 128k context)
        max_chars = 120000
        safe_text = transcript_text[:max_chars]

        try:
            response = self.client.chat.completions.create(
                model=settings.SUMMARY_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Idioma objetivo: {language}\n\nTranscripción de la sesión:\n{safe_text}"
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )

            raw_json = response.choices[0].message.content
            return json.loads(raw_json)
        except Exception as e:
            logger.error(f"Error generando resumen con OpenAI: {str(e)}")
            return {
                "title": "Resumen no disponible",
                "summary": "No se pudo generar el resumen ejecutivo de la sesión en este momento. La transcripción completa y los subtítulos permanecen disponibles.",
                "key_points": [],
                "action_items": [],
                "decisions": [],
                "error": True
            }
