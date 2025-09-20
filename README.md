# MCPMark Community Experiments

A community-driven repository for evaluating and benchmarking MCP (Model Context Protocol) servers and agent frameworks using the MCPMark framework. This project has two main purposes:

1. **Benchmark different MCP Server implementations** under the same model to compare their performance and capabilities
2. **Benchmark different agent frameworks** to evaluate their effectiveness in working with MCP servers

All evaluations are conducted using the MCPMark to ensure consistent and comparable results. The project aggregates evaluation results to provide comprehensive performance metrics and insights across both dimensions.

## 📊 Current Results

The evaluation results are automatically aggregated and available in `mcp_servers.json`. This file contains:

- Performance metrics (pass@1, pass@k rates)
- Token usage and cost analysis  
- Execution time statistics
- Metadata for each MCP server implementation

## 🏗️ Repository Structure

```
mcp_servers/
├── github/
│   ├── your-mcp-server/          # Your GitHub MCP Server
│   └── official/                 # GitHub's Official MCP Server
└── notion/
    └── official/                 # Notion's Official MCP Server
```

Each server directory contains:
- `meta.json` - Server metadata (author, description, homepage, etc.)
- `run-1/`, `run-2/`, etc. - Evaluation run results

## 🤝 Contributing

We welcome contributions from the MCP community! You can help by:

### Adding New MCP Servers

1. **Fork this repository**

2. **Add your MCP server directory structure:**
   ```
   mcp_servers/
   └── your-server-name/
       └── your-implementation/
           ├── meta.json
           └── run-*/
               ├── summary.json
               └── task-results/
   ```

3. **Create `meta.json` with your server information:**
   ```json
   {
     "author": {
       "name": "Your Name/Organization",
       "url": "https://your-website.com"
     },
     "avatar": "https://your-avatar-url.com/avatar.png",
     "description": "Description of your MCP server and its capabilities",
     "homepage": "https://your-server-homepage.com",
     "name": "Your MCP Server Name"
   }
   ```

4. **Include evaluation results** following the established format

5. **Submit a Pull Request** with:
   - Clear description of your MCP server
   - Link to the server's repository/documentation
   - Brief explanation of evaluation methodology used

### Improving Evaluation Methods

- Suggest new evaluation metrics or benchmarks
- Improve the aggregation scripts
- Add analysis tools and visualizations
- Report issues or suggest improvements

### Guidelines

- Ensure your evaluation data is reproducible
- Follow the existing directory structure
- Include comprehensive metadata
- Test that your additions work with the aggregation script

## 📋 Evaluation Metrics

The aggregation includes:

- **Pass@k rates**: Success rate across multiple evaluation runs
- **Token usage**: Input/output token consumption and costs
- **Execution time**: Agent performance timing
- **Task completion**: Success rates for different task types

## 🚀 Getting Started

1. Clone the repository
2. Explore existing MCP server results in `mcp_servers.json`
3. Check individual server directories for detailed results
4. Consider contributing your own MCP server evaluations!