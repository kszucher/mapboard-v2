import { query, mutation } from "./_generated/server"

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


  return { userId, mapId };
});
