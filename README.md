# Banana Milkshake Standard (Ext Ver.)

Banana Milkshake is an AI-powered ad generation tool. Using Google's Gemini models (`gemini-3.5-flash` for ad copy, and a selectable choice between Nano Banana 2 (`gemini-3.1-flash-image`) and Nano Banana Pro (`gemini-3-pro-image`) for images), it helps marketers and creators automatically generate professional advertisements by compositing product images, lifestyle backgrounds, logos, and generating AI-assisted ad copy (headlines, descriptions, and CTAs).

## ✨ Key Features
*   **AI Copywriter**: Get intelligent copy suggestions for headlines, descriptions, and CTAs.
*   **Lifestyle Scene Generation**: Take standard product shots and composite them seamlessly into photorealistic lifestyle environments.
*   **Precise Image Editing**: Make specific retouches and adjustments using AI compositing.
*   **Final Ad Assembly**: Stitch together product assets, brand guidelines, logos, and copy into ready-to-publish digital ads.

---

## 🚀 Deployment to Google Cloud (Cloud Run)

This project has been optimized for Google Cloud Run deployment. It features a unified Docker container where a secure Node.js Express backend serves the React frontend (SPA) and securely proxies requests to the Gemini API, protecting your API keys.

### Prerequisites
1. [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and initialized.
2. A Google Cloud project with billing enabled.
3. Docker (optional, for local testing).

### Deployment Steps

1. **Authenticate with Google Cloud:**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Deploy to Cloud Run with your API Key:**
   Execute the following command in the root of the project to build and deploy your container. Because the API key is now securely handled on the backend at runtime, you must pass it using `--set-env-vars`.
   ```bash
   gcloud run deploy banana-milkshake-standard \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --port 8080 \
     --set-env-vars GEMINI_API_KEY="your-api-key"
   ```
   *Note: Cloud Build will automatically use the `Dockerfile` provided to build the Node.js container.*

## 🔒 Security Best Practices

We have conducted a security review and implemented the following:
* **Secure Backend Proxy:** The application uses an Express.js backend to securely hold the `GEMINI_API_KEY` and communicate with the Gemini APIs. The frontend never exposes the key.
* **Environment Protection:** Added `.env` to `.gitignore` to prevent committing sensitive keys.
* **Build Integrity:** Provided a `.dockerignore` to ensure development dependencies and secrets aren't inadvertently baked into the production container.
* **Security Headers:** The Express backend implements essential security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`) for robust defense.
