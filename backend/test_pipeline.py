from app.config import get_settings
from app.providers import build_provider
from app.engines.persona_pipeline import PersonaPipeline
import sys

settings = get_settings()
provider = build_provider(settings)
pipeline = PersonaPipeline(provider=provider)

try:
    draft = pipeline.generate_profile(person_name="Naval Ravikant", persona_type="real_person")
    import json
    print(json.dumps(draft, indent=2))
except Exception as e:
    print("FAILED", type(e), str(e))
