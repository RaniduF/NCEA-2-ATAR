# NCEA → ATAR Estimator Frontend

React (Next.js) + Tailwind frontend for the NCEA to ATAR estimator.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Set backend API (optional; defaults to <http://localhost:8000>):

```bash
$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:8000" # PowerShell
# or
export NEXT_PUBLIC_API_BASE_URL="http://localhost:8000" # bash
```

3. Run the dev server:

```bash
npm run dev
```

Open <http://localhost:3000>.

## Features
- Search for subjects or standards with live suggestions
- Add multiple standards without resetting the search bar
- Assign grades (Excellence, Merit, Achieved, Not Achieved)
- Calculate ATAR via backend and display results over multiple years 