# Contributing to Sharyx OS

First off, thank you for considering contributing to Sharyx! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

## 🛠️ How Can I Contribute?

### 1. Adding New Providers
Sharyx is built on a modular "Provider" pattern. If you want to add support for a new STT, LLM, or TTS service:
1. Create a new file in `src/stt`, `src/llm`, or `src/tts`.
2. Implement the corresponding interface from `src/interfaces`.
3. Export your new provider from `src/index.ts`.

### 2. Reporting Bugs
- Use the **Bug Report** template in GitHub Issues.
- Provide a clear description and steps to reproduce.

### 3. Feature Requests
- Use the **Feature Request** template.
- Describe the "Why" and the "How".

## 📝 Pull Request Process

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Build the project (`npm run build`).
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5. Push to the branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request.

---
**Happy Coding!**
