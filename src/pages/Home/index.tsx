import './home.scss';
import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, Select, notification } from 'antd'; // Import Input, Select, and notification from antd
import Planner from './components/Planner';
import Workflow from './components/Workflow';
import DialogBox from './components/DialogBox'; // Import DialogBox component
import { WebSocketClient } from '../../apis';
import { PROVIDERS, PLANNER_MODELS, EXECUTOR_MODELS } from '../../constants/modelOptions';

interface PlannerRequest {
    query: string;
}

const provider_options = PROVIDERS.map(value => ({ value, label: value }));
const planner_model_options = PLANNER_MODELS.map(value => ({ value, label: value }));
const executor_model_options = EXECUTOR_MODELS.map(value => ({ value, label: value }));

const Home = () => {
    const [showConnectModal, setShowConnectModal] = useState(true);
    const [computerIP, setComputerIP] = useState('');
    const [computerToken, setComputerToken] = useState('');
    const [showPlanner, setShowPlanner] = useState(true);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const logContentRef = useRef<HTMLDivElement>(null);
    const [isConnected, setIsConnected] = useState(false);
    const wsClientRef = useRef<WebSocketClient | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [plannerTasks, setPlannerTasks] = useState<string[]>([]);
    const [curCompletedTask, setCurCompletedTask] = useState('');
    const [screenshotUrl, setScreenshotUrl] = useState<string>('');
    const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
    const prevImageRef = useRef<string>('');
    const [connectionError, setConnectionError] = useState<string>('');

    const [info, setInfo] = useState({
        planner_model: '',
        planner_provider: '',
        planner_api_key: '',
        planner_base_url: '',
        executor_model: '',
        executor_provider: '',
        executor_api_key: '',
        executor_base_url: ''
    });

    const [notificationHandler, contextHolder] = notification.useNotification();

    useEffect(() => {
        if (logContentRef.current) {
            logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        const storedInfo = localStorage.getItem('settingsInfo');
        if (storedInfo) {
            setInfo(JSON.parse(storedInfo));
        }
    }, []);

    useEffect(() => {
        // Load previously used connection details from localStorage
        const storedIP = localStorage.getItem('computerIP');
        if (storedIP) {
            setComputerIP(storedIP);
        }
        
        const storedToken = localStorage.getItem('computerToken');
        if (storedToken) {
            setComputerToken(storedToken);
        }
        
        // Cleanup WebSocket connection when component unmounts
        return () => {
            handleDisconnect();
        };
    }, []);

    useEffect(() => {
        if (wsClientRef.current) {
            wsClientRef.current.onMessage((data) => {
                if (data.message === "Process processing") {
                    if (data.role === "planner" && data.intermediate_output?.tasks) {
                        setPlannerTasks(data.intermediate_output.tasks);
                    } else if (data.role === "executor" && data.intermediate_output?.actions) {
                        // Convert each action to a JSON string
                        const actionLogs = data.intermediate_output.actions.map(
                            (action: any) => JSON.stringify(action.arguments)
                        );
                        setLogs(prev => [...prev, ...actionLogs]);
                        setCurCompletedTask(data.intermediate_output.task)
                    }
                }
            });
            
            // Set up the screenshot stream handler
            wsClientRef.current.onImage((imageUrl) => {
                // Store the previous URL for smooth transition
                prevImageRef.current = screenshotUrl;
                setScreenshotUrl(imageUrl);
            });
            
            // Set up the connection state handler
            wsClientRef.current.onConnectionState((isConnected) => {
                setIsConnected(isConnected);
                if (!isConnected) {
                    setConnectionError('Connection lost. Please reconnect.');
                    setShowConnectModal(true);
                    // Clear screenshot when disconnected
                    prevImageRef.current = '';
                    setScreenshotUrl('');
                    setIsImageLoading(true);
                    
                    // Show notification about disconnection
                    notificationHandler.error({
                        message: 'Connection Lost',
                        description: 'The connection to the computer has been lost. Please reconnect.',
                        duration: 5,
                        showProgress: true,
                        placement: 'topLeft',
                    });
                }
            });
        }
    }, [wsClientRef.current]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setInfo(prevData => ({ ...prevData, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setInfo(prevData => ({ ...prevData, [name]: value }));
    };

    const handleOk = () => {
        localStorage.setItem('settingsInfo', JSON.stringify(info));
        setShowSettingsModal(false);
    };

    const handleCancel = () => {
        const storedInfo = localStorage.getItem('settingsInfo');
        if (storedInfo) {
            setInfo(JSON.parse(storedInfo));
        }
        setShowSettingsModal(false);
    };

    const showSuccessNotification = () => {
        notificationHandler.success({
            message: 'Connection Successful',
            description: `Successfully connected to ${computerIP}`,
            duration: 3,
            showProgress: true,
            pauseOnHover: true,
            placement: 'topLeft',
        });
    };

    const showErrorNotification = (error: any) => {
        notificationHandler.error({
            message: 'Connection Failed',
            description: error.message === "Token verification failed" 
                ? "Token verification failed. Please check your token and try again."
                : error.message || 'Failed to connect to the computer',
            duration: 3,
            showProgress: true,
            pauseOnHover: true,
            placement: 'topLeft',
        });
    };

    const handleConnect = async () => {
        try {
            // Clear any previous connection error
            setConnectionError('');
            
            // Extract hostname without port for the constructor
            const hostname = computerIP.split(':')[0];
            wsClientRef.current = new WebSocketClient(hostname);
            await wsClientRef.current.connect(computerToken);
            setIsConnected(true);
            setShowConnectModal(false);
            showSuccessNotification();
            
            // Save connection details to localStorage
            localStorage.setItem('computerIP', computerIP);
            localStorage.setItem('computerToken', computerToken);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
            setConnectionError(errorMessage);
            showErrorNotification(error);
            handleDisconnect();
        }
    };

    const handleDisconnect = () => {
        if (wsClientRef.current) {
            wsClientRef.current.disconnect();
            wsClientRef.current = null;
        }
        setIsConnected(false);
        // Clear screenshot when disconnected
        prevImageRef.current = '';
        setScreenshotUrl('');
        setIsImageLoading(true);
    };

    const handlePlannerSend = async (data: PlannerRequest) => {
        if (!wsClientRef.current || !isConnected) {
            notificationHandler.error({
                message: 'Connection Error',
                description: 'Please connect to a computer first',
                duration: 3,
                placement: 'topLeft',
            });
            return;
        }
        setLogs([]);
        try {
            await wsClientRef.current.sendAgentRequest({
                agent_type: 'planner',
                planner_model: info.planner_model,
                planner_provider: info.planner_provider,
                planner_api_key: info.planner_api_key,
                planner_base_url: info.planner_base_url,
                executor_model: info.executor_model,
                executor_provider: info.executor_provider,
                executor_api_key: info.executor_api_key,
                executor_base_url: info.executor_base_url,
                user_query: data.query,
                user_tasks: [],
            });
        } catch (error) {
            notificationHandler.error({
                message: 'Request Failed',
                description: error instanceof Error ? error.message : 'Failed to send request',
                duration: 3,
                placement: 'topLeft',
            });
        }
    };

    const handleWorkflowSend = async (data: { tasks: string[] }) => {
        if (!wsClientRef.current || !isConnected) {
            notificationHandler.error({
                message: 'Connection Error',
                description: 'Please connect to a computer first',
                duration: 3,
                placement: 'topLeft',
            });
            return;
        }
        setLogs([]);
        try {
            await wsClientRef.current.sendAgentRequest({
                agent_type: 'workflow',
                planner_model: info.planner_model,
                planner_provider: info.planner_provider,
                planner_api_key: info.planner_api_key,
                planner_base_url: info.planner_base_url,
                executor_model: info.executor_model,
                executor_provider: info.executor_provider,
                executor_api_key: info.executor_api_key,
                executor_base_url: info.executor_base_url,
                user_query: '',
                user_tasks: data.tasks,
            });
        } catch (error) {
            notificationHandler.error({
                message: 'Request Failed',
                description: error instanceof Error ? error.message : 'Failed to send request',
                duration: 3,
                placement: 'topLeft',
            });
        }
    };

    // Handle image loading events
    const handleImageLoad = () => {
        setIsImageLoading(false);
    };

    const handleImageError = () => {
        setIsImageLoading(false);
        // If image fails to load, use the previous valid image or fallback
        if (prevImageRef.current) {
            setScreenshotUrl(prevImageRef.current);
        }
    };

    return (
        <div className="home">
            {contextHolder}
            <div className="header">
                <div className="header-left">
                    AutoMate
                </div>
                <div className="header-right">
                    {isConnected ? (
                        <span>Computer IP: {computerIP}</span>
                    ) : (
                        <span>Not connected</span>
                    )}
                </div>
            </div>
            <div className="main">
                <div className="main-left">
                    <div className="screenshot-window">
                        <div className="window-title">Desktop</div>
                        <div className="image-container">
                            {screenshotUrl ? (
                                <img 
                                    src={screenshotUrl} 
                                    alt="Screenshot"
                                    onLoad={handleImageLoad}
                                    onError={handleImageError}
                                    style={{
                                        opacity: isImageLoading ? 0.5 : 1,
                                        transition: 'opacity 0.2s ease-in-out'
                                    }}
                                />
                            ) : (
                                <img 
                                    src='AutoMate-logo.png' 
                                    alt="AutoMate Logo" 
                                />
                            )}
                        </div>
                    </div>
                    <div className="log-window">
                        <div className="window-title">Executor Console</div>
                        <div className='log-content' ref={logContentRef}>
                            {logs.map((item, index) => (
                                <DialogBox key={index} message={item} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="main-right">
                    <div className="window-title">Workspace - {showPlanner ? 'Planner' : 'Workflow'}</div>
                    <button
                        className="toggle-button"
                        onClick={() => setShowPlanner(!showPlanner)}
                    >
                        {showPlanner ? 'Switch to Workflow' : 'Switch to Planner'}
                    </button>
                    <button
                        className="settings-button"
                        onClick={() => setShowSettingsModal(true)}
                    >
                        Settings
                    </button>
                    <Modal
                        title="Settings"
                        open={showSettingsModal}
                        onOk={handleOk}
                        onCancel={handleCancel}
                        className="ant-modal-settings"  // Add this class
                        footer={[
                            <Button key="back" onClick={handleCancel}>
                                Cancel
                            </Button>,
                            <Button key="submit" type="primary" onClick={handleOk} style={{ backgroundColor: '#3a3a3a' }}>
                                OK
                            </Button>,
                        ]}
                    >
                        <div className="modal-content">
                            <div className="section-title">Planner Settings</div>
                            <label>
                                Planner Model
                                <Select
                                    value={info.planner_model}
                                    onChange={(value) => handleSelectChange('planner_model', value)}
                                    variant="filled"
                                    options={planner_model_options}
                                />
                            </label>
                            <label>
                                Planner Provider
                                <Select
                                    value={info.planner_provider}
                                    onChange={(value) => handleSelectChange('planner_provider', value)}
                                    variant="filled"
                                    options={provider_options}
                                />
                            </label>
                            <label>
                                Planner API Key
                                <Input
                                    type="text"
                                    name="planner_api_key"
                                    value={info.planner_api_key}
                                    onChange={handleInputChange}
                                    variant="filled"
                                />
                            </label>
                            <label>
                                Planner Base URL
                                <Input
                                    type="text"
                                    name="planner_base_url"
                                    value={info.planner_base_url}
                                    onChange={handleInputChange}
                                    variant="filled"
                                    placeholder="This parameter is required when you deploy locally"
                                />
                            </label>
                            <div className="section-title">Executor Settings</div>
                            <label>
                                Executor Model
                                <Select
                                    value={info.executor_model}
                                    onChange={(value) => handleSelectChange('executor_model', value)}
                                    variant="filled"
                                    options={executor_model_options}
                                />
                            </label>
                            <label>
                                Executor Provider
                                <Select
                                    value={info.executor_provider}
                                    onChange={(value) => handleSelectChange('executor_provider', value)}
                                    variant="filled"
                                    options={provider_options}
                                />
                            </label>
                            <label>
                                Executor API Key
                                <Input
                                    type="text"
                                    name="executor_api_key"
                                    value={info.executor_api_key}
                                    onChange={handleInputChange}
                                    variant="filled"
                                />
                            </label>
                            <label>
                                Executor Base URL
                                <Input
                                    type="text"
                                    name="executor_base_url"
                                    value={info.executor_base_url}
                                    onChange={handleInputChange}
                                    variant="filled"
                                    placeholder="This parameter is required when you deploy locally"
                                />
                            </label>
                        </div>
                    </Modal>
                    <div className="component-container" style={{ height: 'calc(100% - 50px)' }}>
                        {showPlanner ? 
                            <Planner onSend={handlePlannerSend} tasks={plannerTasks} curCompletedTask={curCompletedTask}/> : 
                            <Workflow onSend={handleWorkflowSend} curCompletedTask={curCompletedTask} />
                        }
                    </div>
                </div>
            </div>
            <Modal
                title="Connect to Computer"
                open={showConnectModal}
                closable={false}
                footer={[
                    <Button key="submit" type="primary" onClick={handleConnect} style={{ backgroundColor: '#3a3a3a' }}>
                        Connect
                    </Button>,
                ]}
            >
                <div className="modal-content">
                    {connectionError && (
                        <div className="connection-error" style={{ color: 'red', marginBottom: '15px' }}>
                            {connectionError}
                        </div>
                    )}
                    <label>
                        Computer IP
                        <Input
                            type="text"
                            value={computerIP}
                            placeholder="e.g., 192.168.1.100"
                            onChange={(e) => setComputerIP(e.target.value)}
                        />
                    </label>
                    <label>
                        Computer Token
                        <Input
                            type="text"
                            value={computerToken}
                            onChange={(e) => setComputerToken(e.target.value)}
                        />
                    </label>
                </div>
            </Modal>
        </div>
    );
}

export default Home;