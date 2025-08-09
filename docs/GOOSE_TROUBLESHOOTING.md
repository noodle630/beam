# Goose Integration Troubleshooting

This guide helps resolve common issues with Goose + Beam MCP integration.

## Current Status: Schema Error

If you're getting this error:
```
Request failed: Invalid schema for function 'beam__find_products': schema must have 
type 'object' and not have 'oneOf'/'anyOf'/'allOf'/'enum'/'not' at the top level
```

## ✅ Verified Working

Our debugging confirms:
- ✅ MCP server schemas are clean (no `oneOf`/`anyOf`/`allOf`)
- ✅ All 3 tools have valid `type: object` schemas
- ✅ MCP server responds correctly to tool calls
- ✅ Compiled server exists at correct path
- ✅ Goose profile points to correct server

## 🔧 Troubleshooting Steps

### Step 1: Force Complete Restart

```bash
# Kill all Goose processes
pkill -f -i goose

# Wait a few seconds
sleep 5

# Rebuild Beam
npm run build

# Regenerate Goose profile
npm run goose:profile

# Start fresh Goose session
goose session start
```

### Step 2: Verify MCP Server Manually

```bash
# Test our server directly (should show clean schemas)
npx ts-node --project tsconfig.node.json scripts/debugGoose.ts

# Test a simple call (should return products)
npm run mcp:smoke -- snowboard
```

### Step 3: Check Goose Version & Compatibility

```bash
# Check Goose version
goose --version

# Try using the development profile instead
# Edit ~/.config/goose/profiles.yaml and change:
# From: default -> beam-dev
```

### Step 4: Alternative Profile Setup

If the automatic profile doesn't work, try manual setup:

1. **Open Goose configuration**:
   ```bash
   open ~/.config/goose/profiles.yaml
   ```

2. **Replace with this minimal config**:
   ```yaml
   default:
     providers:
       - type: mcp
         server_command: 
           - node
           - /Users/pratik/Desktop/beam/dist/mcp/server.js
   ```

### Step 5: Verify Environment

```bash
# Check that the server file exists and is recent
ls -la /Users/pratik/Desktop/beam/dist/mcp/server.js

# Verify it was compiled after our schema fixes
stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" /Users/pratik/Desktop/beam/dist/mcp/server.js
```

### Step 6: Debug Goose MCP Communication

If you're comfortable with debugging, try:

1. **Start MCP server manually**:
   ```bash
   node /Users/pratik/Desktop/beam/dist/mcp/server.js
   ```

2. **Send manual request**:
   ```json
   {"jsonrpc":"2.0","id":1,"method":"tools/list"}
   ```

3. **Verify clean response** (should show no `oneOf`/`anyOf`)

## 🆘 If Nothing Works

The issue might be:

1. **Goose version incompatibility** - Try updating Goose
2. **macOS permissions** - Try running `goose session start` with admin permissions
3. **Cache persistence** - Delete `~/Library/Application Support/Goose` and restart
4. **Alternative MCP client** - Test with Claude Desktop instead

## 🎯 Expected Working Query

Once fixed, this query should work:
```
Find snowboards under $900 from beam-devtest.myshopify.com
```

Expected response:
```
I found 5 snowboards under $900:

1. **The Hidden Snowboard** by Snowboard Vendor - $50.95
2. **The Collection Snowboard: Liquid** by Hydrogen Vendor - $899.35
3. **The Multi-managed Snowboard** by Multi-managed Vendor - $629.95
...
```

## 📞 Support

If the issue persists:
1. Run: `npx ts-node --project tsconfig.node.json scripts/debugGoose.ts`
2. Share the output showing clean schemas
3. This confirms the issue is on Goose's side, not Beam's 