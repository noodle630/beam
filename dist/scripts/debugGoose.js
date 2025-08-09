#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
async function debugGooseTools() {
    console.log('🔍 Debug: Goose MCP Tool Schemas');
    console.log('================================');
    const repoRoot = process.cwd();
    const mcpServerPath = path.join(repoRoot, 'dist', 'mcp', 'server.js');
    console.log(`🎯 MCP server path: ${mcpServerPath}`);
    console.log('');
    const child = (0, child_process_1.spawn)('node', [mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    child.stderr.on('data', (data) => {
    });
    const request = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });
    child.stdin.write(request + '\n');
    child.stdin.end();
    let output = '';
    child.stdout.on('data', (data) => {
        output += data.toString();
    });
    child.on('close', (code) => {
        try {
            const lines = output.split('\n').filter(line => line.trim());
            const jsonLine = lines.find(line => line.includes('"result"'));
            if (jsonLine) {
                const response = JSON.parse(jsonLine);
                const tools = response.result.tools;
                console.log(`✅ Found ${tools.length} tools`);
                console.log('');
                tools.forEach((tool, index) => {
                    console.log(`${index + 1}. Tool: ${tool.name}`);
                    console.log(`   Description: ${tool.description}`);
                    console.log(`   Schema Type: ${tool.inputSchema.type}`);
                    console.log(`   Required: [${tool.inputSchema.required.join(', ')}]`);
                    const schemaStr = JSON.stringify(tool.inputSchema);
                    const hasOneOf = schemaStr.includes('oneOf');
                    const hasAnyOf = schemaStr.includes('anyOf');
                    const hasAllOf = schemaStr.includes('allOf');
                    if (hasOneOf || hasAnyOf || hasAllOf) {
                        console.log(`   ❌ PROBLEM: Contains ${hasOneOf ? 'oneOf ' : ''}${hasAnyOf ? 'anyOf ' : ''}${hasAllOf ? 'allOf ' : ''}`);
                    }
                    else {
                        console.log(`   ✅ CLEAN: No problematic schema patterns`);
                    }
                    console.log(`   Full Schema: ${JSON.stringify(tool.inputSchema, null, 4)}`);
                    console.log('');
                });
            }
            else {
                console.log('❌ Could not parse MCP response');
                console.log('Raw output:', output);
            }
        }
        catch (error) {
            console.log('❌ Error parsing response:', error);
            console.log('Raw output:', output);
        }
    });
}
if (require.main === module) {
    debugGooseTools().catch(error => {
        console.error('💥 Debug failed:', error);
        process.exit(1);
    });
}
