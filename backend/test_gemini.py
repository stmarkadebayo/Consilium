from app.config import get_settings
from langchain_google_genai import ChatGoogleGenerativeAI
import sys

settings = get_settings()
model = ChatGoogleGenerativeAI(
    model=settings.persona_creation_model,
    google_api_key=settings.gemini_api_key,
    max_output_tokens=2048,
    temperature=0.7,
)

response = model.invoke("Count from 1 to 500 separated by commas")
print("Content length:", len(response.content))
print("Metadata:", response.response_metadata)
