# 📄 Beam – Product Requirements Document (PRD)

**Version:** v1.2  
**Last Updated:** August 7, 2025  
**Owner:** Pratik Shekhar  
**Repo:** https://github.com/noodle630/beam (local workspace)  

---

## 💡 Overview

Beam makes any custom or headless e-commerce store AI-agent ready by generating and hosting a Model Context Protocol (MCP) server. It transforms static, human-centric catalogs into dynamic, machine-readable endpoints, allowing AI shopping agents (like GPT, Claude, Goose, Operator, etc.) to access, interpret, and act on product data in real-time — without requiring merchants to re-architect their stack.

> “We make your e-commerce store instantly usable by AI agents — no dev work needed.”

---

## 🧨 Problem

Most e-commerce platforms like Shopify are rolling out native MCP support. But custom, in-house, and headless stores lack:

- Standardized product metadata
- MCP-compatible endpoints (`/.well-known/ai-plugin.json`)
- APIs that support dynamic inventory/pricing access

These sites are **invisible to AI agents** — and will lose visibility and conversion in the agent-led economy.

---

## ✅ Solution

Beam acts as a plug-and-play MCP layer. Merchants connect their data (via file upload or API), and Beam:

- 🧠 Generates MCP-compliant `ai-plugin.json` + `openapi.yaml`
- 🌍 Hosts `.well-known` endpoints for discovery by agents
- 🔍 Provides a preview of how AI agents will see and use the store
- 📊 Offers analytics on agent usage, search behavior, traffic, and conversions
- ✅ Delivers health reports + “AI-readiness score”

---

## 🎯 Target Customers

- D2C brands with custom-built e-commerce stacks
- Marketplaces built in-house
- Headless commerce adopters (e.g. Medusa, Commerce Layer)
- SaaS platforms with embedded commerce logic

---

## 🌐 Key Concepts

| Term              | Description |
|-------------------|-------------|
| **MCP**           | Model Context Protocol – allows AI agents to understand and interact with a website |
| **ai-plugin.json**| Manifest file describing the store’s API and capabilities |
| **OpenAPI Spec**  | Defines the available endpoints agents can use |
| **Agent UX**      | Interfaces built for AI agents instead of humans |

---

## 🔥 Strategic Insights

### From Microsoft
- Agents rely on `/.well-known` and structured schema metadata
- Consider `llms.txt` and Schema.org metadata

### From Limelight
- Operator AI agent visually browses and clicks like a human
- Beam may eventually run accessibility & interaction tests

### From KaarTech
- MCP enables clarifying Q&A, bundle comparisons, stock checks
- Market will grow from $3.6B → $282.6B by 2034 (CAGR ~54.7%)

📚 [Microsoft blog](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/the-future-of-ai-optimize-your-site-for-agents---its-cool-to-be-a-tool/4434189)  
📚 [Limelight blog](https://limelightmarketing.com/blogs/openai-operator-ecommerce-ai-shopping-preparation/)  
📚 [KaarTech blog](https://www.kaartech.com/blogs/ai-shopping-agents-for-e-commerce-site/)

---

## 🧱 MVP Scope (Phase 1)

| Feature                    | Description |
|----------------------------|-------------|
| File upload                | Upload CSV or JSON catalog |
| Catalog parser             | Convert to structured internal format |
| MCP generator              | Output `ai-plugin.json` + `openapi.yaml` |
| Hosted endpoints           | Serve from `/.well-known/` |
| Preview & diagnostics      | Show agent-ready output in dashboard |

---

## 📊 Beam Analytics (Phase 2+)

Beam will include a dashboard for merchants to view:

- Which agents (GPT, Claude, Goose) accessed their store
- What users searched for
- Which products were viewed or bought
- Conversion & traffic trends
- Agent interaction logs (requests, errors, successes)
- Readiness score + missing metadata reports

---

## 📂 Folder Structure

```bash
/src/app
  /upload             ← Upload page
  /preview            ← Agent preview
  /.well-known
    /ai-plugin        ← Serve manifest file
/api
  /upload             ← Parse catalog file
/lib
  parseCatalog.ts     ← CSV parser logic
  generatePlugin.ts   ← Generate ai-plugin.json
```

---

## 🚧 Out of Scope (Phase 1)

- Shopify/BIG integrations
- Checkout, cart, payment logic
- User auth (beyond dev mode)
- Agent orchestration

---

## 🛣️ Future Additions

- API pull/push modes for real-time catalog sync
- GPT plugin support for the OpenAI plugin store
- Agent UX preview & LLM behavior sandbox
- Accessibility & structure linter for Operator AI
- Stripe billing + usage-based pricing