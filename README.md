# OW – Game Dashboard (OWMCB)

OW is a web-based dashboard built to manage and visualize in-house Overwatch games.
The project focuses on structured data handling, clear admin workflows, and session-based access control.

This application was developed to explore full-stack JavaScript workflows with an emphasis on clarity, maintainability, and real-world admin use cases.

---

## Live Demo

https://owmcb.vercel.app

---

## Overview

The OW dashboard provides:
- Admin-controlled access to game data
- Structured views for managing in-house matches
- Session-based authentication
- A clean and minimal UI focused on usability

Rather than prioritizing visual complexity, the project emphasizes predictable behavior, clear data flow, and human-friendly interfaces.

---

## Tech Stack

**Frontend**
- Next.js
- React
- Tailwind CSS

**Backend**
- Node.js
- Express

**Infrastructure**
- Docker
- Vercel

---

## Key Features

- Admin-based dashboard layout
- Session-based authentication
- Role-aware access control
- Modular route and component structure
- Responsive UI for desktop and tablet use
- Clean separation between frontend and backend logic

---

## Project Structure
```
/app
├── components
├── pages
├── styles
/server
├── routes
├── controllers
└── middleware
```

---

## Design & Development Approach

This project was built with a focus on:
- Clear separation of concerns
- Predictable user flows
- Readable and maintainable code
- Practical admin-focused UI decisions

The goal was to simulate a realistic internal tool rather than a consumer-facing application.

---

## Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- npm
- Docker (optional)

### Run locally

```bash
git clone https://github.com/BKjeon4/ow.git
cd ow
npm install
npm run dev```

The application will be available at:

http://localhost:3000
---

## Docker
To build and run using Docker:

docker build -t ow-dashboard .
docker run -p 3000:3000 ow-dashboard

## What I Learned
Building admin-focused dashboards

Managing session-based authentication in Node.js

Structuring full-stack JavaScript projects

Deploying containerized applications

Designing internal tools with clarity and intention

## Author
Byungwook Jeon
GitHub: https://github.com/BKjeon4
LinkedIn: https://www.linkedin.com/in/byungwook-bk-jeon/

## Notes
This project was built as part of an in-house gaming community tool and continues to evolve as new features and refinements are added.
