#!/usr/bin/env node
/**
 * MCP Servers Data Aggregator
 * Aggregates evaluation results from different MCP servers and generates summary with metrics.
 */

const fs = require('fs');
const path = require('path');

// Default pricing rates (USD per 1K tokens)
const TOKEN_PRICING = {
  'claude-sonnet-4': { input: 0.015, output: 0.075 },
  'claude-sonnet-4-20250514': { input: 0.015, output: 0.075 },
  'deepseek-v3.1-non-think': { input: 0.002, output: 0.01 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'o1-preview': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  // Add more models as needed
};

/**
 * Calculate cost in USD based on token usage
 */
function computeCostUsd(modelName, inputTokens, outputTokens) {
  const pricing = TOKEN_PRICING[modelName];
  if (!pricing) {
    console.warn(`No pricing info for model: ${modelName}`);
    return null;
  }
  
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Discover all MCP servers and their implementations
 */
function discoverMcpServers() {
  const mcpServersDir = './mcp_servers';
  const servers = {};
  
  if (!fs.existsSync(mcpServersDir)) {
    console.error('mcp_servers directory not found');
    return servers;
  }
  
  const serverDirs = fs.readdirSync(mcpServersDir).filter(dir => {
    const dirPath = path.join(mcpServersDir, dir);
    return fs.statSync(dirPath).isDirectory() && !dir.startsWith('.');
  });
  
  for (const serverDir of serverDirs) {
    const serverPath = path.join(mcpServersDir, serverDir);
    const implementations = fs.readdirSync(serverPath).filter(impl => {
      const implPath = path.join(serverPath, impl);
      return fs.statSync(implPath).isDirectory() && !impl.startsWith('.');
    });
    
    servers[serverDir] = {};
    for (const impl of implementations) {
      servers[serverDir][impl] = path.join(serverPath, impl);
    }
  }
  
  return servers;
}

/**
 * Collect run data from a specific implementation directory
 */
function collectRunData(implDir, k = 4) {
  const runData = {};
  
  for (let runIdx = 1; runIdx <= k; runIdx++) {
    const runDir = path.join(implDir, `run-${runIdx}`);
    if (!fs.existsSync(runDir)) continue;
    
    const summaryPath = path.join(runDir, 'summary.json');
    if (fs.existsSync(summaryPath)) {
      try {
        const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        runData[`run-${runIdx}`] = summaryData;
      } catch (error) {
        console.warn(`Failed to read summary for ${runDir}:`, error.message);
      }
    }
    
    // Also collect individual task metadata if needed
    const taskDirs = fs.readdirSync(runDir).filter(dir => {
      const dirPath = path.join(runDir, dir);
      return fs.statSync(dirPath).isDirectory() && dir.includes('__');
    });
    
    runData[`run-${runIdx}`] = runData[`run-${runIdx}`] || {};
    runData[`run-${runIdx}`].tasks = {};
    
    for (const taskDir of taskDirs) {
      const metaPath = path.join(runDir, taskDir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          runData[`run-${runIdx}`].tasks[taskDir] = metaData;
        } catch (error) {
          console.warn(`Failed to read meta for ${taskDir}:`, error.message);
        }
      }
    }
  }
  
  return runData;
}

/**
 * Calculate aggregated metrics for an implementation
 */
function calculateMetrics(runData, k = 4) {
  const runs = Object.keys(runData).filter(key => key.startsWith('run-'));
  const actualK = runs.length;
  
  if (actualK === 0) {
    return null;
  }
  
  let totalTasks = 0;
  let totalAgentExecutionTime = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let totalTurns = 0;
  let totalSuccessfulTasks = 0;
  
  let actualModelName = '';
  let isOpenSourceModel = false;
  let isReasoningModel = false;
  
  const pass1Rates = [];
  
  // Collect data from all runs
  for (const runKey of runs) {
    const runSummary = runData[runKey];
    if (!runSummary) continue;
    
    // Basic aggregation
    totalTasks += runSummary.total_tasks || 0;
    totalAgentExecutionTime += runSummary.total_agent_execution_time || 0;
    totalInputTokens += runSummary.token_usage?.total_input_tokens || 0;
    totalOutputTokens += runSummary.token_usage?.total_output_tokens || 0;
    totalTokens += runSummary.token_usage?.total_tokens || 0;
    totalTurns += runSummary.turn_usage?.total_turns || 0;
    totalSuccessfulTasks += runSummary.successful_tasks || 0;
    
    // Model metadata
    if (!actualModelName && runSummary.model_config?.litellm_run_model_name) {
      actualModelName = runSummary.model_config.litellm_run_model_name;
    }
    
    // Calculate pass@1 for this run
    const tasksInRun = runSummary.total_tasks || 0;
    const successInRun = runSummary.successful_tasks || 0;
    const pass1 = tasksInRun > 0 ? successInRun / tasksInRun : 0;
    pass1Rates.push(pass1);
  }
  
  // Calculate averages
  const avgPass1 = pass1Rates.length > 0 ? pass1Rates.reduce((a, b) => a + b, 0) / pass1Rates.length : 0;
  const stdPass1 = pass1Rates.length > 1 ? 
    Math.sqrt(pass1Rates.reduce((sum, rate) => sum + Math.pow(rate - avgPass1, 2), 0) / pass1Rates.length) : 0;
  
  const totalTasksAcrossRuns = totalTasks;
  const avgAgentExecutionTime = totalTasksAcrossRuns > 0 ? totalAgentExecutionTime / totalTasksAcrossRuns : 0;
  const avgInputTokens = totalTasksAcrossRuns > 0 ? totalInputTokens / totalTasksAcrossRuns : 0;
  const avgOutputTokens = totalTasksAcrossRuns > 0 ? totalOutputTokens / totalTasksAcrossRuns : 0;
  const avgTotalTokens = totalTasksAcrossRuns > 0 ? totalTokens / totalTasksAcrossRuns : 0;
  const avgTurns = totalTasksAcrossRuns > 0 ? totalTurns / totalTasksAcrossRuns : 0;
  
  // Per-run calculations
  const perRunInputTokens = actualK > 0 ? totalInputTokens / actualK : 0;
  const perRunOutputTokens = actualK > 0 ? totalOutputTokens / actualK : 0;
  const perRunCost = computeCostUsd(actualModelName, perRunInputTokens, perRunOutputTokens);
  
  // Calculate pass@k metrics (only for multiple runs)
  let passAtK = null;
  let passPowerK = null;
  
  if (actualK > 1) {
    // For pass@k, we need to check success across runs for each unique task
    const taskSuccessMap = new Map();
    
    for (const runKey of runs) {
      const tasks = runData[runKey].tasks || {};
      for (const [taskName, taskMeta] of Object.entries(tasks)) {
        if (!taskSuccessMap.has(taskName)) {
          taskSuccessMap.set(taskName, []);
        }
        const success = taskMeta.execution_result?.success || false;
        taskSuccessMap.get(taskName).push(success);
      }
    }
    
    let passAtKSuccesses = 0;
    let passPowerKSuccesses = 0;
    const uniqueTasks = taskSuccessMap.size;
    
    for (const successes of taskSuccessMap.values()) {
      if (successes.some(s => s)) passAtKSuccesses++;
      if (successes.every(s => s)) passPowerKSuccesses++;
    }
    
    if (uniqueTasks > 0) {
      passAtK = passAtKSuccesses / uniqueTasks;
      passPowerK = passPowerKSuccesses / uniqueTasks;
    }
  }
  
  const metrics = {
    total_tasks: Math.round(totalTasks / actualK), // Average tasks per run
    total_agent_execution_time: parseFloat(totalAgentExecutionTime.toFixed(4)),
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_tokens: totalTokens,
    total_turns: totalTurns,
    avg_agent_execution_time: parseFloat(avgAgentExecutionTime.toFixed(4)),
    avg_input_tokens: parseFloat(avgInputTokens.toFixed(4)),
    avg_output_tokens: parseFloat(avgOutputTokens.toFixed(4)),
    avg_total_tokens: parseFloat(avgTotalTokens.toFixed(4)),
    avg_turns: parseFloat(avgTurns.toFixed(4)),
    per_run_input_tokens: perRunInputTokens,
    per_run_output_tokens: perRunOutputTokens,
    per_run_cost: perRunCost,
    actual_model_name: actualModelName,
    "pass@1": {
      avg: parseFloat(avgPass1.toFixed(4)),
      std: parseFloat(stdPass1.toFixed(4))
    }
  };
  
  if (passAtK !== null) {
    metrics[`pass@${actualK}`] = parseFloat(passAtK.toFixed(4));
  }
  if (passPowerK !== null) {
    metrics[`pass^${actualK}`] = parseFloat(passPowerK.toFixed(4));
  }
  
  return metrics;
}

/**
 * Main aggregation function
 */
function aggregateMcpData(k = 4) {
  console.log('🔄 Discovering MCP servers...');
  const servers = discoverMcpServers();
  
  console.log(`📋 Found ${Object.keys(servers).length} MCP servers:`);
  for (const [server, implementations] of Object.entries(servers)) {
    console.log(`  ${server}: ${Object.keys(implementations).join(', ')}`);
  }
  
  const aggregatedData = {
    generated_at: new Date().toISOString(),
    k: k,
    leaderboard: {}
  };
  
  for (const [serverName, implementations] of Object.entries(servers)) {
    console.log(`\n📊 Processing ${serverName}...`);
    aggregatedData.leaderboard[serverName] = {};
    
    for (const [implName, implPath] of Object.entries(implementations)) {
      console.log(`  📥 Collecting data for ${implName}...`);
      
      const runData = collectRunData(implPath, k);
      const metrics = calculateMetrics(runData, k);
      
      if (metrics) {
        aggregatedData.leaderboard[serverName][implName] = metrics;
        console.log(`    ✅ ${implName}: ${metrics.total_tasks} tasks, ${(metrics["pass@1"].avg * 100).toFixed(1)}% pass@1`);
      } else {
        console.log(`    ⚠️ ${implName}: No valid data found`);
      }
    }
  }
  
  return aggregatedData;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const k = args.includes('--k') ? parseInt(args[args.indexOf('--k') + 1]) || 4 : 4;
  const outputFile = args.includes('--output') ? args[args.indexOf('--output') + 1] : 'mcp_servers.json';
  
  console.log(`🚀 Starting MCP data aggregation with k=${k}`);
  
  try {
    const aggregatedData = aggregateMcpData(k);
    
    // Write to output file
    const outputPath = path.resolve(outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(aggregatedData, null, 2));
    
    console.log(`\n🎉 Successfully aggregated data!`);
    console.log(`📄 Output written to: ${outputPath}`);
    
    // Print summary
    console.log('\n📊 Summary:');
    for (const [serverName, implementations] of Object.entries(aggregatedData.leaderboard)) {
      console.log(`${serverName}:`);
      for (const [implName, data] of Object.entries(implementations)) {
        if (data.total_tasks) {
          console.log(`  ${implName}: ${data.total_tasks} tasks, ${(data["pass@1"].avg * 100).toFixed(1)}% pass@1`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error during aggregation:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { aggregateMcpData, discoverMcpServers, collectRunData, calculateMetrics };