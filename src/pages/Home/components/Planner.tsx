import { useState, useEffect } from 'react';
import './Planner.scss';
import { Input, Button, Timeline, Result, Spin, notification } from 'antd';
import { CheckCircleFilled, SmileOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface PlannerProps {
    onSend: (data: { query: string }) => Promise<void>;
    tasks: { task: string, prev_required: boolean }[];
    curCompletedTask: string;
}

const completionStep = {
    color: '#00CCFF',
    dot: <CheckCircleFilled />,
    children: 'Process complete',
};

const Planner: React.FC<PlannerProps> = ({ onSend, tasks, curCompletedTask }) => {
    const [query, setQuery] = useState('');
    const [showResult, setShowResult] = useState(true);
    const [timelineItems, setTimelineItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [notificationHandler, contextHolder] = notification.useNotification();

    const updateTimeline = (tasks: { task: string, prev_required: boolean }[]) => {
        if (tasks.length === 0) return;

        const items = tasks.map(task => ({
            color: 'gray',
            children: task.task
        }));
        
        // Add completion step with gray color initially
        items.push({
            ...completionStep,
            color: 'gray' // Start with gray for completion step too
        });
        
        setTimelineItems(items);
        setIsLoading(false); // Hide loading when timeline is ready
    };

    const highlightTask = (curCompletedTask: string) => {
        setTimelineItems(prevItems => {
            // Create a copy to modify
            const newItems = [...prevItems];

            // Find the first gray-colored task that matches the current completed task
            const completedIndex = newItems.findIndex(item => 
                item.children === curCompletedTask && item.color === 'gray'
            );

            if (completedIndex !== -1) {
                // Highlight the completed task
                newItems[completedIndex] = { 
                    ...newItems[completedIndex], 
                    color: undefined // Remove gray color to show default color
                };
            }

            if (curCompletedTask === "Process complete") {
                // Get the last item (completion step) and highlight it
                const lastIndex = newItems.length - 1;
                newItems[lastIndex] = {
                    ...completionStep // Use the original completionStep with its color
                };
            }

            return newItems;
        });
    };

    useEffect(() => {
        if (curCompletedTask) {
            highlightTask(curCompletedTask);
        }
    }, [curCompletedTask]);

    useEffect(() => {
        updateTimeline(tasks);
    }, [tasks]);

    const handleSend = async () => {
        if (!query.trim()){
            notificationHandler.warning({
                message: 'Warning',
                description: 'Please input query',
                duration: 3,
                showProgress: true,
                placement: 'topLeft',
            });
            return;
        } 
        setShowResult(false);
        setIsLoading(true); // Show loading when query is sent
        await onSend({ query: query.trim() });
        setQuery('');
    };

    return (
        <div className="planner-container">
            {contextHolder}
            <div className="middle-block">
                {showResult ? (
                    <Result
                        icon={<SmileOutlined />}
                        title="Welcome to send your query!"
                    />
                ) : isLoading ? (
                    <Spin tip="Planning according to your query..." size="large">
                        <div style={{ 
                            padding: 50, 
                            borderRadius: 4,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }} />
                    </Spin>
                ) : (
                    <Timeline items={timelineItems} />
                )}
            </div>
            <div className="bottom-block">
                <TextArea
                    className='textarea'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoSize={{ minRows: 4, maxRows: 4 }}
                    placeholder="Send your query..."
                />
                <Button 
                    className='sendButton' 
                    type="primary" 
                    onClick={handleSend}
                >
                    Send
                </Button>
            </div>
        </div>
    );
}

export default Planner;