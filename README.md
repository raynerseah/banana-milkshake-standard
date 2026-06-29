# Banana Milkshake Standard (Ext Ver.)

This is a React/Vite project ready for deployment.

## 🚀 Deployment to Google Cloud (Cloud Run)

This project has been optimized for Google Cloud Run deployment. It uses a multi-stage Docker build to compile the React application and serves it via a lightweight Nginx web server configured for Single Page Applications (SPA).

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

2. **Deploy to Cloud Run:**
   Execute the following command in the root of the project to build and deploy your container.
   ```bash
   gcloud run deploy banana-milkshake-app \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --port 8080
   ```
   *Note: Cloud Build will automatically use the `Dockerfile` provided to build the container.*

3. **Environment Variables:**
   If you need to pass environment variables (like API keys) to your build process in Cloud Run, use the `--set-build-env-vars` flag:
   ```bash
   gcloud run deploy banana-milkshake-app \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --port 8080 \
     --set-build-env-vars GEMINI_API_KEY="your-api-key"
   ```

## 🔒 Security Best Practices

We have conducted a security review and implemented the following:
* Added `.env` to `.gitignore` to prevent committing sensitive keys.
* Provided a `.dockerignore` to ensure development dependencies and secrets aren't inadvertently baked into the production container.

### ⚠️ CRITICAL SECURITY WARNING: Frontend API Keys
Currently, the application injects the `GEMINI_API_KEY` into the frontend bundle via `vite.config.ts`. **This means anyone who visits your website can see and extract your API key from the browser.**

**For Production, you MUST do one of the following:**
1. **(Recommended) Move to a Backend:** Create a small backend service (e.g., using Express.js or Cloud Functions) that holds the API key and communicates with the Gemini API. Your React app should only call your backend.
2. **Restrict the API Key:** Go to the Google Cloud Console > APIs & Services > Credentials, and add HTTP referrers restrictions to your API key so it can only be used from your specific production domain. *Note: this provides limited security against abuse but is better than nothing.*
