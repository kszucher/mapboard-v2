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

  // 4. Create nodes
  const nodeAId = await db.insert('nodes', {
    mapId,
    iid: 1,
    offsetX: 100,
    offsetY: 100,
    isProcessing: false,
    width: 100,
    height: 200,
    color: 'gray',
    label: 'a',
  });

  const nodeBId = await db.insert('nodes', {
    mapId,
    iid: 2,
    offsetX: 300,
    offsetY: 100,
    isProcessing: false,
    width: 100,
    height: 200,
    color: 'gray',
    label: 'b',
  });

  // 5. Create edge
  await db.insert("edges", {
    mapId,
    fromNodeId: nodeAId,
    toNodeId: nodeBId,
  });

  return { userId, mapId, nodes: [nodeAId, nodeBId] };
});
