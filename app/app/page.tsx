'use client';
import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface HitData {
  date: string;
  total_hits: number;
  by_states: {
    [key: string]: number;
  }
}

export default function Home() {
  const [selectedState, setSelectedState] = useState('all');
  const [data, setData] = useState<HitData[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const states = ['all', 'NY', 'WA', 'FL', 'CO', 'VA', 'OR', 'CA', 'IL', 'MA', 'TX'];

  useEffect(() => {
    // Set default dates to last 100 days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 100);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!startDate || !endDate) return;
      
      try {
        const response = await fetch(
          `http://localhost:8080/hits?start-date=${startDate}&end-date=${endDate}`
        );
        const jsonData = await response.json();
        setData(jsonData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [startDate, endDate]);
  
  const chartData = data.map(item => ({
    date: item.date,
    hits: selectedState === 'all' ? item.total_hits : item.by_states[selectedState]
  }));

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Hit Statistics Dashboard</h1>
        
        <div className="mb-6 flex gap-4 items-center">
          <div>
            <label className="mr-2">Start Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded p-2"
            />
          </div>
          
          <div>
            <label className="mr-2">End Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded p-2"
            />
          </div>

          <div>
            <label className="mr-2">Filter by State:</label>
            <select 
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="border rounded p-2"
            >
              {states.map(state => (
                <option key={state} value={state}>
                  {state === 'all' ? 'All States' : state}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">
            {selectedState === 'all' ? 'Total Hits' : `Hits for ${selectedState}`} Over Time
          </h2>
          
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="hits" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-center">Data Table</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-center">Date</th>
                  <th className="px-4 py-2 text-center">Hits</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, index) => (
                  <tr key={index} className="border-b">
                    <td className="px-4 py-2 text-center">{row.date}</td>
                    <td className="px-4 py-2 text-center">{row.hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
