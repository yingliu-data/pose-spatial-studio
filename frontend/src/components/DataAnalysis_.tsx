import { useState, useEffect, useRef } from 'react';
import { PoseResult } from '@/types/pose';

interface DataAnalysisProps {
  poseResults: Map<string, PoseResult>;
  streams: Array<{ streamId: string; deviceLabel?: string }>;
}

type MetricType = 'upper_limb_centre_2d' | 'upper_limb_centre_3d' | 'lower_limb_centre_2d' | 'lower_limb_centre_3d';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface MetricData {
  type: MetricType;
  streamId: string;
  dataPoints: DataPoint[];
}

const METRICS = {
  upper_limb_centre_2d: 'Upper Limb Centre 2D',
  upper_limb_centre_3d: 'Upper Limb Centre 3D',
  lower_limb_centre_2d: 'Lower Limb Centre 2D',
  lower_limb_centre_3d: 'Lower Limb Centre 3D',
} as const;

const DATA_RETENTION_MS = 10000;
const CHART_CONFIG = {
  width: 800,
  height: 120,
  padding: { top: 20, right: 40, bottom: 30, left: 50 },
  colors: { line: '#4CAF50', grid: '#2a2a2a', axis: '#444', text: '#999', bg: '#1a1a1a' }
};

const extractMetricValue = (poseResult: PoseResult, metric: MetricType): number | null => {
  const { pose_data } = poseResult;
  if (!pose_data) return null;

  const [limb, dimension] = metric.split('_').slice(0, 2).join('_') === 'upper_limb' 
    ? ['upper_limb_centre', metric.endsWith('2d') ? '2d' : '3d']
    : ['lower_limb_centre', metric.endsWith('2d') ? '2d' : '3d'];

  const value = (pose_data as any)[limb]?.[dimension];
  return (value != null && !isNaN(value)) ? value : null;
};

const drawChart = (canvas: HTMLCanvasElement, data: MetricData) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height, padding, colors } = CHART_CONFIG;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, width, height);

  const validPoints = data.dataPoints.filter(p => p.value != null && !isNaN(p.value));
  
  if (validPoints.length === 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for data...', width / 2, height / 2);
    return;
  }

  const now = Date.now();
  const timeMin = now - DATA_RETENTION_MS;
  const values = validPoints.map(p => p.value);
  const valueMin = Math.min(...values);
  const valueMax = Math.max(...values);
  const valueRange = valueMax - valueMin || 1;

  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.text;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight * i) / 5;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText((valueMax - (valueRange * i) / 5).toFixed(3), padding.left - 5, y + 4);
  }

  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  validPoints.forEach((point, i) => {
    const x = padding.left + ((point.timestamp - timeMin) / DATA_RETENTION_MS) * chartWidth;
    const y = padding.top + chartHeight - ((point.value - valueMin) / valueRange) * chartHeight;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = colors.line;
  validPoints.forEach(point => {
    const x = padding.left + ((point.timestamp - timeMin) / DATA_RETENTION_MS) * chartWidth;
    const y = padding.top + chartHeight - ((point.value - valueMin) / valueRange) * chartHeight;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const lastPoint = validPoints[validPoints.length - 1];
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Current: ${lastPoint.value.toFixed(4)}`, width - padding.right, padding.top + 15);
};

export function DataAnalysis({ poseResults, streams }: DataAnalysisProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricType>>(new Set());
  const [metricsData, setMetricsData] = useState<Map<string, MetricData>>(new Map());
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    const now = Date.now();
    
    setMetricsData(prev => {
      const updated = new Map(prev);
      
      selectedMetrics.forEach(metric => {
        streams.forEach(stream => {
          const poseResult = poseResults.get(stream.streamId);
          if (!poseResult?.pose_data) return;
          
          const key = `${stream.streamId}_${metric}`;
          const data = updated.get(key) || { type: metric, streamId: stream.streamId, dataPoints: [] };
          
          const value = extractMetricValue(poseResult, metric);
          if (value !== null) {
            data.dataPoints.push({ timestamp: poseResult.timestamp_ms, value });
            data.dataPoints = data.dataPoints.filter(p => now - p.timestamp < DATA_RETENTION_MS);
          }
          
          updated.set(key, data);
        });
      });
      
      Array.from(updated.keys()).forEach(key => {
        if (!selectedMetrics.has(updated.get(key)!.type)) updated.delete(key);
      });
      
      return updated;
    });
  }, [poseResults, selectedMetrics, streams]);

  useEffect(() => {
    metricsData.forEach((data, key) => {
      const canvas = canvasRefs.current.get(key);
      if (canvas) drawChart(canvas, data);
    });
  }, [metricsData]);

  const toggleMetric = (metric: MetricType) => {
    setSelectedMetrics(prev => {
      const next = new Set(prev);
      next.has(metric) ? next.delete(metric) : next.add(metric);
      return next;
    });
  };

  return (
    <div style={{ padding: '16px', background: '#1a1a1a', borderTop: '1px solid #444' }}>
      <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '16px' }}>Data Analysis</h3>
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {Object.entries(METRICS).map(([key, label]) => {
          const metric = key as MetricType;
          const isSelected = selectedMetrics.has(metric);
          
          return (
            <button
              key={metric}
              onClick={() => toggleMetric(metric)}
              style={{
                padding: '8px 16px',
                background: isSelected ? '#4CAF50' : '#333',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => !isSelected && (e.currentTarget.style.background = '#444')}
              onMouseLeave={e => !isSelected && (e.currentTarget.style.background = '#333')}
            >
              {label}{isSelected && ' ✓'}
            </button>
          );
        })}
      </div>
      
      {selectedMetrics.size > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from(metricsData.entries()).map(([key, data]) => {
            const stream = streams.find(s => s.streamId === data.streamId);
            const streamLabel = stream?.deviceLabel || data.streamId;
            
            return (
              <div key={key} style={{ background: '#252525', borderRadius: '8px', padding: '12px' }}>
                <div style={{ marginBottom: '8px', color: '#aaa', fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{METRICS[data.type]}</span>
                  <span>Stream: {streamLabel}</span>
                </div>
                <canvas
                  ref={el => el ? canvasRefs.current.set(key, el) : canvasRefs.current.delete(key)}
                  width={CHART_CONFIG.width}
                  height={CHART_CONFIG.height}
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
          Select one or more metrics above to view streaming data curves
        </div>
      )}
    </div>
  );
}
