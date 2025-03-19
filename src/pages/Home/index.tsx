import './home.scss';
import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, Select, notification } from 'antd';
import Planner from './components/Planner';
import ConsoleBox from './components/ConsoleBox';
import { WebSocketClient } from '../../apis';
import { PROVIDERS, PLANNER_MODELS, DISPATCHER_MODELS, EXECUTOR_MODELS } from './modelOptions';
import { ApiFilled } from '@ant-design/icons';

const provider_options = PROVIDERS.map(value => ({ value, label: value }));
const planner_model_options = PLANNER_MODELS.map(value => ({ value, label: value }));
const dispatcher_model_options = DISPATCHER_MODELS.map(value => ({ value, label: value }));
const executor_model_options = EXECUTOR_MODELS.map(value => ({ value, label: value }));

const Home = () => {
    const [showConnectModal, setShowConnectModal] = useState(true);
    const [computerIP, setComputerIP] = useState('');
    const [computerToken, setComputerToken] = useState('');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const logContentRef = useRef<HTMLDivElement>(null);
    const [isConnected, setIsConnected] = useState(false);
    const wsClientRef = useRef<WebSocketClient | null>(null);
    const [subtasks, setSubtasks] = useState<object[]>([]);
    const [tasks, setTasks] = useState<object[]>([]);
    const [curCompletedTask, setCurCompletedTask] = useState('');
    const [screenshotUrl, setScreenshotUrl] = useState<string>('');
    const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
    const prevImageRef = useRef<string>('');
    const [connectionError, setConnectionError] = useState<string>('');
    const [notificationHandler, contextHolder] = notification.useNotification();

    const [info, setInfo] = useState({
        planner_model: '',
        planner_provider: '',
        planner_api_key: '',
        planner_base_url: '',
        executor_model: '',
        executor_provider: '',
        executor_api_key: '',
        executor_base_url: '',
        dispatcher_model: '',
        dispatcher_provider: '',
        dispatcher_api_key: '',
        dispatcher_base_url: ''
    });

    useEffect(() => {
        if (logContentRef.current) {
            logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
        }
    }, [subtasks]);

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
                        setTasks(data.intermediate_output.tasks);
                    } else if (data.role === "dispatcher" && data.intermediate_output?.subtasks) {
                        // Convert each action to a JSON string
                        setSubtasks(prev => [...prev, ...data.intermediate_output.subtasks]);
                        setCurCompletedTask(data.intermediate_output.task.task);
                    }
                }
                else if (data.message === "Process complete") {
                    setCurCompletedTask("Process complete");
                } else if (data.message === "Process interruption") {
                    notificationHandler.error({
                        message: 'Process interruption',
                        description: 'The process is interrupted. Please check the error details on the server.',
                        duration: 0, // Set duration to 0 to make it persistent
                        showProgress: true,
                        placement: 'topLeft',
                    });
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

    const handlePlannerSend = async (data: { query: string}) => {
        if (!wsClientRef.current || !isConnected) {
            notificationHandler.error({
                message: 'Connection Error',
                description: 'Please connect to a computer first',
                duration: 3,
                placement: 'topLeft',
            });
            return;
        }
        setSubtasks([]);
        try {
            await wsClientRef.current.sendAgentRequest({
                planner_model: info.planner_model,
                planner_provider: info.planner_provider,
                planner_api_key: info.planner_api_key,
                planner_base_url: info.planner_base_url,
                dispatcher_model: info.dispatcher_model,
                dispatcher_provider: info.dispatcher_provider,
                dispatcher_api_key: info.dispatcher_api_key,
                dispatcher_base_url: info.dispatcher_base_url,
                executor_model: info.executor_model,
                executor_provider: info.executor_provider,
                executor_api_key: info.executor_api_key,
                executor_base_url: info.executor_base_url,
                user_query: data.query
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
                    cappuccino
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
                                <ApiFilled style={{ fontSize: '48px', color: '#1890ff' }} />
                            )}
                        </div>
                    </div>
                    <div className="log-window">
                        <div className="window-title">Dispatcher Console</div>
                        <div className='log-content' ref={logContentRef}>
                            {subtasks.map((item, index) => (
                                <ConsoleBox key={index} message={item} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="main-right">
                    <div className="window-title">Workspace - Planner</div>
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
                            <div className="section-title">Dispatcher Settings</div>
                            <label>
                                Dispatcher Model
                                <Select
                                    value={info.dispatcher_model}
                                    onChange={(value) => handleSelectChange('dispatcher_model', value)}
                                    variant="filled"
                                    options={dispatcher_model_options}
                                />
                            </label>
                            <label>
                                Dispatcher Provider
                                <Select
                                    value={info.dispatcher_provider}
                                    onChange={(value) => handleSelectChange('dispatcher_provider', value)}
                                    variant="filled"
                                    options={provider_options}
                                />
                            </label>
                            <label>
                                Dispatcher API Key
                                <Input
                                    type="text"
                                    name="dispatcher_api_key"
                                    value={info.dispatcher_api_key}
                                    onChange={handleInputChange}
                                    variant="filled"
                                />
                            </label>
                            <label>
                                Dispatcher Base URL
                                <Input
                                    type="text"
                                    name="dispatcher_base_url"
                                    value={info.dispatcher_base_url}
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
                        <Planner onSend={handlePlannerSend} tasks={tasks} curCompletedTask={curCompletedTask}/> 
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