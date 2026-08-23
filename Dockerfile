# Frontend build stage — produces the static Vite bundle
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json tailwind.config.ts postcss.config.js components.json ./
COPY src ./src
# Empty base URL -> API calls resolve relative to the current origin, since
# the backend below serves both the API and this static bundle together.
ENV VITE_API_BASE_URL=""
RUN npm run build

# Runtime stage — FastAPI backend + the built frontend as static files
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=frontend-build /app/dist ./static

EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
