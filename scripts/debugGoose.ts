#!/usr/bin/env ts-node

// Load environment variables from .env file
import 'dotenv/config'

import { spawn } from 'child_process'
import * as path from 'path'

async function debugGooseTools() {
  console.log('🔍 Debug: Goose MCP Tool Schemas')
  console.log('================================')
  
  // Get the MCP server path
  const repoRoot = process.cwd()
  const mcpServerPath = path.join(repoRoot, 'dist', 'mcp', 'server.js')

  console.log(`🎯 MCP server path: ${mcpServerPath}`)
  console.log('')

  const child = spawn('node', [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  })

  child.stderr.on('data', (data) => {
    // Ignore startup messages
  })

  // Send tools/list request
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  })

  child.stdin.write(request + '\n')
  child.stdin.end()

  let output = ''
  child.stdout.on('data', (data) => {
    output += data.toString()
  })

  child.on('close', (code) => {
    try {
      // Find the JSON response (last line that's valid JSON)
      const lines = output.split('\n').filter(line => line.trim())
      const jsonLine = lines.find(line => line.includes('"result"'))
      
      if (jsonLine) {
        const response = JSON.parse(jsonLine)
        const tools = response.result.tools

        console.log(`✅ Found ${tools.length} tools`)
        console.log('')

        tools.forEach((tool: any, index: number) => {
          console.log(`${index + 1}. Tool: ${tool.name}`)
          console.log(`   Description: ${tool.description}`)
          console.log(`   Schema Type: ${tool.inputSchema.type}`)
          console.log(`   Required: [${tool.inputSchema.required.join(', ')}]`)
          
          // Check for problematic patterns
          const schemaStr = JSON.stringify(tool.inputSchema)
          const hasOneOf = schemaStr.includes('oneOf')
          const hasAnyOf = schemaStr.includes('anyOf')
          const hasAllOf = schemaStr.includes('allOf')
          
          if (hasOneOf || hasAnyOf || hasAllOf) {
            console.log(`   ❌ PROBLEM: Contains ${hasOneOf ? 'oneOf ' : ''}${hasAnyOf ? 'anyOf ' : ''}${hasAllOf ? 'allOf ' : ''}`)
          } else {
            console.log(`   ✅ CLEAN: No problematic schema patterns`)
          }
          
          console.log(`   Full Schema: ${JSON.stringify(tool.inputSchema, null, 4)}`)
          console.log('')
        })
      } else {
        console.log('❌ Could not parse MCP response')
        console.log('Raw output:', output)
      }
    } catch (error) {
      console.log('❌ Error parsing response:', error)
      console.log('Raw output:', output)
    }
  })
}

// Run the debug script
if (require.main === module) {
  debugGooseTools().catch(error => {
    console.error('💥 Debug failed:', error)
    process.exit(1)
  })
} 