import { query, mutation } from "./_generated/server"
import { v } from "convex/values";

export const createMap = mutation(async ({ db }) => {
  // 1. Create a user
  const userId = await db.insert("users", {
    name: "Alice",
    colorMode: "DARK",
  });

  // 2. Create a map
  const mapId = await db.insert("maps", {
    name: "My First Map",
    userId,
  });

  // 3. Create tools
  const toolAId = await db.insert("tools", {
    width: 100,
    height: 100,
    color: "blue",
    label: "Tool A",
  });

  const toolBId = await db.insert("tools", {
    width: 100,
    height: 100,
    color: "red",
    label: "Tool B",
  });

  // 4. Create nodes
  const nodeAId = await db.insert("nodes", {
    mapId,
    toolId: toolAId,
    iid: 1,
    offsetX: 100,
    offsetY: 100,
    isProcessing: false,
  });

  const nodeBId = await db.insert("nodes", {
    mapId,
    toolId: toolBId,
    iid: 2,
    offsetX: 300,
    offsetY: 100,
    isProcessing: false,
  });

  // 5. Create edge
  await db.insert("edges", {
    mapId,
    fromNodeId: nodeAId,
    toNodeId: nodeBId,
  });

  return { userId, mapId, nodes: [nodeAId, nodeBId] };
});
