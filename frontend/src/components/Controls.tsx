import { useState } from 'react';
import { useCameraDevices } from '@/hooks/useCameraDevices';
import { Socket } from 'socket.io-client';
import { StreamInitService } from '@/services/streamInitService';
import { type ModelType } from '@/App';

interface Stream {
  streamId: string;
  sourceType: 'camera' | 'video';
  deviceId?: string;
  deviceLabel?: string;
  videoFile?: File;
  processorConfig?: Record<string, any>;
  modelType: ModelType;
  active: boolean;
  createdAt: number;
}

interface ControlsProps {
  streams: Stream[];
  selectedStream: string | null;
  onStreamSelect: (streamId: string | null) => void;
  onAddStream: (streamId: string, sourceType: 'camera' | 'video', deviceId?: string, deviceLabel?: string, videoFile?: File, processorConfig?: Record<string, any>, modelType?: ModelType) => boolean;
  onRemoveStream: (streamId: string) => void;
  connected: boolean;
  socket: Socket | null;
}

export function Controls({
  streams,
  selectedStream,
  onStreamSelect,
  onAddStream,
  onRemoveStream,
  connected,
  socket
}: ControlsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    streamId: '',
    sourceType: 'camera' as 'camera' | 'video',
    modelType: 'mediapipe' as ModelType,
    deviceId: '',
    videoFile: null as File | null,
    configFile: null as File | null,
    processorConfig: {} as Record<string, any>
  });
  const [isCreating, setIsCreating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const { devices, loading: devicesLoading } = useCameraDevices();

  const handleConfigFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let config: Record<string, any> = {};

      if (file.name.endsWith('.json')) {
        config = JSON.parse(text);
      } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        alert('YAML support requires js-yaml library. Please use JSON format.');
        return;
      } else {
        alert('Only JSON files are supported');
        return;
      }

      setFormData({ 
        ...formData, 
        configFile: file,
        processorConfig: config 
      });
      console.log('Loaded config:', config);
    } catch (error) {
      console.error('Error parsing config file:', error);
      alert(`Failed to parse config file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCreateStream = async () => {
    if (!formData.streamId.trim()) return alert('Please enter a stream ID');
    if (formData.sourceType === 'camera' && !formData.deviceId) return alert('Please select a camera device');
    if (formData.sourceType === 'video' && !formData.videoFile) return alert('Please select a video file');
    if (!socket) return alert('Not connected to server');

    setIsCreating(true);
    setLoadingMessage('Initializing...');

    try {
      // Merge model type into processor config
      const config = {
        ...formData.processorConfig,
        pose_processor: {
          ...(formData.processorConfig.pose_processor || {}),
          processor_type: formData.modelType,
        }
      };

      // Initialize stream on backend first
      const result = await StreamInitService.initializeStream(
        socket,
        formData.streamId,
        config,
        (message: string) => {
          setLoadingMessage(message);
        },
        formData.sourceType
      );

      if (!result.success) {
        alert(`Failed to initialize stream: ${result.message}`);
        setIsCreating(false);
        setLoadingMessage('');
        return;
      }

      // If backend initialization succeeded, add to frontend
      const selectedDevice = devices.find(d => d.deviceId === formData.deviceId);
      const sourceLabel = formData.sourceType === 'camera' 
        ? selectedDevice?.label 
        : formData.videoFile?.name;
      
      if (onAddStream(
        formData.streamId,
        formData.sourceType,
        formData.deviceId,
        sourceLabel,
        formData.videoFile || undefined,
        config,
        formData.modelType
      )) {
        setFormData({
          streamId: '',
          sourceType: 'camera',
          modelType: 'mediapipe',
          deviceId: '',
          videoFile: null,
          configFile: null,
          processorConfig: {}
        });
        setShowAddForm(false);
      }
    } catch (error) {
      alert(`Error creating stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreating(false);
      setLoadingMessage('');
    }
  };
  const handleDeleteStream = (stream: Stream) => {
    if (confirm(`Delete stream "${stream.streamId}"?`)) {
      
      if (socket) {
        socket.emit('cleanup_processor', { stream_id: stream.streamId });
      }
      onRemoveStream(stream.streamId);
    }
  };

  return (
    <div className="controls">
      <div className="controls-header">
        <h2>Controls</h2>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={!connected}
        >
          {showAddForm ? '✕ Cancel' : '+ Add Stream'}
        </button>
      </div>

      {showAddForm && (
        <div className="add-form">
          <h3>Create New Stream</h3>
          <div className="form-group">
            <label>Stream ID</label>
            <input
              type="text"
              placeholder="e.g., webcam1"
              value={formData.streamId}
              onChange={(e) => setFormData({ ...formData, streamId: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateStream()}
            />
            <small>Unique identifier for this stream</small>
          </div>

          <div className="form-group">
            <label>Source Type</label>
            <select
              value={formData.sourceType}
              onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as 'camera' | 'video', deviceId: '', videoFile: null })}
            >
              <option value="camera">Camera</option>
              <option value="video">Video File</option>
            </select>
            <small>Camera for live feed or video file for playback</small>
          </div>

          {formData.sourceType === 'camera' ? (
            <div className="form-group">
              <label>Camera Device</label>
              {devicesLoading ? (
                <div style={{ padding: '10px', color: 'rgba(255, 255, 255, 0.4)', fontSize: '14px' }}>
                  Loading cameras...
                </div>
              ) : devices.length === 0 ? (
                <div style={{ padding: '10px', color: '#ff453a', fontSize: '14px' }}>
                  No cameras found. Please connect a camera.
                </div>
              ) : (
                <select
                  value={formData.deviceId}
                  onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                >
                  <option value="">Select a camera</option>
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
              )}
              <small>Select webcam or USB camera</small>
            </div>
          ) : (
            <div className="form-group">
              <label>Video File</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData({ ...formData, videoFile: file });
                  }
                }}
              />
              <small>
                {formData.videoFile ? (
                  <span style={{ color: '#30d158' }}>✓ Selected: {formData.videoFile.name}</span>
                ) : (
                  'MP4, WebM, or other video formats'
                )}
              </small>
            </div>
          )}

          <div className="form-group">
            <label>Config File (Optional)</label>
            <input
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleConfigFileChange}
            />
            <small>
              {formData.configFile ? (
                <span style={{ color: '#30d158' }}>✓ Loaded: {formData.configFile.name}</span>
              ) : (
                'JSON config for processor settings'
              )}
            </small>
          </div>

          <button
            className="btn btn-success btn-block"
            onClick={handleCreateStream}
            disabled={
              !formData.streamId.trim() || 
              (formData.sourceType === 'camera' && (!formData.deviceId || devicesLoading)) ||
              (formData.sourceType === 'video' && !formData.videoFile) ||
              isCreating
            }
          >
            {isCreating ? (loadingMessage || 'Initializing...') : 'Create & Start Stream'}
          </button>
        </div>
      )}

      <div className="streams-list">
        <div className="streams-header">
          <h3>Active Streams ({streams.length})</h3>
        </div>

        {streams.length === 0 ? (
          <div className="no-streams">
            <p>No active streams</p>
            <p><small>Click "Add Stream" to get started</small></p>
          </div>
        ) : (
          <div className="stream-items">
            {streams.map((stream) => (
              <div
                key={stream.streamId}
                className={`stream-item ${selectedStream === stream.streamId ? 'selected' : ''}`}
                onClick={() => onStreamSelect(selectedStream === stream.streamId ? null : stream.streamId)}
              >
                <div className="stream-item-header">
                  <span className="stream-name">{stream.streamId}</span>
                  <span className={`status-badge ${stream.active ? 'active' : 'inactive'}`}>
                    {stream.active ? '● Active' : '○ Inactive'}
                  </span>
                </div>

                <div className="stream-item-details">
                  <small>Source: {stream.sourceType === 'camera' ? `📹 ${stream.deviceLabel || 'Default'}` : `🎬 ${stream.videoFile?.name || stream.deviceLabel || 'Video'}`}</small>
                </div>

                <div className="stream-item-actions">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStream(stream);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="view-options">
        <h3>View Options</h3>
        <button
          className={`btn btn-block ${!selectedStream ? 'btn-active' : ''}`}
          onClick={() => onStreamSelect(null)}
        >
          Show All Streams
        </button>
      </div>

      <div className="info-section">
        <h3>System Info</h3>
        <div className="info-item">
          <span>Connection:</span>
          <span className={connected ? 'text-success' : 'text-danger'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="info-item">
          <span>Camera Source:</span>
          <span>Browser</span>
        </div>
        <div className="info-item">
          <span>Active Streams:</span>
          <span>{streams.length}</span>
        </div>
      </div>
    </div>
  );
}

