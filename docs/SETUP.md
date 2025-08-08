# Beam Setup Guide

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Node.js**: Version 18 or higher
3. **Git**: For version control

## Step 1: Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `beam-demo` (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to you
5. Click "Create new project"

## Step 2: Set Up Database Tables

Once your project is created, go to the SQL Editor and run this SQL:

```sql
-- Create organizations table
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_slug TEXT NOT NULL REFERENCES organizations(org_slug),
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert demo organization
INSERT INTO organizations (org_slug, name) VALUES ('demo-brand', 'Demo Brand');

-- Create indexes for better performance
CREATE INDEX idx_products_org_slug ON products(org_slug);
CREATE INDEX idx_products_title ON products(title);
```

## Step 3: Get API Keys

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 4: Configure Environment Variables

1. Create a `.env.local` file in your project root:

```bash
# Create the file
touch .env.local
```

2. Add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Replace the values with your actual Supabase project URL and anon key.**

## Step 5: Test the Setup

1. Start the development server:
```bash
npm run dev
```

2. Visit `http://localhost:3000/upload`

3. Upload a CSV file with this format:
```csv
title,description,price
Sample Product 1,This is a great product,29.99
Sample Product 2,Another amazing product,49.99
```

4. Check the console for any errors

## Step 6: Verify Everything Works

1. **Upload Test**: Upload a CSV file and check for success message
2. **Organization Page**: Visit `http://localhost:3000/org/demo-brand`
3. **MCP Endpoints**: Test the API endpoints:
   ```bash
   # Test context endpoint
   curl http://localhost:3000/api/mcp/demo-brand/context
   
   # Test actions endpoint
   curl http://localhost:3000/api/mcp/demo-brand/actions
   ```

## Troubleshooting

### "Supabase not configured" Error
- Make sure `.env.local` exists and has correct values
- Restart the development server after adding environment variables
- Check that the file is in the project root (same level as `package.json`)

### Database Connection Errors
- Verify your Supabase project is active
- Check that the tables were created correctly
- Ensure your API keys are correct

### CSV Upload Issues
- Make sure your CSV has the required columns: `title`, `description`, `price`
- Check that the price column contains valid numbers
- Ensure the file is a valid CSV format

## Next Steps

Once everything is working:

1. **Test with real data**: Upload your actual product catalog
2. **Explore the MCP endpoints**: Test with AI agents
3. **Customize the UI**: Modify the product display pages
4. **Add authentication**: Implement user management in the next phase

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Supabase project settings
3. Ensure all environment variables are set correctly 