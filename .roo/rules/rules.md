# CRITICAL PROTOCOL: PRE-TASK MEMORY AUDIT
1. You are equipped with a local episodic memory system via MCP. 
2. Before writing code, reading files, or answering the user's first prompt, you MUST immediately call the `agentmemory` search or context tools (e.g., `get_context` or `search_memory`).
3. Query the memory using keywords related to the current workspace and task goals to find what has already been attempted, what failed, and the current file setup.
4. Read the retrieved context carefully. Do not repeat documented errors, abandoned paths, or incorrect configurations.
5. Once your task is successful or a specific path definitively fails, you MUST call the appropriate memory storage tool to log the outcome before declaring the task complete.