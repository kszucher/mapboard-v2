# Workspace Rules for Graphboard

These guidelines apply to all development tasks in the Graphboard repository.

## Verification & Code Quality

### Backend (python-backend)
- **Always** run ruff formatting and lints after modifying Python source code.
- Run ruff with the workspace virtual environment's executable:
  - Format code: `.venv\Scripts\ruff format .`
  - Lints & Imports: `.venv\Scripts\ruff check . --fix`
- Fix any remaining errors manually before ending the task.

### Frontend (frontend)
- **Always** run typecheck and build validation after modifying frontend source code.
- Run build verification using:
  - `npm.cmd run build` (on Windows) or `npm run build`
