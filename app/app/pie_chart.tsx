'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import { HitData } from './model';

interface PieChartComponentProps {
  data: HitData[];
  selectedStates: string[];
  pieDate: string;
  startDate: string;
  endDate: string;
  setPieDate: (date: string) => void;
}

export default function PieChartComponent({ data, selectedStates, pieDate, startDate, endDate, setPieDate }: PieChartComponentProps) {
  const getPieChartData = () => {
    if (!pieDate) return [];
    
    const selectedData = data.find(item => item.date === pieDate);
    if (!selectedData) return [];
    
    if (selectedStates.includes('all')) {
      return Object.entries(selectedData.by_states).map(([state, value]) => ({
        name: state,
        value
      }));
    }
    
    return selectedStates.map(state => ({
      name: state,
      value: selectedData.by_states[state] || 0
    }));
  };

  const pieData = getPieChartData();
  const totalPieValue = pieData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">State Distribution</h2>
      <div className="mb-4">
        <label className="block mb-2 text-gray-700">Select Date:</label>
        <input
          type="date"
          value={pieDate}
          min={startDate}
          max={endDate}
          onChange={(e) => {
            const selectedDate = e.target.value;
            if (selectedDate >= startDate && selectedDate <= endDate) {
              setPieDate(selectedDate);
            }
          }}
          className="w-full md:w-auto border border-gray-300 bg-white rounded p-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div className="h-[900px] md:h-[600px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20 }}>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percent, name }) => 
                percent > 0.05 ? `${name}: ${(percent * 100).toFixed(2)}%` : null
              }
              outerRadius={150}
              fill="#8884d8"
              dataKey="value"
              isAnimationActive={false}
            >
              {pieData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={`hsl(${(index * 137.5) % 360}, 70%, 45%)`}
                />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${name}: ${((value / totalPieValue) * 100).toFixed(2)}%`,
                `Value: ${value}`
              ]}
              active={true}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}