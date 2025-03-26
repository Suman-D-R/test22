'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import mqtt from 'mqtt';
import ConnectPopup from './components/ConnectPopup';
import { Notify } from 'notiflix/build/notiflix-notify-aio';

export default function Home() {
  const [showPopup, setShowPopup] = useState(false);
  const [pageStatus, setPageStatus] = useState({ type: 'idle', message: '' });
  const [walletInfo, setWalletInfo] = useState(null);
  const mqttRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userData, setUserData] = useState({
    userId: '',
    operatorId: '',
    token: '',
  });
  const [result, setResult] = useState(null);
  const [betResponse, setBetResponse] = useState(null);
  const [participantsData, setParticipantsData] = useState([]);
  const [cashOutResponse, setCashOutResponse] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    gameId: '70010',
  });

  // Store configuration
  const gameId = formData.gameId; // Use form data for game ID
  const storeHouse = {
    mqttRef,
    authData: userData,
  };

  const connectToMQTT = useCallback(async () => {
    const MQTTSubscribeToTopics = [
      `user-sessions/${userData?.userId}:${userData?.operatorId}`,
      `aura/wall_info/${userData?.userId}:${userData?.operatorId}`,
    ];

    try {
      console.log('Connecting to MQTT');
      setPageStatus({
        type: 'loading',
        message: 'Connecting to Server',
      });

      const mqttIp = process.env.NEXT_PUBLIC_MQTT_URL;
      mqttRef.current = await mqtt.connect(mqttIp, {
        keepalive: 0,
        clientId: `${userData?.userId}:${userData?.operatorId}`,
        username: userData?.token,
        reconnectPeriod: 0,
      });

      mqttRef.current.on('connect', () => {
        console.log('MQTT Connected');
        setIsConnected(true);
        setPageStatus({
          type: 'loading',
          message: 'Connected to Server',
        });
      });

      mqttRef.current.on('close', () => {
        console.log('MQTT Closed');
        setIsConnected(false);
        setPageStatus({
          type: 'error',
          message: 'Server Connection Closed',
        });
      });

      mqttRef.current.on('offline', () => {
        setIsConnected(false);
        setPageStatus({
          type: 'error',
          message: 'Server Connection Offline',
        });
      });

      mqttRef.current.on('error', () => {
        setIsConnected(false);
        setPageStatus({
          type: 'error',
          message: 'Connection Error',
        });
      });

      let interval = setInterval(function () {
        createSession().then((data) => {
          if (data?.keys?.length > 0) {
            publishMqttMessage(
              mqttRef.current,
              `user-sessions/${userData?.userId}:${userData?.operatorId}`,
              data
            );
          }
        });
      }, 5000);

      mqttRef.current.subscribe(MQTTSubscribeToTopics, (err) => {
        if (err) {
          console.log('MqttClient subscribe error: ', err);
          setPageStatus({
            type: 'error',
            message: 'Server Connection Error',
          });
        } else {
          console.log('MQTT Subscribed');
          setPageStatus({
            type: 'success',
            message: 'Connected to Server',
          });
        }
      });

      mqttRef.current.on('message', (topic, message) => {
        try {
          if (message.length > 0) {
            if (
              topic ===
              `aura/wall_info/${userData?.userId}:${userData?.operatorId}`
            ) {
              message = message.toString();
              message = JSON.parse(message);
              setWalletInfo(message);
            }
          }
        } catch (error) {
          console.error('Error parsing incoming message:', error);
        }
      });

      return interval;
    } catch (error) {
      console.log(error);
      setPageStatus({
        type: 'error',
        message: error?.message || 'Server Connection Error',
      });
    }
  }, [userData]);

  const handleConnect = () => {
    setShowPopup(false);
    connectToMQTT();
  };

  const publishMqttMessage = (client, topic, message) => {
    if (client && client.connected) {
      client.publish(topic, JSON.stringify(message));
    }
  };

  const createSession = async () => {
    // Implement your session creation logic here
    return { keys: [] };
  };

  const MQTTSubscribeToTopics = [
    `aura/graphCrash`,
    `data_res/user_bets/${userData?.userId}:${userData?.operatorId}:${gameId}`,
    `crashCashout_res/${userData?.userId}:${userData?.operatorId}:${gameId}`,
  ];

  // Message handler
  const handleMqttMessage = useCallback(
    (topic, message) => {
      try {
        message = JSON.parse(message.toString());

        if (topic === MQTTSubscribeToTopics[0]) {
          if (message.data) {
            setResult(message.data);
          } else {
            Notify.warning('Something went wrong');
          }
        }
        if (topic === MQTTSubscribeToTopics[1]) {
          if (message.success) {
            setBetResponse(message?.result);
          } else {
            Notify.warning(message?.message || 'Something went wrong');
          }
        }

        if (topic === MQTTSubscribeToTopics[2]) {
          if (message.success) {
            // setCashOutResponse(message.data);
            Notify.success(`Cash out successful ${message?.data?.win}`);
            // console.log(message);
          }
        }
      } catch (error) {
        console.error('Error parsing incoming message:', error);
      }
    },
    [MQTTSubscribeToTopics]
  );

  // subscribe to mqtt topics function
  const subscribeMqtt = useCallback(() => {
    return new Promise((resolve) => {
      if (!mqttRef.current) {
        resolve({ numberOfLoops: 0 });
        return;
      }

      // Remove existing message listener if any
      mqttRef.current.removeAllListeners('message');

      // Add new message listener
      mqttRef.current.on('message', handleMqttMessage);

      mqttRef.current.subscribe(MQTTSubscribeToTopics, (err) => {
        if (err) {
          console.error('MqttClient subscribe error: ', err);
          resolve({ numberOfLoops: 0 });
        } else {
          resolve({ numberOfLoops: 1 });
        }
      });
    });
  }, [MQTTSubscribeToTopics, handleMqttMessage]);

  useEffect(() => {
    if (mqttRef.current && mqttRef.current.connected) {
      subscribeMqtt();
    }
    return () => {
      if (mqttRef.current) {
        mqttRef.current.removeAllListeners('message');
        mqttRef.current.unsubscribe(MQTTSubscribeToTopics);
      }
    };
  }, [mqttRef.current]);

  //handle play
  const handlePlay = useCallback(
    async (amount) => {
      if (!mqttRef.current || !userData) {
        Notify.warning('Please connect to server first');
        return;
      }

      if (result?.status !== 'RUN') {
        Notify.warning('wait');
        return;
      }

      const betObject = {
        betAmount: amount,
        token: userData?.token,
        roundId: result?.roundId,
        gameId: gameId,
      };

      await publishMqttMessage(
        mqttRef.current,
        `aura_bets/${userData?.userId}:${userData?.operatorId}:${gameId}`,
        betObject
      );
    },
    [gameId, result?.roundId, userData]
  );

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.gameId) {
      Notify.warning('Please fill in all fields');
      return;
    }
    handlePlay(parseFloat(formData.amount));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDisconnect = useCallback(() => {
    if (mqttRef.current) {
      mqttRef.current.end(true, {}, () => {
        console.log('MQTT Disconnected');
        setIsConnected(false);
        setPageStatus({
          type: 'idle',
          message: 'Disconnected from Server',
        });
        setWalletInfo(null);
        setResult(null);
        setBetResponse(null);
        setParticipantsData([]);
        setCashOutResponse(null);
        mqttRef.current = null;
      });
    }
  }, []);

  //handle cash out
  const handleCashOut = useCallback(
    async (betId) => {
      try {
        const body = {
          cashOutAtMultiplier: result?.multiplier,
          token: userData?.token,
          betId: betId,
          roundId: result?.roundId,
          gameId: gameId,
        };

        await publishMqttMessage(
          mqttRef.current,
          `crashCashout/${userData?.userId}:${userData?.operatorId}:${gameId}`,
          body
        );
      } catch (error) {
        console.log(error || 'error in cash out');
      }
    },
    [gameId, result?.roundId, result?.multiplier, userData?.token]
  );

  useEffect(() => {
    handleCashOut(betResponse?._id);
  }, [betResponse]);

  return (
    <div className='flex flex-col items-center justify-center min-h-screen p-4'>
      <div className='w-full max-w-md space-y-6'>
        {!isConnected ? (
          <button
            onClick={() => setShowPopup(true)}
            className='w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded'
          >
            Connect to MQTT
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className='w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded'
          >
            Disconnect
          </button>
        )}

        {pageStatus.message && (
          <div
            className={`p-4 rounded ${
              pageStatus.type === 'error'
                ? 'bg-red-100 text-red-700'
                : pageStatus.type === 'success'
                ? 'bg-green-100 text-green-700'
                : pageStatus.type === 'idle'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {pageStatus.message}
          </div>
        )}

        {result && (
          <div className=''>
            <p>Round ID: {result?.roundId}</p>
            <p>Status: {result?.status}</p>
            <p>Multiplier: {result?.multiplier}</p>
          </div>
        )}

        {isConnected && userData && (
          <form onSubmit={handleFormSubmit} className='space-y-4'>
            <div>
              <label
                htmlFor='amount'
                className='block text-sm font-medium text-gray-700'
              >
                Amount
              </label>
              <input
                type='number'
                id='amount'
                name='amount'
                value={formData.amount}
                onChange={handleInputChange}
                min='0'
                step='0.01'
                className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                placeholder='Enter amount'
                required
              />
            </div>

            <div>
              <label
                htmlFor='gameId'
                className='block text-sm font-medium text-gray-700'
              >
                Game ID
              </label>
              <input
                type='text'
                id='gameId'
                name='gameId'
                value={formData.gameId}
                onChange={handleInputChange}
                className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500'
                placeholder='Enter game ID'
                required
              />
            </div>

            <button
              type='submit'
              className='w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded'
            >
              Place Bet
            </button>
          </form>
        )}

        {showPopup && (
          <ConnectPopup
            onConnect={handleConnect}
            onClose={() => setShowPopup(false)}
            credentials={userData}
            setCredentials={setUserData}
          />
        )}

        {walletInfo && (
          <div className='p-4 bg-gray-100 rounded'>
            <h2 className='text-xl font-bold mb-2'>Wallet Info</h2>
            <pre className='whitespace-pre-wrap overflow-auto max-h-60'>
              {JSON.stringify(walletInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
