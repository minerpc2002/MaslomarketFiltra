# MASLO MARKET - Auto Filter Finder AI

Modern auto filter finder application with a dark "liquid glass" theme and USSR-style accents. Optimized for Telegram Mini App.

## Deployment on Vercel

To deploy this application on Vercel, follow these steps:

1.  **Push to Git:** Push your code to a GitHub, GitLab, or Bitbucket repository.
2.  **Import to Vercel:** Go to [Vercel.com](https://vercel.com/) and import your repository.
3.  **Configure Build Settings:**
    *   **Framework Preset:** Vite
    *   **Build Command:** `npm run build`
    *   **Output Directory:** `dist`
4.  **Set Environment Variables:**
    *   In the Vercel project settings, go to **Environment Variables**.
    *   Add a new variable:
        *   **Key:** `GEMINI_API_KEY`
        *   **Value:** (Your Google Gemini API Key)
5.  **Deploy:** Click **Deploy**.

## Features

*   **AI-Powered Search:** Uses Google Gemini models to find accurate filter information.
*   **Multi-Model Fallback:** Automatically switches between Gemini 3.1 Pro, Flash, and Flash Lite to ensure reliability.
*   **Search Modes:**
    *   **Catalog:** Search by vehicle make, model, year, engine, and body type.
    *   **VIN:** Search by vehicle identification number.
    *   **Part Number:** Search by OEM or analog part numbers to find cross-references.
*   **Telegram Mini App Integration:** Optimized for Telegram with haptic feedback and native UI elements.
*   **Modern UI:** Dark "liquid glass" theme with USSR industrial aesthetic.

## Development

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.
