# Copilot Instructions for this Repository

This repository contains:
- a Python backend in `backend/`
- an Angular frontend in `frontend/`

General rules:
- Keep solutions simple and production-oriented.
- Prefer clear and readable code over clever code.
- Do not introduce unnecessary dependencies.
- When suggesting changes, preserve the current project structure.
- Add short comments only when they improve understanding.

Backend rules:
- Backend code is written in Python.
- Prefer modular, readable functions.
- Keep business logic separated from routing code.
- Suggest files and folders that fit a clean backend structure.
- When adding dependencies, mention why they are needed.
- Prefer environment variables for secrets and configuration.

Frontend rules:
- Frontend code is written in Angular.
- Use standalone Angular conventions only if already adopted in the project; otherwise follow the existing structure.
- Keep components focused and not overly large.
- Prefer clear naming for components, services, and models.
- Keep styling simple and maintainable.
- all pages must be responsive and work well on mobile devices as well.

Project workflow:
- The project uses one Git repository for both backend and frontend.
- Respect existing files such as `.gitignore`, `README.md`, and environment separation.
- When suggesting commands, explain whether they should be run in the root, `backend/`, or `frontend/`.