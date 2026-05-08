#!/usr/bin/env node

/**
 * Script de teste de performance automatizado
 * Executa build e análise de bundle
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const COLORS = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

function log(message, color = "reset") {
    console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function runCommand(command, description) {
    log(`\n📦 ${description}...`, "cyan");
    try {
        execSync(command, { stdio: "inherit" });
        log(`✅ ${description} concluído!`, "green");
        return true;
    } catch {
        log(`❌ Erro em ${description}`, "red");
        return false;
    }
}

function analyzeBundleSize() {
    log("\n📊 Analisando tamanho do bundle...", "cyan");

    const distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
        log("❌ Pasta dist não encontrada", "red");
        return;
    }

    const files = fs.readdirSync(distPath, { recursive: true });
    let totalSize = 0;
    const fileSizes = [];

    files.forEach((file) => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
            const sizeKB = stats.size / 1024;
            totalSize += sizeKB;
            fileSizes.push({ name: file, size: sizeKB });
        }
    });

    // Ordenar por tamanho
    fileSizes.sort((a, b) => b.size - a.size);

    log("\n📁 Top 10 maiores arquivos:", "yellow");
    fileSizes.slice(0, 10).forEach((file, index) => {
        const sizeMB = (file.size / 1024).toFixed(2);
        const color = file.size > 500 ? "red" : file.size > 200 ? "yellow" : "green";
        log(`${index + 1}. ${file.name}: ${sizeMB} MB`, color);
    });

    log(`\n💾 Tamanho total do bundle: ${(totalSize / 1024).toFixed(2)} MB`, "magenta");

    // Alertas
    if (totalSize > 5000) {
        log("⚠️  Bundle muito grande! Considere code splitting.", "red");
    } else if (totalSize > 2000) {
        log("⚠️  Bundle moderado. Monitore o crescimento.", "yellow");
    } else {
        log("✅ Tamanho do bundle está bom!", "green");
    }
}

function checkPerformanceBudget() {
    log("\n🎯 Verificando budget de performance...", "cyan");

    const budget = {
        maxBundleSize: 2000, // KB
        maxChunkSize: 500, // KB
        maxInitialLoad: 1000, // KB
    };

    const distPath = path.join(process.cwd(), "dist");
    const files = fs.readdirSync(distPath, { recursive: true });

    let initialLoadSize = 0;
    let violations = [];

    files.forEach((file) => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
            const sizeKB = stats.size / 1024;

            // Verificar chunks
            if (file.includes("chunk") && sizeKB > budget.maxChunkSize) {
                violations.push(`Chunk ${file} excede ${budget.maxChunkSize}KB`);
            }

            // Verificar initial load
            if (file.includes("index") || file.includes("vendor")) {
                initialLoadSize += sizeKB;
            }
        }
    });

    if (violations.length > 0) {
        log("❌ Violações de budget:", "red");
        violations.forEach((v) => log(`  - ${v}`, "red"));
    } else {
        log("✅ Budget de performance respeitado!", "green");
    }

    log(`\n📥 Initial load size: ${initialLoadSize.toFixed(2)} KB`, "magenta");
}

function generateReport() {
    log("\n📝 Gerando relatório de performance...", "cyan");

    const report = {
        timestamp: new Date().toISOString(),
        bundleSize: {},
        recommendations: [],
    };

    const distPath = path.join(process.cwd(), "dist");
    const files = fs.readdirSync(distPath, { recursive: true });

    files.forEach((file) => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
            report.bundleSize[file] = (stats.size / 1024).toFixed(2) + " KB";
        }
    });

    // Recomendações
    if (Object.keys(report.bundleSize).length > 20) {
        report.recommendations.push("Considere consolidar chunks pequenos");
    }

    const reportPath = path.join(process.cwd(), "performance-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    log(`✅ Relatório salvo em: ${reportPath}`, "green");
}

// Executar testes
log("🚀 Iniciando testes de performance...", "magenta");
log("=".repeat(50), "cyan");

// 1. Typecheck
if (!runCommand("npm run typecheck", "Verificação de tipos")) {
    process.exit(1);
}

// 2. Build
if (!runCommand("npm run build", "Build de produção")) {
    process.exit(1);
}

// 3. Análise
analyzeBundleSize();
checkPerformanceBudget();
generateReport();

log("\n" + "=".repeat(50), "cyan");
log("✅ Testes de performance concluídos!", "green");
log("\n💡 Dicas:", "yellow");
log("  - Execute 'npm run analyze' para visualizar o bundle", "yellow");
log("  - Monitore o Lighthouse score regularmente", "yellow");
log("  - Considere lazy loading para componentes grandes", "yellow");