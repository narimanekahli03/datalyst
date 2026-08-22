import os

from dotenv import load_dotenv

# Loads backend/.env if present. In production the real values should come
# from the process environment instead — load_dotenv() never overrides a
# variable that's already set, so both paths work unchanged.
load_dotenv()

MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY", "")
MISTRAL_MODEL = os.environ.get("MISTRAL_MODEL", "mistral-large-latest")

# Comma-separated list of allowed frontend origins for CORS, e.g.
# "http://localhost:5173,http://localhost:5174". Defaults cover the two
# ports Vite falls back to when 5173 is already taken.
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174"
    ).split(",")
    if origin.strip()
]
