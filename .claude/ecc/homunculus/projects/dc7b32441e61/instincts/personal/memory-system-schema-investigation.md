---
id: memory-system-schema-investigation
trigger: when exploring or modifying agent memory system (AgentMemory, memory scopes, retrieval)
confidence: 0.65
domain: workflow
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Database Schema Investigation Pattern for Memory System

## Action
When investigating agent memory system features, start by Grep-searching the database schema for AgentMemory, MemoryScope, and MemoryType to understand available fields and relationships; then Read the corresponding helper implementation files to understand how the schema is used.

## Evidence
- Observed 3 times in session d459a209-ca00-4c9e-8430-f638aa20f47e
- Pattern: Grep for schema pattern → Read load-agent helper → Grep memory classification
- Workflow: exploring identity plugin memory system, then database schema exploration, then helper implementations
- Last observed: 2026-03-18T00:59:08Z

## Context
The identity plugin uses a complex memory storage system with multiple scopes (THREAD, PROJECT, AGENT) and types (EPISODIC, SEMANTIC). The schema is in database package, helpers are in plugin source. Starting with schema Grep prevents redundant file reads and clarifies field names before reading implementations.
