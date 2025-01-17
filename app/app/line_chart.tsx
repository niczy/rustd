'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { HitData } from './model';

interface LineChartComponentProps {
  data: HitData[];
  selectedStates: string[];
}

export default function LineChartComponent({ data, selectedStates}: LineChartComponentProps) {
  const chartData = data.map(item => {
    const dataPoint: Record<string, number | string> = {
      date: item.date
    };
    
    if (selectedStates.includes('all')) {
      dataPoint.total = item.total_hits;
    } else {
      selectedStates.forEach(state => {
        dataPoint[state] = item.by_states[state] || 0;
      });
    }
    
    return dataPoint;
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mb-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Hits Over Time</h2>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              angle={-45}
              textAnchor="end"
              height={70}
              stroke="#374151"
            />
            <YAxis stroke="#374151" />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '4px'
              }}
              labelStyle={{ color: '#374151' }}
            />
            <Legend />
            {selectedStates.includes('all') ? (
              <Line
                type="monotone"
                dataKey="total"
                name="All States"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 4, fill: '#2563eb' }}
              />
            ) : (
              selectedStates.map((state, index) => (
                <Line
                  key={state}
                  type="monotone"
                  dataKey={state}
                  stroke={`hsl(${(index * 137.5) % 360}, 70%, 45%)`}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}