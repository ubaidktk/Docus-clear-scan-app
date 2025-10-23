<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DocuClean - Offline Desktop App

This repository contains the Electron version of the DocuClean application. DocuClean is a powerful, 100% offline document scanning and cleaning application. Import documents from your camera or files, apply powerful cleaning filters, extract text with built-in OCR, and export your documents as high-quality PDFs or images, all within a native desktop interface.

## Run Locally (Development)

**Prerequisites:** [Node.js](https://nodejs.org/) (LTS version recommended)

### 1. Set up OCR Language Files

For the offline OCR to work, you must provide the language data files.

1.  Create a folder named `public` in the root of the project.
2.  Inside `public`, create another folder named `tessdata`.
3.  Download the "fast" versions of the language files you need from the [Tessdata repository](https://github.com/tesseract-ocr/tessdata_fast). For this app, you need:
    *   `eng.traineddata`
    *   `urd.traineddata`
4.  Place these `.traineddata` files inside the `public/tessdata` folder.

### 2. Install and Run

1.  **Install dependencies:**
    Open your terminal in the project root folder and run:
    ```bash
    npm install
    ```

2.  **Run the development server:**
    This command will start the Vite server for the UI and launch the Electron app concurrently.
    ```bash
    npm run electron:dev
    ```

## Build Application for Production

To build a distributable installer for your operating system (e.g., `.exe` for Windows, `.dmg` for macOS), run the following command:

```bash
npm run build:electron
```

The installer will be located in the `release` folder that gets created in your project root.
