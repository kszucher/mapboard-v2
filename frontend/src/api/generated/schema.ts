/* eslint-disable */
// Generated OpenAPI types (placeholder; regenerate with `npm run generate:api`)

export interface paths {
  "/users/get-or-create": {
    post: {
      responses: {
        200: string;
      };
    };
  };
  "/users": {
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["UserCreate"];
        };
      };
      responses: {
        201: string;
      };
    };
  };
  "/users/{user_id}/active-graph": {
    get: {
      parameters: {
        path: {
          user_id: string;
        };
      };
      responses: {
        200: components["schemas"]["ActiveGraphResponse"];
      };
    };
  };
  "/users/set-active-graph": {
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["SetActiveGraph"];
        };
      };
      responses: {
        204: never;
      };
    };
  };
  "/graphs": {
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["GraphCreate"];
        };
      };
      responses: {
        201: string;
      };
    };
  };
  "/graphs/user/{user_id}": {
    get: {
      parameters: {
        path: {
          user_id: string;
        };
      };
      responses: {
        200: components["schemas"]["GraphRead"][];
      };
    };
  };
  "/nodes/graph/{graph_id}": {
    get: {
      parameters: {
        path: {
          graph_id: string;
        };
      };
      responses: {
        200: components["schemas"]["NodeRead"][];
      };
    };
  };
  "/nodes": {
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["NodeCreate"];
        };
      };
      responses: {
        201: string;
      };
    };
  };
  "/nodes/{node_id}": {
    patch: {
      parameters: {
        path: {
          node_id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": Record<string, unknown>;
        };
      };
      responses: {
        204: never;
      };
    };
    delete: {
      parameters: {
        path: {
          node_id: string;
        };
      };
      responses: {
        204: never;
      };
    };
  };
  "/edges/graph/{graph_id}": {
    get: {
      parameters: {
        path: {
          graph_id: string;
        };
      };
      responses: {
        200: components["schemas"]["EdgeRead"][];
      };
    };
  };
  "/edges": {
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["EdgeCreate"];
        };
      };
      responses: {
        201: string;
      };
    };
  };
  "/edges/{edge_id}": {
    delete: {
      parameters: {
        path: {
          edge_id: string;
        };
      };
      responses: {
        204: never;
      };
    };
  };
  "/edges/delete-by-handle": {
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["DeleteEdgesByHandle"];
        };
      };
      responses: {
        204: never;
      };
    };
  };
}

export interface components {
  schemas: {
    UserCreate: {
      user_name: string;
    };
    ActiveGraphResponse: {
      graph_id?: string | null;
    };
    SetActiveGraph: {
      user_id: string;
      graph_id: string;
    };
    GraphCreate: {
      user_id: string;
      graph_name: string;
    };
    GraphRead: {
      id: string;
      name: string;
      user_id: string;
    };
    NodeCreate: NodeBase;
    NodeRead: NodeBase & {
      id: string;
    };
    EdgeCreate: {
      graph_id: string;
      from_node_id: string;
      to_node_id: string;
      handle_index: number;
    };
    EdgeRead: EdgeCreate & {
      id: string;
    };
    DeleteEdgesByHandle: {
      from_node_id: string;
      deleted_handle_index: number;
    };
  };
}

type NodeBase = {
  graph_id: string;
  iid: number;
  width: number;
  height: number;
  offset_x: number;
  offset_y: number;
  color: string;
  label: string;
  num_handles: number;
  is_processing: boolean;
  node_type: "START" | "LOGIC" | "AGENT" | "LOGICAL_SWITCH" | "AGENTIC_SWITCH";
  node_type_start?: Record<string, unknown> | null;
  node_type_logic_input?: Record<string, unknown> | null;
  node_type_agent_input?: Record<string, unknown> | null;
  node_type_logical_switch_input?: Record<string, unknown> | null;
  node_type_agentic_switch_input?: Record<string, unknown> | null;
};

export type $defs = {};


