#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const child_process_1 = require("child_process");
async function runCommand(command, args) {
    return new Promise((resolve) => {
        const child = (0, child_process_1.spawn)(command, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd()
        });
        let output = '';
        let errorOutput = '';
        child.stdout?.on('data', (data) => {
            output += data.toString();
        });
        child.stderr?.on('data', (data) => {
            errorOutput += data.toString();
        });
        child.on('close', (code) => {
            resolve({
                success: code === 0,
                output: output + errorOutput
            });
        });
    });
}
async function testMcpSmoke() {
    console.log('🧪 Testing MCP Smoke Tests...');
    try {
        const { success, output } = await runCommand('npm', ['run', 'mcp:smoke', '--', 'snowboard']);
        if (success && output.includes('Found') && output.includes('products')) {
            const match = output.match(/Found (\d+) products/);
            const count = match ? match[1] : '0';
            console.log(`   ✅ MCP Smoke Test: Found ${count} products`);
            return true;
        }
        else {
            console.log('   ❌ MCP Smoke Test: Failed or no products found');
            return false;
        }
    }
    catch (error) {
        console.log('   ❌ MCP Smoke Test: Error running test');
        return false;
    }
}
async function testHttpApi() {
    console.log('🌐 Testing HTTP Actions API...');
    try {
        const { success, output } = await runCommand('npm', ['run', 'test:http']);
        if (success && output.includes('All HTTP API tests passed!')) {
            console.log('   ✅ HTTP Actions API: All tests passed');
            return true;
        }
        else {
            console.log('   ❌ HTTP Actions API: Tests failed');
            return false;
        }
    }
    catch (error) {
        console.log('   ❌ HTTP Actions API: Error running test');
        return false;
    }
}
async function testGooseProfile() {
    console.log('🪿 Testing Goose Profile Setup...');
    try {
        const { success, output } = await runCommand('npm', ['run', 'goose:profile']);
        if (success && output.includes('Goose profile configuration complete!')) {
            console.log('   ✅ Goose Profile: Configuration created successfully');
            return true;
        }
        else {
            console.log('   ❌ Goose Profile: Setup failed');
            return false;
        }
    }
    catch (error) {
        console.log('   ❌ Goose Profile: Error running setup');
        return false;
    }
}
async function testBuildSystem() {
    console.log('🔨 Testing Build System...');
    try {
        const { success } = await runCommand('npm', ['run', 'build:force']);
        if (success) {
            console.log('   ✅ Build System: Compilation successful');
            return true;
        }
        else {
            console.log('   ❌ Build System: Compilation failed');
            return false;
        }
    }
    catch (error) {
        console.log('   ❌ Build System: Error during build');
        return false;
    }
}
async function main() {
    console.log('🎯 COMPREHENSIVE BEAM TEST SUITE');
    console.log('=================================');
    console.log('');
    const tests = [
        { name: 'Build System', test: testBuildSystem },
        { name: 'MCP Smoke Tests', test: testMcpSmoke },
        { name: 'HTTP Actions API', test: testHttpApi },
        { name: 'Goose Profile Setup', test: testGooseProfile }
    ];
    let passed = 0;
    let total = tests.length;
    for (const { name, test } of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
            }
        }
        catch (error) {
            console.log(`   ❌ ${name}: Unexpected error`);
        }
        console.log('');
    }
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=======================');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    console.log('');
    if (passed === total) {
        console.log('🎊 ALL TESTS PASSED! 🎊');
        console.log('');
        console.log('🚀 Beam is ready for AI agent integration!');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('   1. Install Goose: https://github.com/square/goose');
        console.log('   2. Test with: goose session start');
        console.log('   3. Query: "Find snowboards under $900 from beam-devtest.myshopify.com"');
        console.log('   4. Set up ChatGPT Custom GPT with: http://localhost:3000/openapi.json');
        console.log('');
        return true;
    }
    else {
        console.log('⚠️  Some tests failed. Please check the output above.');
        console.log('');
        console.log('🔧 Common fixes:');
        console.log('   - Ensure Next.js dev server is running: npm run dev');
        console.log('   - Check environment variables in .env');
        console.log('   - Verify Supabase connection');
        console.log('   - Run: npm run sync:shopify (if no products)');
        console.log('');
        return false;
    }
}
if (require.main === module) {
    main().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('💥 Test runner crashed:', error);
        process.exit(1);
    });
}
