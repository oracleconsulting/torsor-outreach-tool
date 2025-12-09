# Torsor Outreach Tool

Companies House data mining tool for accounting practices.

## Overview

The Torsor Outreach Tool helps accounting practices discover potential clients by mining Companies House data. Key features:

- **Firm Discovery**: Enter an accounting firm's company number to find all companies at their address
- **Address Search**: Search for companies by postcode or address
- **Prospect Management**: Save and manage potential clients with scoring
- **Covenant Tracking**: Manage non-compete restrictions
- **Export**: Export prospects to CSV/Excel

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Routing**: TanStack Router
- **Data Fetching**: TanStack Query (React Query)
- **Styling**: Tailwind CSS
- **Backend**: Supabase Edge Functions
- **Database**: PostgreSQL (shared Supabase instance)

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account (shared instance: `mvdejlkiqslwrbarwxkw`)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/oracleconsulting/torsor-outreach-tool.git
cd torsor-outreach-tool
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=https://mvdejlkiqslwrbarwxkw.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

5. Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Database Setup

Run the database migration script in Supabase SQL Editor:

```sql
-- See scripts/20251209_create_outreach_schema.sql
```

This creates the `outreach.*` schema with all required tables.

## Edge Functions

Deploy Edge Functions to Supabase:

```bash
supabase functions deploy companies-house --project-ref mvdejlkiqslwrbarwxkw
supabase functions deploy address-discovery --project-ref mvdejlkiqslwrbarwxkw
```

Set secrets:

```bash
supabase secrets set COMPANIES_HOUSE_API_KEY=xxx --project-ref mvdejlkiqslwrbarwxkw
```

## Deployment

### Railway

1. Connect your GitHub repository to Railway
2. Railway will auto-detect the build settings
3. Set environment variables in Railway dashboard
4. Configure custom domain: `outreach.torsor.co.uk`

## Project Structure

```
torsor-outreach-tool/
├── src/
│   ├── pages/          # Page components
│   ├── components/     # Reusable components
│   ├── services/       # API/Supabase services
│   ├── hooks/          # React Query hooks
│   ├── types/          # TypeScript types
│   └── lib/            # Utilities
├── supabase/
│   └── functions/      # Edge Functions
└── public/             # Static assets
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run typecheck` - Type check without building
- `npm run lint` - Run ESLint

## License

Private - Oracle Consulting

