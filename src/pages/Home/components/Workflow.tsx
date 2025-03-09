import { useState, useEffect } from 'react';
import './Workflow.scss';
import { Input, Button, Timeline, message } from 'antd';
import { DeleteOutlined, CheckCircleFilled } from '@ant-design/icons';

const { TextArea } = Input;

interface WorkflowProps {
    onSend?: (data: { tasks: string[] }) => Promise<void>;
    curCompletedTask?: string; // Add this prop
}


const Workflow: React.FC<WorkflowProps> = ({ onSend, curCompletedTask }) => {
    const [tasks, setTasks] = useState<string[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [timelineItems, setTimelineItems] = useState<any[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false); // New state to track if tasks have been submitted

    const handleAddTask = () => {
        if (inputValue.trim()) {
            setTasks([...tasks, inputValue.trim()]);
            setInputValue('');
        } else {
            message.warning('Task cannot be empty');
        }
    };

    const handleDeleteTask = (index: number) => {
        const newTasks = [...tasks];
        newTasks.splice(index, 1);
        setTasks(newTasks);
    };

    const handleSend = async () => {
        if (tasks.length === 0) {
            message.warning('Please add at least one task');
            return;
        }

        if (onSend) {
            try {
                await onSend({ tasks });
                setIsSubmitted(true); // Set submitted state to true after successful sending
                message.success('Tasks sent successfully');
            } catch (error) {
                message.error('Failed to send tasks');
                console.error(error);
            }
        } else {
            console.log('Tasks to send:', tasks);
        }
    };

    const handleClearAllTasks = () => {
        if (tasks.length === 0) {
            message.info('No tasks to clear');
            return;
        }

        setTasks([]);
        message.success('All tasks cleared');
    };

    // Update timeline items when tasks change or submission status changes
    useEffect(() => {
        const items = tasks.map(task => ({
            color: 'gray',
            children: (
                <div className="task-item">
                    <span>{task}</span>
                    {!isSubmitted && ( // Only show delete button if tasks haven't been submitted
                        <DeleteOutlined
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(tasks.indexOf(task));
                            }}
                            className="delete-icon"
                        />
                    )}
                </div>
            ),
        }));

        // Add completion step if tasks exist
        if (tasks.length > 0) {
            items.push({
                color: 'gray',
                dot: <CheckCircleFilled />,
                children: 'Processing complete',
            });
        }

        setTimelineItems(items);
    }, [tasks, isSubmitted]); // Add isSubmitted as dependency

    // Reset isSubmitted when tasks are cleared or modified
    useEffect(() => {
        if (tasks.length === 0) {
            setIsSubmitted(false);
        }
    }, [tasks]);

    // Update timeline item colors when a task completes
    useEffect(() => {
        if (!curCompletedTask || tasks.length === 0) return;

        setTimelineItems(prev => {
            const newItems = [...prev];

            // Find the index of the completed task
            const completedIndex = tasks.findIndex(task => task === curCompletedTask);

            if (completedIndex !== -1) {
                // Highlight the completed task
                newItems[completedIndex] = {
                    ...newItems[completedIndex],
                    color: undefined // Remove gray color to show default color
                };

                // Check if this is the last task (excluding the completion step)
                const isLastTask = completedIndex === tasks.length - 1;

                // If it's the last task, also highlight the completion step
                if (isLastTask && newItems.length > tasks.length) {
                    const lastIndex = newItems.length - 1;
                    newItems[lastIndex] = {
                        ...newItems[lastIndex],
                        color: '#00CCFF' // Use the same color as in Planner
                    };
                }
            }

            return newItems;
        });
    }, [curCompletedTask, tasks]);

    return (
        <div className="workflow-container">
            <div className="task-list">
                {tasks.length > 0 ? (
                    <Timeline items={timelineItems} />
                ) : (
                    <div className="empty-state">
                        No tasks added yet. Use the box below to add tasks.
                    </div>
                )}
            </div>
            <div className="input-area">
                <TextArea
                    className="workflow-textarea"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Add a new task..."
                    autoSize={{ minRows: 4, maxRows: 4 }}
                    disabled={isSubmitted} // Disable input when tasks are submitted
                />
                <div className="buttons-container">
                    <Button
                        className="clearAllButton"
                        type="default"
                        danger
                        onClick={handleClearAllTasks}
                        disabled={tasks.length === 0}
                    >
                        Clear All
                    </Button>
                    <Button
                        type="default"
                        onClick={handleAddTask}
                        disabled={isSubmitted} // Disable add button when tasks are submitted
                    >
                        Add Task
                    </Button>
                    <Button
                        className="sendButton"
                        type="primary"
                        onClick={handleSend}
                        disabled={tasks.length === 0 || isSubmitted} // Disable send button when tasks are submitted
                    >
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Workflow;