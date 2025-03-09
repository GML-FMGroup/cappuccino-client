export interface PlannerRequest {
    query: string;
}

export interface WorkflowRequest {
    tasks: string[];
}

export interface AgentRequest {
    agent_type: 'workflow' | 'planner';
    planner_model: string;
    planner_provider: string;
    planner_api_key: string;
    planner_base_url: string;
    executor_model: string;
    executor_provider: string;
    executor_api_key: string;
    executor_base_url: string;
    user_query: string;
    user_tasks: string[];
}
